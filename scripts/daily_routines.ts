import { db } from "../src/db/index";
import { dimProdutos, dimPlanogramas, dimInstalacoes, fatoVendas } from "../src/db/schema";
import { eq, gt } from "drizzle-orm";
import nodemailer from "nodemailer";

const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const BASE_URL = 'https://api.vmpay.com.br';
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchApi(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${BASE_URL}/api/v1${endpoint}`);
  url.searchParams.append('access_token', VMPAY_API_KEY as string);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  let retries = 0;
  while (retries < 3) {
    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return await res.json();
    } catch (e: any) {
      retries++;
      await wait(2000 * retries);
    }
  }
  throw new Error(`Failed to fetch ${endpoint} after 3 retries.`);
}

async function patchApi(endpoint: string, body: any) {
  const url = new URL(`${BASE_URL}/api/v1${endpoint}`);
  url.searchParams.append('access_token', VMPAY_API_KEY as string);

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }

  return res.json();
}

async function sendEmail(subject: string, text: string) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.log("No SMTP credentials configured. Email not sent.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Assuming Gmail
    port: 465,
    secure: true,
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD
    }
  });

  try {
    await transporter.sendMail({
      from: `"VMPay Automations" <${SMTP_EMAIL}>`,
      to: SMTP_EMAIL,
      subject,
      text
    });
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function routine1_defaultPrices(planograms: any[]) {
  console.log("Routine 1: Updating default prices...");
  const productsMap = new Map<number, Set<number>>();
  planograms.forEach(p => {
    if (p.idProduto && p.preco !== null) {
      if (!productsMap.has(p.idProduto)) productsMap.set(p.idProduto, new Set());
      productsMap.get(p.idProduto)!.add(p.preco);
    }
  });

  let count = 0;
  for (const [idProduto, prices] of productsMap.entries()) {
    if (prices.size === 1) {
      const precoPadrao = Array.from(prices)[0];
      await db.update(dimProdutos)
        .set({ precoPadrao })
        .where(eq(dimProdutos.id, idProduto));
      count++;
    }
  }
  console.log(`Updated precoPadrao for ${count} products.`);
}

async function routine2_missingProducts(planograms: any[]) {
  console.log("Routine 2: Adding missing products to planograms...");
  const allProducts = await db.select().from(dimProdutos);
  
  const planMap = new Map<number, Set<number>>();
  planograms.forEach(p => {
    if (!planMap.has(p.instalacaoId)) planMap.set(p.instalacaoId, new Set());
    if (p.idProduto) planMap.get(p.instalacaoId)!.add(p.idProduto);
  });

  const instalacoes = await db.select().from(dimInstalacoes);
  const instMap = new Map<number, typeof instalacoes[0]>();
  instalacoes.forEach(i => instMap.set(i.instalacaoId, i));

  const missingPricesWarns = new Set<string>();

  for (const [instalacaoId, productIds] of planMap.entries()) {
    const inst = instMap.get(instalacaoId);
    if (!inst) continue;

    const missingProducts = allProducts.filter(prod => !productIds.has(prod.id));
    if (missingProducts.length === 0) continue;

    let currentPlanogram;
    try {
      currentPlanogram = await fetchApi(`/machines/${inst.maquinaId}/installations/${inst.instalacaoId}/current_planogram`);
    } catch(e) {
      console.log(`Could not fetch planogram for inst ${inst.instalacaoId}`);
      continue;
    }
    
    if (!currentPlanogram || !currentPlanogram.items) continue;

    let maxLogicalLocator = 0;
    currentPlanogram.items.forEach((item: any) => {
      const ll = parseInt(item.logical_locator, 10);
      if (!isNaN(ll) && ll > maxLogicalLocator) maxLogicalLocator = ll;
    });

    const itemsToPatch = [];

    for (const prod of missingProducts) {
      const price = prod.precoPadrao || (prod.precoCusto ? prod.precoCusto / 0.60 : null);
      if (!price) {
        missingPricesWarns.add(`- Produto: ${prod.produto} (ID: ${prod.id}) não possui preço padrão nem preço de custo para calcular.`);
        continue;
      }
      maxLogicalLocator++;
      itemsToPatch.push({
        type: "Coil",
        good_id: prod.id,
        name: maxLogicalLocator.toString(),
        capacity: 10,
        par_level: 10,
        alert_level: 2,
        desired_price: Number(price.toFixed(2)),
        logical_locator: maxLogicalLocator.toString(),
        status: "active"
      });
    }

    if (itemsToPatch.length > 0) {
      // Chunk to max 100 items per request to avoid API issues just in case
      const chunkSize = 100;
      for (let i = 0; i < itemsToPatch.length; i += chunkSize) {
        const chunk = itemsToPatch.slice(i, i + chunkSize);
        try {
          await patchApi(`/machines/${inst.maquinaId}/installations/${inst.instalacaoId}/current_planogram`, {
            planogram: {
              items_attributes: chunk
            }
          });
          console.log(`Added ${chunk.length} items to inst ${inst.instalacaoId} (${inst.instalacao})`);
        } catch (e: any) {
          console.error(`Error patching inst ${inst.instalacaoId}:`, e.message);
        }
      }
    }
  }

  if (missingPricesWarns.size > 0) {
    const text = Array.from(missingPricesWarns).join('\n');
    await sendEmail('Alerta: Produtos Impossíveis de Precificar', text);
  }
}

async function routine3_salesVelocity(planograms: any[]) {
  console.log("Routine 3: Calculating sales velocity...");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const vendas = await db.select().from(fatoVendas).where(gt(fatoVendas.dataVenda, thirtyDaysAgo));

  const salesMap = new Map<string, { total: number, lastDate: Date }>();
  vendas.forEach(v => {
    if (!v.instalacao || !v.produtoId) return;
    const key = `${v.instalacao}_${v.produtoId}`;
    const qty = v.quantidade || 1;
    const existing = salesMap.get(key) || { total: 0, lastDate: new Date(0) };
    existing.total += qty;
    if (v.dataVenda && v.dataVenda > existing.lastDate) {
      existing.lastDate = v.dataVenda;
    }
    salesMap.set(key, existing);
  });

  let anamnesisEmailContent = "";
  const now = new Date();
  const updatePromises = [];

  for (const p of planograms) {
    if (!p.instalacao || !p.idProduto) continue;
    const key = `${p.instalacao}_${p.idProduto}`;
    const saleData = salesMap.get(key) || { total: 0, lastDate: null };
    
    const velocidadeMedia7d = (saleData.total / 30) * 7;
    
    updatePromises.push(
      db.update(dimPlanogramas)
        .set({ velocidadeMedia7d })
        .where(eq(dimPlanogramas.planItemId, p.planItemId))
    );
    
    // Process in chunks to avoid memory issues
    if (updatePromises.length >= 100) {
      await Promise.all(updatePromises);
      updatePromises.length = 0;
    }

    if (p.saldo && p.saldo > 0 && velocidadeMedia7d > 0.5) {
      const daysSinceLastSale = saleData.lastDate ? (now.getTime() - saleData.lastDate.getTime()) / (1000 * 3600 * 24) : 30;
      
      const expectedDaysForOne = 7 / velocidadeMedia7d;
      
      // If no sale in over 7 days AND takes > 2x expected time
      if (daysSinceLastSale > Math.max(7, expectedDaysForOne * 2)) {
        anamnesisEmailContent += `\nProduto: ${p.produto} (ID: ${p.idProduto}) | Mercado: ${p.instalacao}\n`;
        anamnesisEmailContent += `- Volume médio de vendas para 7 dias: ${velocidadeMedia7d.toFixed(1)} un\n`;
        anamnesisEmailContent += `- Saldo no mercado: ${p.saldo} un\n`;
        anamnesisEmailContent += `- Dias desde a última venda: ${Math.floor(daysSinceLastSale)} dias\n`;
        anamnesisEmailContent += `- Anamnese: Provavelmente não tem mais no mercado ou está com problema na leitura.\n`;
      }
    }
  }

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  if (anamnesisEmailContent.trim() !== "") {
    await sendEmail('Alerta: Produtos com Vendas Estagnadas (Análise Anamnese)', anamnesisEmailContent);
  }
}

async function main() {
  if (!VMPAY_API_KEY) {
    console.error("Missing VMPAY_API_KEY");
    process.exit(1);
  }
  try {
    const activePlanograms = await db.select().from(dimPlanogramas).where(eq(dimPlanogramas.status, 'active'));
    
    await routine1_defaultPrices(activePlanograms);
    await routine2_missingProducts(activePlanograms);
    await routine3_salesVelocity(activePlanograms);
    
    console.log("Daily routines completed successfully.");
    process.exit(0);
  } catch (e) {
    console.error("Routine failed:", e);
    process.exit(1);
  }
}

main();
