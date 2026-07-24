import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { dimPlanogramas, dimProdutos, dimInstalacoes } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';

dotenv.config();

const log = (msg: string) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

async function fillPlanograms() {
  log("Starting fill planograms script...");
  const produtos = await db.select().from(dimProdutos);
  const instalacoes = await db.select().from(dimInstalacoes);
  const planogramas = await db.select().from(dimPlanogramas);
  
  // Create a map of installation -> Set of product IDs currently in planogram
  const planMap = new Map<number, Set<number>>();
  planogramas.forEach(p => {
    if (p.idProduto) {
      if (!planMap.has(p.instalacaoId)) planMap.set(p.instalacaoId, new Set());
      planMap.get(p.instalacaoId)!.add(p.idProduto);
    }
  });

  let addedCount = 0;
  let maxPlanItemId = 0;
  if (planogramas.length > 0) {
    maxPlanItemId = Math.max(...planogramas.map(p => p.planItemId));
  }

  // To group by installation, we might need a generic planId. 
  // Let's get the planId for each installation from existing planogram items.
  const instalacaoPlanIdMap = new Map<number, number>();
  planogramas.forEach(p => {
    if (!instalacaoPlanIdMap.has(p.instalacaoId) && p.planId) {
      instalacaoPlanIdMap.set(p.instalacaoId, p.planId);
    }
  });

  const newRows: any[] = [];
  
  for (const instalacao of instalacoes) {
    const existingProductIds = planMap.get(instalacao.instalacaoId) || new Set<number>();
    const planId = instalacaoPlanIdMap.get(instalacao.instalacaoId) || 0; // fallback
    
    for (const produto of produtos) {
      if (!existingProductIds.has(produto.id)) {
        // Missing!
        maxPlanItemId++;
        const cost = produto.precoCusto || 0;
        const exactSuggestedPrice = cost / 0.58;
        const suggestedPrice = Math.max(0, parseFloat((Math.ceil(exactSuggestedPrice * 10) / 10 - 0.01).toFixed(2)));

        newRows.push({
          planItemId: maxPlanItemId,
          instalacaoId: instalacao.instalacaoId,
          instalacao: instalacao.instalacao,
          planId: planId,
          idProduto: produto.id,
          produto: produto.produto,
          saldo: 0,
          nivelPar: 10, // Default
          nivelAlerta: 3, // Default
          usarNivelMinimo: false,
          nivelMinimo: 0,
          preco: suggestedPrice,
          usaPrecoPadrao: false,
          precoPromocao: 0,
          status: 'ativo',
        });
        addedCount++;
      }
    }
  }

  if (newRows.length > 0) {
    // Insert in chunks of 1000
    for (let i = 0; i < newRows.length; i += 1000) {
      const chunk = newRows.slice(i, i + 1000);
      await db.insert(dimPlanogramas).values(chunk);
    }
  }

  log(`Added ${addedCount} missing products to planograms.`);
  process.exit(0);
}

fillPlanograms().catch(e => {
  console.error(e);
  process.exit(1);
});
