const fs = require('fs');

let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const riskCode = `
  const riskWarning = useMemo(() => {
    if (!modalProduto || !modalDataValidade || !modalQuantidade) return null;
    
    const metric = skuMetrics.map.get(modalProduto);
    if (!metric) return null;
    
    let globalMin = new Date(8640000000000000);
    let globalMax = new Date(-8640000000000000);
    for (const row of rawData) {
      if (row.dayDate < globalMin) globalMin = row.dayDate;
      if (row.dayDate > globalMax) globalMax = row.dayDate;
    }
    const maxDays = Math.max(1, (globalMax.getTime() - globalMin.getTime()) / 86400000);
    const vmd = metric.volume / maxDays;
    
    if (vmd === 0) return null;
    
    const prodDb = produtosDB.find((p) => p.produto === modalProduto);
    const totalEstoque = prodDb?.quantidadeEstoque || 0;
    
    const novoTotal = totalEstoque + Number(modalQuantidade);
    const daysToSell = novoTotal / vmd;
    
    const expiryDate = new Date(modalDataValidade);
    const today = new Date();
    const daysToExpiry = (expiryDate.getTime() - today.getTime()) / 86400000;
    
    if (daysToSell > daysToExpiry * 0.9) {
      return {
        vmd: vmd.toFixed(2),
        daysToSell: Math.ceil(daysToSell),
        daysToExpiry: Math.ceil(daysToExpiry),
        novoTotal
      };
    }
    
    return null;
  }, [modalProduto, modalDataValidade, modalQuantidade, skuMetrics, produtosDB, rawData]);
`;

code = code.replace(
  '  // Modal state',
  riskCode + '\n  // Modal state'
);

const warningUI = `
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={modalQuantidade}
                  onChange={(e) => setModalQuantidade(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>

              {riskWarning && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800 dark:text-red-300">
                      <strong>Alto Risco de Vencimento!</strong><br />
                      Velocidade de vendas (VMD): {riskWarning.vmd} un/dia.<br />
                      Total no estoque passará a ser {riskWarning.novoTotal} un.<br />
                      Tempo estimado para vender tudo: <strong>{riskWarning.daysToSell} dias</strong>.<br />
                      O lote vence em <strong>{riskWarning.daysToExpiry} dias</strong>.
                    </div>
                  </div>
                </div>
              )}
`;

code = code.replace(
  `              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={modalQuantidade}
                  onChange={(e) => setModalQuantidade(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>`,
  warningUI
);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
