import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { lotesEstoque, dimPlanogramas } from '../src/db/schema.js';
import { eq, and, asc, isNull, gt } from 'drizzle-orm';
dotenv.config();

const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const BASE_URL = "https://vmpay.vertitecnologia.com.br";

const log = (msg: string) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status} on ${endpoint}`);
      return await res.json();
    } catch(e: any) {
      retries++;
      log(`API Error on ${endpoint}: ${e.message}. Retrying ${retries}/3...`);
      await wait(1000 * retries);
    }
  }
  throw new Error(`Failed to fetch ${endpoint} after 3 retries.`);
}

async function processPickLists() {
  log("Buscando scheduled_visits (Visitas Agendadas/Realizadas)...");
  // Como exemplo, buscando os últimos 7 dias. Na prática, pode ser baseado no último sync.
  const startIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  let page = 1;
  let hasMore = true;
  let totalAbastecimentos = 0;
  
  while (hasMore) {
    const visits = await fetchApi('/scheduled_visits', { page, per_page: 100 });
    if (!visits || visits.length === 0) break;
    
    for (const visit of visits) {
      if (visit.pick_list_id && visit.installation_id && visit.machine_id) {
        log(`Processando Pick List ${visit.pick_list_id} da instalação ${visit.installation_id}...`);
        try {
          const pickList = await fetchApi(`/machines/${visit.machine_id}/installations/${visit.installation_id}/pick_lists/${visit.pick_list_id}`);
          if (pickList && pickList.items) {
            const movimentacoes = pickList.items.map((item: any) => ({
              produtoId: item.good_id,
              quantidade: item.quantity,
              instalacaoId: visit.installation_id
            })).filter((m: any) => m.produtoId && m.quantidade > 0);
            
            if (movimentacoes.length > 0) {
              await aplicarAbastecimentoFEFO(movimentacoes);
              totalAbastecimentos += movimentacoes.length;
            }
          }
        } catch (e: any) {
          log(`Erro ao processar pick list ${visit.pick_list_id}: ${e.message}`);
        }
      }
    }
    
    if (visits.length < 100) hasMore = false;
    page++;
  }
  log(`Total de itens de abastecimento processados: ${totalAbastecimentos}`);
}

async function aplicarAbastecimentoFEFO(movimentacoes: any[]) {
  for (const mov of movimentacoes) {
    let remainingToTransfer = mov.quantidade;
    const lotes = await db.select().from(lotesEstoque)
      .where(and(eq(lotesEstoque.produtoId, mov.produtoId), isNull(lotesEstoque.instalacaoId)))
      .orderBy(asc(lotesEstoque.dataValidade));
      
    for (const lote of lotes) {
      if (remainingToTransfer <= 0) break;
      if (!lote.quantidadeAtual || lote.quantidadeAtual <= 0) continue;
      
      const transferQty = Math.min(lote.quantidadeAtual, remainingToTransfer);
      const novaQtdDeposito = lote.quantidadeAtual - transferQty;
      
      await db.update(lotesEstoque).set({ quantidadeAtual: novaQtdDeposito }).where(eq(lotesEstoque.idLote, lote.idLote));
      
      const result = await db.select().from(lotesEstoque)
        .where(and(
          eq(lotesEstoque.produtoId, mov.produtoId), 
          eq(lotesEstoque.instalacaoId, mov.instalacaoId),
          eq(lotesEstoque.dataValidade, lote.dataValidade)
        )).limit(1);
        
      if (result.length > 0) {
        await db.update(lotesEstoque)
          .set({ quantidadeAtual: (result[0].quantidadeAtual || 0) + transferQty })
          .where(eq(lotesEstoque.idLote, result[0].idLote));
      } else {
        await db.insert(lotesEstoque).values({
          produtoId: mov.produtoId,
          produto: lote.produto,
          dataValidade: lote.dataValidade,
          quantidadeAtual: transferQty,
          instalacaoId: mov.instalacaoId
        });
      }
      remainingToTransfer -= transferQty;
    }
    await atualizarValidadePlanograma(mov.produtoId, mov.instalacaoId);
  }
}

async function processVendas() {
  log("Buscando vendas (cashless_facts) para deduzir do estoque...");
  const startIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  let page = 1;
  let hasMore = true;
  let totalVendas = 0;
  
  while (hasMore) {
    const vendasResponse = await fetchApi('/cashless_facts', { start_date: startIso, page, per_page: 500 });
    const vendas = vendasResponse || []; // Pode ser que a API retorne no formato paginado
    if (!vendas || vendas.length === 0) break;
    
    // Agrupar vendas por instalação e produto
    const vendasAgrupadas = new Map<string, { produtoId: number, instalacaoId: number, quantidade: number }>();
    
    for (const venda of vendas) {
      if (venda.good_id && venda.installation_id) {
        const key = `${venda.installation_id}_${venda.good_id}`;
        if (!vendasAgrupadas.has(key)) {
          vendasAgrupadas.set(key, { produtoId: venda.good_id, instalacaoId: venda.installation_id, quantidade: 0 });
        }
        vendasAgrupadas.get(key)!.quantidade += 1;
      }
    }
    
    const movimentacoes = Array.from(vendasAgrupadas.values());
    if (movimentacoes.length > 0) {
      await aplicarVendasFEFO(movimentacoes);
      totalVendas += movimentacoes.length;
    }
    
    if (vendas.length < 500) hasMore = false;
    page++;
  }
  log(`Total de grupos de vendas processados: ${totalVendas}`);
}

async function aplicarVendasFEFO(vendas: any[]) {
  for (const venda of vendas) {
    let remainingToDeduct = venda.quantidade;
    const lotes = await db.select().from(lotesEstoque)
      .where(and(eq(lotesEstoque.produtoId, venda.produtoId), eq(lotesEstoque.instalacaoId, venda.instalacaoId)))
      .orderBy(asc(lotesEstoque.dataValidade));
      
    for (const lote of lotes) {
      if (remainingToDeduct <= 0) break;
      if (!lote.quantidadeAtual || lote.quantidadeAtual <= 0) continue;
      
      const deductQty = Math.min(lote.quantidadeAtual, remainingToDeduct);
      const novaQtdMercado = lote.quantidadeAtual - deductQty;
      
      await db.update(lotesEstoque).set({ quantidadeAtual: novaQtdMercado }).where(eq(lotesEstoque.idLote, lote.idLote));
      remainingToDeduct -= deductQty;
    }
    await atualizarValidadePlanograma(venda.produtoId, venda.instalacaoId);
  }
}

async function atualizarValidadePlanograma(produtoId: number, instalacaoId: number) {
  const resultRestante = await db.select().from(lotesEstoque)
    .where(and(
       eq(lotesEstoque.produtoId, produtoId), 
       eq(lotesEstoque.instalacaoId, instalacaoId),
       gt(lotesEstoque.quantidadeAtual, 0)
    ))
    .orderBy(asc(lotesEstoque.dataValidade))
    .limit(1);
    
  if (resultRestante.length > 0) {
    await db.update(dimPlanogramas)
      .set({ validade: resultRestante[0].dataValidade })
      .where(and(
         eq(dimPlanogramas.idProduto, produtoId),
         eq(dimPlanogramas.instalacaoId, instalacaoId)
      ));
  } else {
    await db.update(dimPlanogramas)
      .set({ validade: null })
      .where(and(
         eq(dimPlanogramas.idProduto, produtoId),
         eq(dimPlanogramas.instalacaoId, instalacaoId)
      ));
  }
}

async function run() {
  if (!VMPAY_API_KEY) {
    throw new Error('VMPAY_API_KEY env missing');
  }
  try {
    await processPickLists();
    await processVendas();
    log("Sincronização FEFO concluída com sucesso.");
    process.exit(0);
  } catch (e: any) {
    log(`Erro: ${e.message}`);
    process.exit(1);
  }
}
run();
