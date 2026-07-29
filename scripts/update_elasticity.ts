import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { elasticityTests, fatoVendas } from '../src/db/schema.js';
import { eq, lte, and, inArray } from 'drizzle-orm';

dotenv.config();
const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const BASE_URL = "https://vmpay.vertitecnologia.com.br";

async function run() {
  console.log("Checking for elasticity tests to transition...");
  const now = new Date();
  
  const endedB = await db.select().from(elasticityTests)
    .where(and(eq(elasticityTests.status, 'running_B'), lte(elasticityTests.dateBEnd, now)));
    
  for (const t of endedB) {
    console.log(`Test ${t.id} finished phase B. Calculating optimal price...`);
    
    const volB = (t.volA || 50) * 0.7; // volume dropped 30% mock
    const marginB = (t.marginA || 200) * 0.9; // margin dropped 10% mock
    
    const pA = t.priceA || 10;
    const pB = t.priceB || 12;
    const mA = t.marginA || 200;
    const mB = marginB;
    const vA = t.volA || 50;
    const vB = volB;
    
    // Custo deduzido
    const C = pA - (mA / vA);
    const overhead = 0.0;
    
    // 1. Elasticidade
    const deltaV = (vB - vA) / vA;
    const deltaP = (pB - pA) / pA;
    const E = deltaV / deltaP;
    
    let pOpt = pA;
    let mOptProj = mA;
    
    if (E < 0) {
      // Preço Ótimo (fórmula da planilha)
      pOpt = (pA * (E - 1) * (1 - overhead) + (E * C)) / (2 * E * (1 - overhead));
      const vOpt = vA * (1 + (E * ((pOpt - pA) / pA)));
      mOptProj = (pOpt - C - (pOpt * overhead)) * vOpt;
    } else {
      if (mB > mA) {
         pOpt = pB;
         mOptProj = mB;
      }
    }
    
    await fetch(`${BASE_URL}/api/v1/products/${t.productId}?access_token=${VMPAY_API_KEY}`, {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
          product: {
              tags: ["IMPULSO", `teste_O_${pOpt.toFixed(2)}`]
          }
       })
    });

    await db.update(elasticityTests).set({
      status: 'validating_opt',
      volB: vB,
      marginB: mB,
      priceOpt: pOpt,
      expectedMarginOpt: mOptProj,
      elasticityCoef: E
    }).where(eq(elasticityTests.id, t.id));
  }
  
  console.log("Done.");
  process.exit(0);
}

run();
