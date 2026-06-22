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
    nome: c.name,
  }));
  
  if (rows.length > 0) {
    await db.insert(dimCategorias)
      .values(rows)
      .onConflictDoUpdate({
        target: dimCategorias.id,
        set: { nome: sql`EXCLUDED.nome` },
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
    
    const prodRows = [];
    const cbRows = [];
    
    for (const p of products) {
      prodRows.push({
        id: p.id,
        produto: p.name,
        categoria: null, // We'll rely on joining with dimCategorias later if needed, or update if provided directly
        categoriaId: p.category_id,
        codigoBarras: p.barcode,
        precoCusto: p.cost_price,
        precoPadrao: p.default_price,
        totalVendido: p.vendible_balance,
        ncmCode: p.ncm_code,
        cestCode: p.cest_code,
        taxOperationId: p.tax_operation?.id,
        taxOperationName: p.tax_operation?.name,
        quantidadeEstoque: p.inventories?.[0]?.total_quantity || 0,
      });

      if (p.barcode) {
        cbRows.push({
          idProduto: p.id,
          codigoPrincipal: p.barcode,
          codigoAdicional: p.barcode,
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

    if (prodRows.length > 0) {
      await db.insert(dimProdutos)
        .values(prodRows)
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
          }
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
    const machines = await fetchApi('/machines', { page, per_page: 100 });
    if (!machines || machines.length === 0) break;
    
    for (const m of machines) {
      if (m.installation?.id) {
        // Sync installation basic info
        await db.insert(dimInstalacoes)
          .values({
            instalacaoId: m.installation.id,
            instalacao: m.installation.place,
            maquinaId: m.id,
          })
          .onConflictDoUpdate({
            target: dimInstalacoes.instalacaoId,
            set: { instalacao: sql`EXCLUDED.instalacao` },
          });
        instCount++;

        // Fetch detailed installation to get Planograms
        try {
          const detail = await fetchApi(`/machines/${m.id}/installations/${m.installation.id}`);
          if (detail.current_planogram && detail.current_planogram.items) {
            const planRows = detail.current_planogram.items.map((item: any) => ({
              planItemId: item.id,
              instalacaoId: detail.id,
              instalacao: detail.place,
              planId: detail.current_planogram.id,
              idProduto: item.good?.id,
              produto: item.good?.name,
              saldo: item.current_balance,
              nivelPar: item.par_level,
              nivelAlerta: item.alert_level,
              usarNivelMinimo: item.use_minimum_level,
              nivelMinimo: item.minimum_level,
              preco: item.desired_price,
              usaPrecoPadrao: item.use_default_price_product,
              precoPromocao: item.promotional_price,
              status: item.status,
              validade: item.expiration_date ? new Date(item.expiration_date) : null,
              alternativoApenas: item.alternative_only,
            }));

            if (planRows.length > 0) {
              await db.insert(dimPlanogramas)
                .values(planRows)
                .onConflictDoUpdate({
                  target: dimPlanogramas.planItemId,
                  set: {
                    saldo: sql`EXCLUDED.saldo`,
                    preco: sql`EXCLUDED.preco`,
                    precoPromocao: sql`EXCLUDED.preco_promocao`,
                    status: sql`EXCLUDED.status`,
                  }
                });
              planCount += planRows.length;
            }
          }
        } catch(e) {
          log(`Warning: Failed to fetch installation detail for ${m.installation.id}`);
        }
        await wait(200); // rate logic
      }
    }
    
    page++;
    await wait(1000);
  }
  log(`Synced ${instCount} instalações e ${planCount} itens de planograma.`);
}

async function syncCashlessFacts() {
  log("Syncing Cashless Facts (últimos 15 dias)...");
  
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 15);
  
  let page = 1;
  let hasMore = true;
  let count = 0;

  while(hasMore) {
    const facts = await fetchApi('/cashless_facts', { 
      start_date: start.toISOString().split('.')[0] + 'Z',
      end_date: end.toISOString().split('.')[0] + 'Z',
      page, 
      per_page: 1000 
    });
    
    if (!facts || facts.length === 0) break;
    
    const rows = facts.map((f: any) => ({
      vendaId: String(f.id),
      dataVenda: new Date(f.occurred_at),
      produtoId: f.good?.id,
      produto: f.good?.name,
      categoriaId: f.good?.category_id,
      instalacao: f.place,
      cardNumber: f.masked_card_number,
      statusVenda: f.status,
      tipoCartao: f.eft_card_type?.name,
      tipoPagamento: f.kind,
      tipoPix: f.payment_authorizer?.name,
      valor: f.value,
      precoCusto: f.cost_price,
      quantidade: f.quantity,
    }));

    if (rows.length > 0) {
      await db.insert(fatoVendas)
        .values(rows)
        .onConflictDoUpdate({
          target: fatoVendas.vendaId,
          set: { statusVenda: sql`EXCLUDED.status_venda` }
        });
      count += rows.length;
    }
    page++;
    await wait(500);
  }
  log(`Synced ${count} vendas.`);
}

async function syncInventoryMovements() {
  log("Syncing Movimentos (últimos 15 dias)...");
  
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 15);
  
  let page = 1;
  let hasMore = true;
  let count = 0;

  while(hasMore) {
    const movs = await fetchApi('/distribution_center_inventories', { 
      occurred_at_start: start.toISOString().split('.')[0] + 'Z',
      occurred_at_end: end.toISOString().split('.')[0] + 'Z',
      page, 
      per_page: 1000 
    });
    
    if (!movs || movs.length === 0) break;
    
    const rows = movs.map((m: any) => ({
      movimentoId: String(m.id),
      movimentoData: new Date(m.occurred_at),
      saldoAnterior: m.balance_before,
      quantidade: m.value,
      saldoFinal: m.balance_after,
      produtoId: m.good?.id,
      produto: m.good?.display_name,
      fornecedor: m.provider?.name,
      operacaoTipo: m.nature_operation,
      precoCusto: m.cost_price,
    }));

    if (rows.length > 0) {
      await db.insert(fatoMovimentos)
        .values(rows)
        .onConflictDoUpdate({
          target: fatoMovimentos.movimentoId,
          set: { saldoFinal: sql`EXCLUDED.saldo_final` }
        });
      count += rows.length;
    }
    page++;
    await wait(500);
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
     process.exit(1);
  }
}

runSync();
