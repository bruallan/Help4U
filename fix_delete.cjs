const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const regex = /app\.put\("\/api\/lotes\/:id", async \(req, res\) => \{[\s\S]*?\}\);\n800-.*?\n.*?app\.delete\("\/api\/lotes\/:id", async \(req, res\) => \{[\s\S]*?\}\);\n  \}\n\}\);/m;

// wait, let's just do a string replacement of the specific botched block:
const search = `app.put("/api/lotes/:id", async (req, res) => {
  try {
    const { quantidadeAtual, dataValidade, status } = req.body;
    const updateData: any = {};
    if (quantidadeAtual !== undefined) updateData.quantidadeAtual = quantidadeAtual === null ? null : parseInt(quantidadeAtual, 10);
    if (dataValidade !== undefined) updateData.dataValidade = dataValidade ? new Date(dataValidade) : null;
    if (status !== undefined) updateData.status = status;

    const result = await db.update(lotesEstoque)
      .set(updateData)
      .where(eq(lotesEstoque.idLote, parseInt(req.params.id, 10)))
      .returning();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });

app.delete("/api/lotes/:id", async (req, res) => {
  try {
    const result = await db.delete(lotesEstoque)
      .where(eq(lotesEstoque.idLote, parseInt(req.params.id, 10)))
      .returning();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
  }
});`;

const replace = `app.put("/api/lotes/:id", async (req, res) => {
  try {
    const { quantidadeAtual, dataValidade, status } = req.body;
    const updateData: any = {};
    if (quantidadeAtual !== undefined) updateData.quantidadeAtual = quantidadeAtual === null ? null : parseInt(quantidadeAtual, 10);
    if (dataValidade !== undefined) updateData.dataValidade = dataValidade ? new Date(dataValidade) : null;
    if (status !== undefined) updateData.status = status;

    const result = await db.update(lotesEstoque)
      .set(updateData)
      .where(eq(lotesEstoque.idLote, parseInt(req.params.id, 10)))
      .returning();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/lotes/:id", async (req, res) => {
  try {
    const result = await db.delete(lotesEstoque)
      .where(eq(lotesEstoque.idLote, parseInt(req.params.id, 10)))
      .returning();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});`;

if (code.includes('app.delete("/api/lotes/:id"')) {
    // using a more flexible regex because spacing might differ slightly
    const blockRegex = /app\.put\("\/api\/lotes\/:id", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*app\.delete\("\/api\/lotes\/:id", async \(req, res\) => \{[\s\S]*?\}\);\s*\}\s*\}\);/g;
    
    code = code.replace(blockRegex, replace);
    fs.writeFileSync('api/index.ts', code);
    console.log("Fixed delete route");
} else {
    console.log("Not found");
}

