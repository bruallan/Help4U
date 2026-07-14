const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const oldCode = `    const { quantidadeAtual, dataValidade } = req.body;
    const result = await db.update(lotesEstoque)
      .set({ 
        quantidadeAtual: parseInt(quantidadeAtual, 10),
        dataValidade: new Date(dataValidade)
      })`;

const newCode = `    const { quantidadeAtual, dataValidade, status } = req.body;
    const updateData: any = {};
    if (quantidadeAtual !== undefined) updateData.quantidadeAtual = quantidadeAtual === null ? null : parseInt(quantidadeAtual, 10);
    if (dataValidade !== undefined) updateData.dataValidade = dataValidade ? new Date(dataValidade) : null;
    if (status !== undefined) updateData.status = status;

    const result = await db.update(lotesEstoque)
      .set(updateData)`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('api/index.ts', code);
