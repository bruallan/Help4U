const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const regex = /app\.post\("\/api\/sync\/db-to-vmpay", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \}\);\n  \}\n\}\);/;

const replacement = `app.post("/api/sync/db-to-vmpay", async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const { produtoIds } = req.body;
    for (const prodName of produtoIds) {
       const pResult = await db.select().from(dimProdutos).where(eq(dimProdutos.produto, prodName)).limit(1);
       if (pResult.length === 0) continue;
       const p = pResult[0];
       const lotes = await db.select().from(lotesEstoque).where(eq(lotesEstoque.produto, prodName));
       let sumLotes = lotes.reduce((acc, l) => acc + (l.quantidadeAtual || 0), 0);
       
       const vmpayRes = await fetch(\`\${BASE_URL}/api/v1/storables/\${p.id}?access_token=\${ACCESS_TOKEN}\`);
       if (vmpayRes.ok) {
           const storableData = await vmpayRes.json();
           const dcInventory = storableData.inventories?.[0];
           if (dcInventory) {
               const dcId = dcInventory.distribution_center_id;
               const currentTotal = dcInventory.total_quantity;
               const delta = sumLotes - currentTotal;
               
               if (delta !== 0) {
                   await fetch(\`\${BASE_URL}/api/v1/storables/\${p.id}?access_token=\${ACCESS_TOKEN}\`, {
                       method: 'PATCH',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                           storable: {
                               inventories: [{
                                   distribution_center_id: dcId,
                                   quantity_delta: delta
                               }]
                           }
                       })
                   });
               }
           }
       }
       
       await db.update(dimProdutos).set({ quantidadeEstoque: sumLotes }).where(eq(dimProdutos.id, p.id));
    }
    res.json({ success: true, message: "Ajuste Banco de Dados -> VM Pay enviado com sucesso!" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('api/index.ts', code);
   console.log("Patched db-to-vmpay");
} else {
   console.log("Not found db-to-vmpay");
}
