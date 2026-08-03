const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

const replacement = `app.get("/api/barcode/:code", async (req, res) => {
  try {
    const code = req.params.code;
    
    // 1. Try checking dimProdutos directly
    const prodDirect = await db
      .select()
      .from(dimProdutos)
      .where(eq(dimProdutos.codigoBarras, code))
      .limit(1);
      
    if (prodDirect.length > 0) {
      return res.json(prodDirect[0]);
    }
    
    // 2. Try checking dimCodigosDeBarra (Principal)
    const result = await db
      .select()
      .from(dimCodigosDeBarra)
      .where(eq(dimCodigosDeBarra.codigoPrincipal, code))
      .limit(1);

    if (result.length > 0) {
      const idProduto = result[0].idProduto;
      const prodResult = await db
        .select()
        .from(dimProdutos)
        .where(eq(dimProdutos.id, idProduto))
        .limit(1);

      if (prodResult.length > 0) {
        return res.json(prodResult[0]);
      }
    }

    // 3. Try checking dimCodigosDeBarra (Adicional)
    const result2 = await db
      .select()
      .from(dimCodigosDeBarra)
      .where(eq(dimCodigosDeBarra.codigoAdicional, code))
      .limit(1);

    if (result2.length > 0) {
      const idProduto = result2[0].idProduto;
      const prodResult = await db
        .select()
        .from(dimProdutos)
        .where(eq(dimProdutos.id, idProduto))
        .limit(1);

      if (prodResult.length > 0) {
        return res.json(prodResult[0]);
      }
    }

    res.status(404).json({ error: "Barcode not found" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});`;

code = code.replace(
  /app\.get\("\/api\/barcode\/:code", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \}\);\n  \}\n\}\);/,
  replacement
);

fs.writeFileSync('api/index.ts', code);
