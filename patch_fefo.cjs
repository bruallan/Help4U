const fs = require('fs');

let code = fs.readFileSync('api/index.ts', 'utf8');

if (!code.includes('/api/fefo/vendas')) {
  const imports = `import { eq, and, asc, isNull, gt } from "drizzle-orm";\n`;
  code = code.replace('import { eq } from "drizzle-orm";', imports);

  const fefoCode = `
// --- FEFO Logic Endpoints ---

// 1. Processar Abastecimento (Transferência Depósito -> Mercado)
app.post("/api/fefo/abastecimento", async (req, res) => {
  try {
    const { movimentacoes } = req.body; 
    // movimentacoes: [{ produtoId: 1, quantidade: 10, instalacaoId: 2 }]
    
    for (const mov of movimentacoes) {
      if (!mov.produtoId || !mov.quantidade || !mov.instalacaoId) continue;
      
      let remainingToTransfer = mov.quantidade;
      
      // Encontrar lotes do produto no Depósito (instalacaoId IS NULL) ordenados por dataValidade ASC (FEFO)
      const lotes = await db.select().from(lotesEstoque)
        .where(and(eq(lotesEstoque.produtoId, mov.produtoId), isNull(lotesEstoque.instalacaoId)))
        .orderBy(asc(lotesEstoque.dataValidade));
        
      for (const lote of lotes) {
        if (remainingToTransfer <= 0) break;
        if (!lote.quantidadeAtual || lote.quantidadeAtual <= 0) continue;
        
        const transferQty = Math.min(lote.quantidadeAtual, remainingToTransfer);
        
        // Reduz do depósito
        const novaQtdDeposito = lote.quantidadeAtual - transferQty;
        await db.update(lotesEstoque)
          .set({ quantidadeAtual: novaQtdDeposito })
          .where(eq(lotesEstoque.idLote, lote.idLote));
          
        // Cria ou adiciona ao lote do Mercado
        const result = await db.select().from(lotesEstoque)
          .where(and(
            eq(lotesEstoque.produtoId, mov.produtoId), 
            eq(lotesEstoque.instalacaoId, mov.instalacaoId),
            eq(lotesEstoque.dataValidade, lote.dataValidade)
          )).limit(1);
          
        const loteMercado = result.length > 0 ? result[0] : null;
          
        if (loteMercado) {
          await db.update(lotesEstoque)
            .set({ quantidadeAtual: (loteMercado.quantidadeAtual || 0) + transferQty })
            .where(eq(lotesEstoque.idLote, loteMercado.idLote));
        } else {
          await db.insert(lotesEstoque).values({
            produtoId: mov.produtoId,
            produto: lote.produto,
            dataValidade: lote.dataValidade,
            quantidadeAtual: transferQty,
            instalacaoId: mov.instalacaoId
          });
        }
        
        remainingToTransfer -= transferQty;
      }
      
      // Atualiza a validade vigente no dim_planogramas para os mercados afetados
      const resultRestante = await db.select().from(lotesEstoque)
        .where(and(
           eq(lotesEstoque.produtoId, mov.produtoId), 
           eq(lotesEstoque.instalacaoId, mov.instalacaoId),
           gt(lotesEstoque.quantidadeAtual, 0)
        ))
        .orderBy(asc(lotesEstoque.dataValidade))
        .limit(1);
        
      const oldestLoteRestante = resultRestante.length > 0 ? resultRestante[0] : null;
        
      if (oldestLoteRestante) {
        await db.update(dimPlanogramas)
          .set({ validade: oldestLoteRestante.dataValidade })
          .where(and(
             eq(dimPlanogramas.idProduto, mov.produtoId),
             eq(dimPlanogramas.instalacaoId, mov.instalacaoId)
          ));
      }
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Processar Vendas (Baixa no Mercado)
app.post("/api/fefo/vendas", async (req, res) => {
  try {
    const { vendas } = req.body;
    // vendas: [{ produtoId: 1, quantidade: 2, instalacaoId: 2 }]
    
    for (const venda of vendas) {
      if (!venda.produtoId || !venda.quantidade || !venda.instalacaoId) continue;
      
      let remainingToDeduct = venda.quantidade;
      
      // Encontrar lotes do produto no Mercado ordenados por dataValidade ASC (FEFO)
      const lotes = await db.select().from(lotesEstoque)
        .where(and(eq(lotesEstoque.produtoId, venda.produtoId), eq(lotesEstoque.instalacaoId, venda.instalacaoId)))
        .orderBy(asc(lotesEstoque.dataValidade));
        
      for (const lote of lotes) {
        if (remainingToDeduct <= 0) break;
        if (!lote.quantidadeAtual || lote.quantidadeAtual <= 0) continue;
        
        const deductQty = Math.min(lote.quantidadeAtual, remainingToDeduct);
        const novaQtdMercado = lote.quantidadeAtual - deductQty;
        
        await db.update(lotesEstoque)
          .set({ quantidadeAtual: novaQtdMercado })
          .where(eq(lotesEstoque.idLote, lote.idLote));
          
        remainingToDeduct -= deductQty;
      }
      
      // Encontra a validade mais próxima restante para esse produto nesse mercado
      const resultRestante = await db.select().from(lotesEstoque)
        .where(and(
           eq(lotesEstoque.produtoId, venda.produtoId), 
           eq(lotesEstoque.instalacaoId, venda.instalacaoId),
           gt(lotesEstoque.quantidadeAtual, 0)
        ))
        .orderBy(asc(lotesEstoque.dataValidade))
        .limit(1);
        
      const oldestLoteRestante = resultRestante.length > 0 ? resultRestante[0] : null;
        
      if (oldestLoteRestante) {
        await db.update(dimPlanogramas)
          .set({ validade: oldestLoteRestante.dataValidade })
          .where(and(
             eq(dimPlanogramas.idProduto, venda.produtoId),
             eq(dimPlanogramas.instalacaoId, venda.instalacaoId)
          ));
      } else {
        await db.update(dimPlanogramas)
          .set({ validade: null })
          .where(and(
             eq(dimPlanogramas.idProduto, venda.produtoId),
             eq(dimPlanogramas.instalacaoId, venda.instalacaoId)
          ));
      }
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;

  code = code.replace('export default app;', fefoCode + '\nexport default app;');
  fs.writeFileSync('api/index.ts', code);
}
