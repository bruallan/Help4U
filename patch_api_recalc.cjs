const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

const recalcRoute = `
app.post("/api/elasticity/:id/recalculate", async (req, res) => {
   try {
     const { id } = req.params;
     const testResults = await db.select().from(elasticityTests).where(eq(elasticityTests.id, id)).limit(1);
     if (testResults.length === 0) return res.status(404).json({ error: "Teste não encontrado" });
     const t = testResults[0];

     if (!t.priceA || !t.volA || !t.priceB || !t.volB) {
        return res.status(400).json({ error: "Faltam dados de A ou B para recalcular." });
     }

     const pA = t.priceA;
     const vA = t.volA;
     const pB = t.priceB;
     const vB = t.volB;
     const mA = t.marginA || (pA * vA * 0.3); // mock margin if null

     // Custo total deduzido da margem (assumindo Overhead = 0)
     const C = pA - (mA / vA);
     const overhead = 0.0; // 0% default como não temos isso no banco ainda

     // 1. Elasticidade
     const deltaV = (vB - vA) / vA;
     const deltaP = (pB - pA) / pA;
     const E = deltaV / deltaP;

     let pOpt = pA;
     let mOptProj = mA;

     if (E < 0) {
        // Preço Ótimo = (P_A * (E - 1) * (1 - Overhead) + E * Custo) / (2 * E * (1 - Overhead))
        pOpt = (pA * (E - 1) * (1 - overhead) + (E * C)) / (2 * E * (1 - overhead));
        
        // Volume Projetado: V_O = V_A * (1 + E * ((P_O - P_A) / P_A))
        const vOpt = vA * (1 + (E * ((pOpt - pA) / pA)));
        
        // Lucro Projetado: L_O = (P_O - C - P_O * Overhead) * V_O
        mOptProj = (pOpt - C - (pOpt * overhead)) * vOpt;
     } else {
        // Inelástico ou anômalo
        if ((t.marginB || 0) > mA) {
            pOpt = pB;
            mOptProj = t.marginB || 0;
        }
     }

     await db.update(elasticityTests).set({ 
        status: 'validating_opt',
        priceOpt: pOpt,
        expectedMarginOpt: mOptProj,
        elasticityCoef: E
     }).where(eq(elasticityTests.id, id));

     res.json({ success: true, pOpt, E });
   } catch (e: any) {
     res.status(500).json({ error: e.message });
   }
});
`;

code = code.replace(
  /app\.post\("\/api\/elasticity\/:id\/recalculate", async \(req, res\) => \{[\s\S]*?\}\);/,
  recalcRoute.trim()
);

fs.writeFileSync('api/index.ts', code);
