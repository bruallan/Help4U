const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const replacement = `
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
`;

if (code.includes('app.put("/api/lotes/:id"')) {
   code = code.replace(/app\.put\("\/api\/lotes\/:id", async \(req, res\) => \{[\s\S]*?\}\);\n/, match => match + replacement);
   fs.writeFileSync('api/index.ts', code);
   console.log("Patched delete");
} else {
   console.log("Not found put");
}
