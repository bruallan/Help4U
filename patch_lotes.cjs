const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const regex = /app\.post\("\/api\/lotes", async \(req, res\) => \{[\s\S]*?status: status \|\| 'consolidado',/g;
const replacement = `app.post("/api/lotes", async (req, res) => {
  try {
    const { produtoId, produto, dataValidade, quantidadeAtual, status, fornecedor } = req.body;
    const [newLote] = await db
      .insert(lotesEstoque)
      .values({
        produtoId: produtoId ? parseInt(produtoId, 10) : null,
        produto,
        dataValidade: dataValidade ? new Date(dataValidade) : null,
        quantidadeAtual: quantidadeAtual ? parseInt(quantidadeAtual, 10) : null,
        status: status || 'consolidado',
        fornecedor: fornecedor || null,`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('api/index.ts', code);
   console.log("Patched lotes POST");
} else {
   console.log("Not found lotes POST");
}
