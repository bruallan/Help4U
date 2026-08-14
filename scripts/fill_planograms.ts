import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { dimPlanogramas } from '../src/db/schema.js';

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

async function patchApi(endpoint: string, body: any) {
  const url = new URL(`${BASE_URL}/api/v1${endpoint}`);
  url.searchParams.append('access_token', VMPAY_API_KEY as string);
  let retries = 0;
  while (retries < 3) {
    try {
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      return await res.json();
    } catch(e: any) {
      retries++;
      log(`PATCH Error on ${endpoint}: ${e.message}. Retrying ${retries}/3...`);
      await wait(1000 * retries);
    }
  }
  throw new Error(`Failed to patch ${endpoint} after 3 retries.`);
}

async function fillPlanograms() {
  log("Starting fill planograms script (VMPay API Sync)...");
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
  log(`Total de produtos baixados: ${allProducts.length}`);

  log("Baixando lista de máquinas e instalações do VMPay...");
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

  let addedCount = 0;
  
  for (const m of allMachines) {
    if (m.installation?.id) {
      const instName = m.installation.place || "Desconhecida";
      log(`Processando Instalação ${instName} (${m.installation.id})...`);
      
      try {
        const detail = await fetchApi(`/machines/${m.id}/installations/${m.installation.id}`);
        const currentPlanogram = detail.current_planogram;
        
        if (!currentPlanogram || !currentPlanogram.items) {
          log(`  Nenhum planograma atual encontrado para ${instName}`);
          continue;
        }

        const existingProductIds = new Set<number>();
        let maxLogicalLocator = 0;

        for (const item of currentPlanogram.items) {
          if (item.good?.id) {
            existingProductIds.add(item.good.id);
          }
          const ll = parseInt(item.logical_locator, 10);
          if (!isNaN(ll) && ll > maxLogicalLocator) maxLogicalLocator = ll;
        }
        
        const itemsToPatch = [];
        for (const produto of allProducts) {
          if (!existingProductIds.has(produto.id)) {
            maxLogicalLocator++;
            
            const itemObj: any = {
              type: "Coil",
              good_id: produto.id,
              name: maxLogicalLocator.toString(),
              capacity: 1000,
              par_level: 6,
              alert_level: 4,
              minimum_level: 4,
              use_minimum_level: true,
              logical_locator: maxLogicalLocator.toString(),
              status: "active"
            };

            let suggestedPrice = 0;
            if (produto.default_price !== null && produto.default_price !== undefined && produto.default_price !== "") {
              suggestedPrice = parseFloat(produto.default_price);
              itemObj.use_default_price_product = true;
            } else {
              const cost = parseFloat(produto.cost_price || "0");
              const exactSuggestedPrice = cost / 0.58;
              suggestedPrice = Math.max(0, parseFloat((Math.ceil(exactSuggestedPrice * 10) / 10 - 0.01).toFixed(2)));
              itemObj.use_default_price_product = false;
            }
            itemObj.desired_price = suggestedPrice;

            itemsToPatch.push(itemObj);
            addedCount++;
          }
        }

        if (itemsToPatch.length > 0) {
          log(`  Enviando ${itemsToPatch.length} produtos faltantes para a API VMPay em ${instName}...`);
          
          // Enviar em blocos de 100 para evitar payload gigante ou limite da API
          const chunkSize = 100;
          for (let i = 0; i < itemsToPatch.length; i += chunkSize) {
            const chunk = itemsToPatch.slice(i, i + chunkSize);
            await patchApi(`/machines/${m.id}/installations/${m.installation.id}/current_planogram`, {
              planogram: {
                items_attributes: chunk
              }
            });
            log(`    Enviado lote de ${chunk.length} produtos.`);
          }
        } else {
          log(`  Nenhum produto faltante em ${instName}.`);
        }
      } catch (e: any) {
         log(`Falha ao processar planograma da instalação ${m.installation.id}: ${e.message}`);
      }
      await wait(300);
    }
  }

  log(`Processo finalizado com sucesso! Total de itens enviados à API VMPay: ${addedCount}`);
  log("Os planogramas no banco de dados local serão atualizados automaticamente na próxima execução da rotina 'sync_vmpay'.");
  process.exit(0);
}

fillPlanograms().catch(e => {
  console.error(e);
  process.exit(1);
});
