import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { 
  dimCategorias, dimProdutos, dimCodigosDeBarra, dimInstalacoes, 
  dimPlanogramas, fatoVendas, fatoMovimentos 
} from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

dotenv.config();

const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const BASE_URL = "https://vmpay.vertitecnologia.com.br";

const logs: string[] = [];
const log = (msg: string) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
  logs.push(`[${ts}] ${msg}`);
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchApi(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${BASE_URL}/api/v1${endpoint}`);
  url.searchParams.append('access_token', VMPAY_API_KEY as string);
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  let retries = 0;
  while (retries < 3) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status} on ${endpoint}`);
      }
      return await res.json();
    } catch (e: any) {
      retries++;
      log(`Error fetching ${endpoint}: ${e.message}. Retry ${retries}/3`);
      await wait(2000 * retries);
    }
  }
  throw new Error(`Failed to fetch ${endpoint} after 3 retries.`);
}

async function syncCategories() {
  log("Syncing Categorias...");
  const categories = await fetchApi('/categories', { per_page: 1000 });
  const rows = categories.map((c: any) => ({
    id: c.id,
    nome: c.name != null ? String(c.name) : "Desconhecido",
  }));
  
  const uniqueRows = Array.from(new Map(rows.map((r: any) => [r.id, r])).values());

  if (uniqueRows.length > 0) {
    await db.insert(dimCategorias)
      .values(uniqueRows as any)
      .onConflictDoUpdate({
        target: dimCategorias.id,
        set: { nome: sql`EXCLUDED.nome` },
        where: sql`"dim_categorias".nome IS DISTINCT FROM EXCLUDED.nome`,
      });
  }
  log(`Synced ${rows.length} categorias.`);
}

async function syncProducts() {
  log("Syncing Produtos...");
  // Paginated fetching for products
  let page = 1;
  let hasMore = true;
  let count = 0;

  while(hasMore) {
    const products = await fetchApi('/products', { page, per_page: 1000 });
    if (!products || products.length === 0) break;
    if (products.length < 1000) hasMore = false;
    
    const prodRows = [];
    const cbRows = [];
    
    for (const p of products) {
      prodRows.push({
        id: p.id,
        produto: p.name != null ? String(p.name) : "Produto Desconhecido",
        categoria: null,
        categoriaId: p.category_id,
        codigoBarras: p.barcode != null ? String(p.barcode) : null,
        precoCusto: p.cost_price,
        precoPadrao: p.default_price,
        totalVendido: p.vendible_balance,
        ncmCode: p.ncm_code != null ? String(p.ncm_code) : null,
        cestCode: p.cest_code != null ? String(p.cest_code) : null,
        taxOperationId: p.tax_operation?.id,
        taxOperationName: p.tax_operation?.name != null ? String(p.tax_operation?.name) : null,
        quantidadeEstoque: p.inventories?.[0]?.total_quantity || 0,
      });

      if (p.barcode) {
        cbRows.push({
          idProduto: p.id,
          codigoPrincipal: String(p.barcode),
          codigoAdicional: String(p.barcode),
        });
      }

      if (Array.isArray(p.additional_barcodes)) {
        for (const code of p.additional_barcodes) {
          cbRows.push({
            idProduto: p.id,
            codigoPrincipal: p.barcode,
            codigoAdicional: code,
          });
        }
      }
    }

    const uniqueProdRows = Array.from(new Map(prodRows.map((r: any) => [r.id, r])).values());

    if (uniqueProdRows.length > 0) {
      await db.insert(dimProdutos)
        .values(uniqueProdRows as any)
        .onConflictDoUpdate({
          target: dimProdutos.id,
          set: {
            produto: sql`EXCLUDED.produto`,
            categoriaId: sql`EXCLUDED.categoria_id`,
            codigoBarras: sql`EXCLUDED.codigo_barras`,
            precoCusto: sql`EXCLUDED.preco_custo`,
            precoPadrao: sql`EXCLUDED.preco_padrao`,
            totalVendido: sql`EXCLUDED.total_vendido`,
            ncmCode: sql`EXCLUDED.ncm_code`,
            cestCode: sql`EXCLUDED.cest_code`,
            taxOperationId: sql`EXCLUDED.tax_operation_id`,
            taxOperationName: sql`EXCLUDED.tax_operation_name`,
            quantidadeEstoque: sql`EXCLUDED.quantidade_estoque`,
          },
          where: sql`
            "dim_produtos".produto IS DISTINCT FROM EXCLUDED.produto OR
            "dim_produtos".categoria_id IS DISTINCT FROM EXCLUDED.categoria_id OR
            "dim_produtos".preco_custo IS DISTINCT FROM EXCLUDED.preco_custo OR
            "dim_produtos".preco_padrao IS DISTINCT FROM EXCLUDED.preco_padrao OR
            "dim_produtos".total_vendido IS DISTINCT FROM EXCLUDED.total_vendido OR
            "dim_produtos".quantidade_estoque IS DISTINCT FROM EXCLUDED.quantidade_estoque
          `,
        });
    }

    // We can just wipe bar codes for the synced products and reinsert to avoid complex composite key upserts
    if (cbRows.length > 0) {
       for(const row of cbRows) {
         try {
           await db.insert(dimCodigosDeBarra).values(row);
         } catch(e) {
           // ignore duplicate additions if unique constraints exist.
         }
       }
    }

    count += products.length;
    page++;
    await wait(500); // rate limiting
  }
  log(`Synced ${count} produtos.`);
}

async function syncMachinesAndInstallations() {
  log("Syncing Máquinas e Instalações...");
  let page = 1;
  let hasMore = true;
  let instCount = 0;
  let planCount = 0;

  while(hasMore) {
    log(`Fetching machines page ${page}...`);
    const machines = await fetchApi('/machines', { page, per_page: 100 });
    if (!machines || machines.length === 0) break;
    if (machines.length < 100) hasMore = false;
    
    // Process in batches of 10 to speed up
    const chunkSize = 10;
    for (let i = 0; i < machines.length; i += chunkSize) {
      const chunk = machines.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (m: any) => {
        if (m.installation?.id) {
          // Sync installation basic info
          await db.insert(dimInstalacoes)
            .values({
              instalacaoId: m.installation.id,
              instalacao: m.installation.place != null ? String(m.installation.place) : "Desconhecida",
              maquinaId: m.id,
            })
            .onConflictDoUpdate({
              target: dimInstalacoes.instalacaoId,
              set: { instalacao: sql`EXCLUDED.instalacao` },
              where: sql`"dim_instalacoes".instalacao IS DISTINCT FROM EXCLUDED.instalacao`,
            });
          instCount++;

          // Fetch detailed installation to get Planograms
          try {
            const detail = await fetchApi(`/machines/${m.id}/installations/${m.installation.id}`);
            if (detail.current_planogram && detail.current_planogram.items) {
              const planRows = detail.current_planogram.items.map((item: any) => ({
                planItemId: item.id,
                instalacaoId: detail.id,
                instalacao: detail.place != null ? String(detail.place) : "Desconhecida",
                planId: detail.current_planogram.id,
                idProduto: item.good?.id,
                produto: item.good?.name != null ? String(item.good?.name) : null,
                saldo: item.current_balance,
                nivelPar: item.par_level,
                nivelAlerta: item.alert_level,
                usarNivelMinimo: item.use_minimum_level,
                nivelMinimo: item.minimum_level,
                preco: item.desired_price,
                usaPrecoPadrao: item.use_default_price_product,
                precoPromocao: item.promotional_price,
                status: item.status != null ? String(item.status) : null,
                validade: item.expiration_date ? new Date(item.expiration_date) : null,
                alternativoApenas: item.alternative_only,
              }));

              const uniquePlanRows = Array.from(new Map(planRows.map((r: any) => [r.planItemId, r])).values());

              if (uniquePlanRows.length > 0) {
                await db.insert(dimPlanogramas)
                  .values(uniquePlanRows as any)
                  .onConflictDoUpdate({
                    target: dimPlanogramas.planItemId,
                    set: {
                      saldo: sql`EXCLUDED.saldo`,
                      preco: sql`EXCLUDED.preco`,
                      precoPromocao: sql`EXCLUDED.preco_promocao`,
                      status: sql`EXCLUDED.status`,
                    },
                    where: sql`
                      "dim_planogramas".saldo IS DISTINCT FROM EXCLUDED.saldo OR
                      "dim_planogramas".preco IS DISTINCT FROM EXCLUDED.preco OR
                      "dim_planogramas".preco_promocao IS DISTINCT FROM EXCLUDED.preco_promocao OR
                      "dim_planogramas".status IS DISTINCT FROM EXCLUDED.status
                    `
                  });
                planCount += planRows.length;
              }
            }
          } catch(e) {
            log(`Warning: Failed to fetch installation detail for ${m.installation.id}`);
          }
        }
      }));
      await wait(300); // slight delay between chunks
    }
    
    page++;
    await wait(500);
  }
  log(`Synced ${instCount} instalações e ${planCount} itens de planograma.`);
}

async function syncCashlessFacts() {
  log("Syncing Cashless Facts (desde 01/01/2026)...");
  
  const endLimit = new Date();
  let currentStart = new Date('2026-01-01T00:00:00Z');
  let count = 0;

  while(currentStart < endLimit) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 30);
    if (currentEnd > endLimit) {
      currentEnd = endLimit;
    }

    const startIso = currentStart.toISOString().split('.')[0] + 'Z';
    const endIso = currentEnd.toISOString().split('.')[0] + 'Z';
    log(`Syncing Cashless period: ${startIso} to ${endIso}`);

    let page = 1;
    let hasMore = true;

    while(hasMore) {
      const facts = await fetchApi('/cashless_facts', { 
        start_date: startIso,
        end_date: endIso,
        page, 
        per_page: 1000 
      });
      
      if (!facts || facts.length === 0) break;
      if (facts.length < 1000) hasMore = false;
      
      const rows = facts.map((f: any) => ({
        vendaId: String(f.id),
        dataVenda: new Date(f.occurred_at),
        produtoId: f.good?.id,
        produto: f.good?.name != null ? String(f.good?.name) : null,
        categoriaId: f.good?.category_id,
        instalacao: f.place != null ? String(f.place) : null,
        cardNumber: f.masked_card_number != null ? String(f.masked_card_number) : null,
        statusVenda: f.status != null ? String(f.status) : null,
        tipoCartao: f.eft_card_type?.name != null ? String(f.eft_card_type?.name) : null,
        tipoPagamento: f.kind != null ? String(f.kind) : null,
        tipoPix: f.payment_authorizer?.name != null ? String(f.payment_authorizer?.name) : null,
        valor: f.value,
        precoCusto: f.cost_price,
        quantidade: f.quantity,
      }));

      const uniqueRows = Array.from(new Map(rows.map((r: any) => [r.vendaId, r])).values());

      if (uniqueRows.length > 0) {
        await db.insert(fatoVendas)
          .values(uniqueRows as any)
          .onConflictDoUpdate({
            target: fatoVendas.vendaId,
            set: { statusVenda: sql`EXCLUDED.status_venda` },
            where: sql`"fato_vendas".status_venda IS DISTINCT FROM EXCLUDED.status_venda`
          });
        count += uniqueRows.length;
      }
      page++;
      await wait(300);
    }
    
    currentStart = currentEnd;
  }
  log(`Synced ${count} vendas.`);
}

async function syncInventoryMovements() {
  log("Syncing Movimentos (desde 01/01/2026)...");
  
  const endLimit = new Date();
  let currentStart = new Date('2026-01-01T00:00:00Z');
  let count = 0;

  while(currentStart < endLimit) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 30);
    if (currentEnd > endLimit) {
      currentEnd = endLimit;
    }

    const startIso = currentStart.toISOString().split('.')[0] + 'Z';
    const endIso = currentEnd.toISOString().split('.')[0] + 'Z';
    log(`Syncing Movimentos period: ${startIso} to ${endIso}`);

    let page = 1;
    let hasMore = true;

    while(hasMore) {
      const movs = await fetchApi('/distribution_center_inventories', { 
        occurred_at_start: startIso,
        occurred_at_end: endIso,
        page, 
        per_page: 1000 
      });
      
      if (!movs || movs.length === 0) break;
      if (movs.length < 1000) hasMore = false;
      
      const rows = movs.map((m: any) => ({
        movimentoId: String(m.id),
        movimentoData: new Date(m.occurred_at),
        saldoAnterior: m.balance_before,
        quantidade: m.value,
        saldoFinal: m.balance_after,
        produtoId: m.good?.id,
        produto: m.good?.display_name != null ? String(m.good?.display_name) : null,
        fornecedor: m.provider?.name != null ? String(m.provider?.name) : null,
        operacaoTipo: m.nature_operation != null ? String(m.nature_operation) : null,
        precoCusto: m.cost_price,
      }));

      const uniqueRows = Array.from(new Map(rows.map((r: any) => [r.movimentoId, r])).values());

      if (uniqueRows.length > 0) {
        await db.insert(fatoMovimentos)
          .values(uniqueRows as any)
          .onConflictDoUpdate({
            target: fatoMovimentos.movimentoId,
            set: { saldoFinal: sql`EXCLUDED.saldo_final` },
            where: sql`"fato_movimentos".saldo_final IS DISTINCT FROM EXCLUDED.saldo_final`
          });
        count += uniqueRows.length;
      }
      page++;
      await wait(300);
    }
    
    currentStart = currentEnd;
  }
  log(`Synced ${count} movimentos.`);
}

async function runSync() {
  if (!VMPAY_API_KEY) {
    throw new Error('VMPAY_API_KEY env missing');
  }

  try {
    await syncCategories();
    await syncProducts();
    await syncMachinesAndInstallations();
    await syncCashlessFacts();
    await syncInventoryMovements();
    log("======= SINCRONIZAÇÃO COMPLETA =======");
    process.exit(0);
  } catch(e: any) {
     log(`PROCESS FAILED: ${e.message}`);
     if (e.cause) log(`CAUSED BY: ${e.cause}`);
     if (e.stack) log(`STACK: ${e.stack}`);
     process.exit(1);
  }
}

runSync();
