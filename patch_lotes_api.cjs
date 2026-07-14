const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const oldCode = `    const { produtoId, produto, dataValidade, quantidadeAtual } = req.body;
    const [newLote] = await db
      .insert(lotesEstoque)
      .values({
        produtoId: produtoId ? parseInt(produtoId, 10) : null,
        produto,
        dataValidade: new Date(dataValidade),
        quantidadeAtual: parseInt(quantidadeAtual, 10),
      })`;

const newCode = `    const { produtoId, produto, dataValidade, quantidadeAtual, status } = req.body;
    const [newLote] = await db
      .insert(lotesEstoque)
      .values({
        produtoId: produtoId ? parseInt(produtoId, 10) : null,
        produto,
        dataValidade: dataValidade ? new Date(dataValidade) : null,
        quantidadeAtual: quantidadeAtual ? parseInt(quantidadeAtual, 10) : null,
        status: status || 'consolidado',
      })`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('api/index.ts', code);
