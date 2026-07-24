import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { dimPlanogramas } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

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
        headers: {
          'Accept': 'application/json',
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status} on ${endpoint}`);
      }
      return await res.json();
    } catch(e: any) {
      retries++;
      log(`API Error on ${endpoint}: ${e.message}. Retrying ${retries}/3...`);
      await wait(1000 * retries);
    }
  }
  throw new Error(`Failed to fetch ${endpoint} after 3 retries.`);
}

async function fillPlanograms() {
  log("Starting fill planograms script...");
  if (!VMPAY_API_KEY) {
    throw new Error('VMPAY_API_KEY env missing');
  }

  log("Baixando lista de todos os produtos do VMPay...");
  let page = 1;
  let hasMore = true;
  const allProducts: any[] = [];
  while(hasMore) {
    const products = await fetchApi('/products', { page, per_page: 1000 });
    if (!products || products.length === 0) break;
    allProducts.push(...products);
    if (products.length < 1000) hasMore = false;
    page++;
    await wait(300);
  }
  log(`Total de produtos baixados do VMPay: ${allProducts.length}`);

  log("Baixando lista de todas as máquinas e instalações do VMPay...");
  page = 1;
  hasMore = true;
  const allMachines: any[] = [];
  while(hasMore) {
    const machines = await fetchApi('/machines', { page, per_page: 100 });
    if (!machines || machines.length === 0) break;
    allMachines.push(...machines);
    if (machines.length < 100) hasMore = false;
    page++;
    await wait(300);
  }
  log(`Total de máquinas baixadas: ${allMachines.length}`);

  log("Baixando planogramas para cada instalação...");
  const planMap = new Map<number, Set<number>>();
  const instalacaoPlanIdMap = new Map<number, number>();
  const instalacaoNameMap = new Map<number, string>();
  
  for (const m of allMachines) {
    if (m.installation?.id) {
      try {
        const detail = await fetchApi(`/machines/${m.id}/installations/${m.installation.id}`);
        if (detail.current_planogram && detail.current_planogram.items) {
          const instId = detail.id;
          instalacaoNameMap.set(instId, detail.place != null ? String(detail.place) : "Desconhecida");
          instalacaoPlanIdMap.set(instId, detail.current_planogram.id);
          
          if (!planMap.has(instId)) planMap.set(instId, new Set());
          
          for (const item of detail.current_planogram.items) {
            if (item.good?.id) {
              planMap.get(instId)!.add(item.good.id);
            }
          }
        }
      } catch (e) {
         log(`Falha ao obter planograma da instalação ${m.installation.id}`);
      }
      await wait(300);
    }
  }
  
  log("Analisando quais produtos faltam em cada planograma...");
  const existingPlanogramas = await db.select().from(dimPlanogramas);
  let maxPlanItemId = existingPlanogramas.length > 0 ? Math.max(...existingPlanogramas.map(p => p.planItemId)) : 100000;
  
  const newRows: any[] = [];
  let addedCount = 0;

  for (const [instId, existingProductIds] of planMap.entries()) {
    const instName = instalacaoNameMap.get(instId) || "Desconhecida";
    const planId = instalacaoPlanIdMap.get(instId) || 0;
    let addedForThisInst = 0;
    
    for (const produto of allProducts) {
      if (!existingProductIds.has(produto.id)) {
        maxPlanItemId++;
        const cost = produto.cost_price || 0;
        const exactSuggestedPrice = cost / 0.58;
        const suggestedPrice = Math.max(0, parseFloat((Math.ceil(exactSuggestedPrice * 10) / 10 - 0.01).toFixed(2)));

        newRows.push({
          planItemId: maxPlanItemId,
          instalacaoId: instId,
          instalacao: instName,
          planId: planId,
          idProduto: produto.id,
          produto: produto.name != null ? String(produto.name) : null,
          saldo: 0,
          nivelPar: 10,
          nivelAlerta: 3,
          usarNivelMinimo: false,
          nivelMinimo: 0,
          preco: suggestedPrice,
          usaPrecoPadrao: false,
          precoPromocao: 0,
          status: 'ativo',
        });
        addedCount++;
        addedForThisInst++;
      }
    }
    log(`Instalação ${instName} (${instId}): Faltam ${addedForThisInst} produtos.`);
  }

  log(`Total de itens faltantes a serem inseridos no banco local: ${addedCount}`);
  
  if (newRows.length > 0) {
    for (let i = 0; i < newRows.length; i += 1000) {
      const chunk = newRows.slice(i, i + 1000);
      await db.insert(dimPlanogramas)
        .values(chunk)
        .onConflictDoNothing();
    }
  }

  log(`Processo finalizado com sucesso!`);
  process.exit(0);
}

fillPlanograms().catch(e => {
  console.error(e);
  process.exit(1);
});
