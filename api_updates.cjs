const fs = require('fs');

let code = fs.readFileSync('api/index.ts', 'utf8');

const newEndpoints = `
// --- Sync Lotes vs VMPay Endpoints ---

// Editar Lote
app.put("/api/lotes/:id", async (req, res) => {
  try {
    const { quantidadeAtual, dataValidade } = req.body;
    const result = await db.update(lotesEstoque)
      .set({ 
        quantidadeAtual: parseInt(quantidadeAtual, 10),
        dataValidade: new Date(dataValidade)
      })
      .where(eq(lotesEstoque.idLote, parseInt(req.params.id, 10)))
      .returning();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sync VM Pay -> DB (Atualizar Lotes baseado no VMPay)
// Se houver mais lotes do que no VMPay, remove dos mais antigos (FEFO).
// Se houver menos, adiciona a diferenca no lote mais novo existente (ou cria um sem validade).
app.post("/api/sync/vmpay-to-db", async (req, res) => {
  try {
    const { produtoIds } = req.body; // array de nomes ou IDs. Vamos usar nomes por simplicidade baseado no AlertasEstoque.
    
    // Simplificacao: O AlertasEstoque passa os nomes dos produtos
    for (const prodName of produtoIds) {
       // Buscar o produto
       const pResult = await db.select().from(dimProdutos).where(eq(dimProdutos.produto, prodName)).limit(1);
       if (pResult.length === 0) continue;
       const p = pResult[0];
       
       const qtdVMPay = p.quantidadeEstoque || 0;
       
       const lotes = await db.select().from(lotesEstoque)
         .where(eq(lotesEstoque.produto, prodName))
         .orderBy(asc(lotesEstoque.dataValidade));
         
       let sumLotes = lotes.reduce((acc, l) => acc + (l.quantidadeAtual || 0), 0);
       
       if (sumLotes > qtdVMPay) {
         // Remover excedente dos mais antigos
         let toRemove = sumLotes - qtdVMPay;
         for (const lote of lotes) {
           if (toRemove <= 0) break;
           const removeQtd = Math.min(lote.quantidadeAtual || 0, toRemove);
           await db.update(lotesEstoque)
             .set({ quantidadeAtual: (lote.quantidadeAtual || 0) - removeQtd })
             .where(eq(lotesEstoque.idLote, lote.idLote));
           toRemove -= removeQtd;
         }
       } else if (sumLotes < qtdVMPay) {
         // Adicionar falta no mais novo
         let toAdd = qtdVMPay - sumLotes;
         if (lotes.length > 0) {
           const newestLote = lotes[lotes.length - 1];
           await db.update(lotesEstoque)
             .set({ quantidadeAtual: (newestLote.quantidadeAtual || 0) + toAdd })
             .where(eq(lotesEstoque.idLote, newestLote.idLote));
         } else {
           // Criar lote novo sem validade (placeholder)
           await db.insert(lotesEstoque).values({
             produtoId: p.id,
             produto: p.produto,
             dataValidade: new Date(2100, 0, 1), // Lote ficticio para ajustar saldo
             quantidadeAtual: toAdd,
             instalacaoId: null
           });
         }
       }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sync DB -> VM Pay (Atualizar VMPay baseado nos Lotes)
app.post("/api/sync/db-to-vmpay", async (req, res) => {
  try {
    const { produtoIds } = req.body;
    
    // Isso deve ser um proxy para a API do VMPay para ajustar estoque.
    // Como nao temos a documentacao exata do endpoint de ajuste do VMPay, 
    // faremos um mock de logica que apenas atualiza o banco de dados dim_produtos para refletir.
    // O correto seria: fetch("https://vmpay.../adjust")
    
    for (const prodName of produtoIds) {
       const pResult = await db.select().from(dimProdutos).where(eq(dimProdutos.produto, prodName)).limit(1);
       if (pResult.length === 0) continue;
       const p = pResult[0];
       
       const lotes = await db.select().from(lotesEstoque).where(eq(lotesEstoque.produto, prodName));
       let sumLotes = lotes.reduce((acc, l) => acc + (l.quantidadeAtual || 0), 0);
       
       // Mock update in our DB
       await db.update(dimProdutos)
         .set({ quantidadeEstoque: sumLotes })
         .where(eq(dimProdutos.id, p.id));
         
       // O IDEAL É ENVIAR REQUISIÇÃO PARA VMPAY AQUI:
       // fetch(BASE_URL + "/api/v1/stock_adjustments", { method: "POST", body: ... })
    }
    
    res.json({ success: true, warning: "Atualizado no banco local. Endpoint real da VMPay de ajuste precisa ser configurado." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Cron Job Route para atualizar validades e reduzir estoques velhos diariamente
app.post("/api/cron/fefo-sync", async (req, res) => {
  try {
    // Para cada produto, verificar saldo total dim_produtos vs lotes globais
    // e aplicar FEFO (remover lotes velhos se saldo < lotes)
    const produtos = await db.select().from(dimProdutos);
    for (const p of produtos) {
       const qtdVMPay = p.quantidadeEstoque || 0;
       const lotes = await db.select().from(lotesEstoque)
         .where(eq(lotesEstoque.produtoId, p.id))
         .orderBy(asc(lotesEstoque.dataValidade));
         
       let sumLotes = lotes.reduce((acc, l) => acc + (l.quantidadeAtual || 0), 0);
       
       if (sumLotes > qtdVMPay) {
         let toRemove = sumLotes - qtdVMPay;
         for (const lote of lotes) {
           if (toRemove <= 0) break;
           const removeQtd = Math.min(lote.quantidadeAtual || 0, toRemove);
           await db.update(lotesEstoque)
             .set({ quantidadeAtual: (lote.quantidadeAtual || 0) - removeQtd })
             .where(eq(lotesEstoque.idLote, lote.idLote));
           toRemove -= removeQtd;
         }
       }
       
       // Atualiza a validade vigente nos mercados
       const planogramas = await db.select().from(dimPlanogramas).where(eq(dimPlanogramas.idProduto, p.id));
       for (const plano of planogramas) {
          const mktLotes = await db.select().from(lotesEstoque)
            .where(and(
              eq(lotesEstoque.produtoId, p.id),
              eq(lotesEstoque.instalacaoId, plano.instalacaoId),
              gt(lotesEstoque.quantidadeAtual, 0)
            ))
            .orderBy(asc(lotesEstoque.dataValidade))
            .limit(1);
            
          if (mktLotes.length > 0) {
            await db.update(dimPlanogramas)
              .set({ validade: mktLotes[0].dataValidade })
              .where(eq(dimPlanogramas.id, plano.id));
          } else {
            await db.update(dimPlanogramas)
              .set({ validade: null })
              .where(eq(dimPlanogramas.id, plano.id));
          }
       }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('export default app;', newEndpoints + '\nexport default app;');
fs.writeFileSync('api/index.ts', code);
