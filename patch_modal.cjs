const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const modalStart = '{editingLoteProduto && (';
const modalEndStr = '        </div>\n      )}';
// Let's find the second modalEndStr after modalStart
const startIndex = code.indexOf(modalStart);
let endIndex = code.indexOf(modalEndStr, startIndex);
if (endIndex !== -1) {
  endIndex += modalEndStr.length;
}

const newModalCode = `
      {editingLoteProduto && (() => {
        const row = tableData.find((r: any) => r.sku === editingLoteProduto) || {} as any;
        const pDB = produtosDB.find(p => p.produto === editingLoteProduto);
        const lotesProd = lotesConsolidados.filter((l: any) => l.produto === editingLoteProduto && l.quantidadeAtual > 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                <div className="pr-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1">
                    {editingLoteProduto}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {row.isHighTurnover && (
                       <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold">Giro Alto/Médio</span>
                    )}
                    {row.isRisk && (
                       <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">Risco Identificado</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setEditingLoteProduto(null); setEditLoteId(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 space-y-6">
                
                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">QTD a Vencer</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{row.qty || 0}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">VMD</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{row.vmd?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Dias para Vencer (DPV)</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{row.dpv > 0 ? \`\${row.dpv} d\` : "Vencido"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tempo Esgotamento (TE)</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{row.te === Infinity ? "∞" : \`\${row.te?.toFixed(1) || 0} d\`}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Risco (IR)</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-base">{row.ir === Infinity ? "∞" : row.ir?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="col-span-1 sm:col-span-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ação Sugerida</p>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{row.actionRoute || "Nenhuma ação imediata"}</p>
                  </div>
                </div>

                {/* Lotes Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Lotes Ativos
                    </h4>
                    <button
                      onClick={() => {
                        setInboundData({ produto: editingLoteProduto, produtoId: pDB?.id || 0, qty: 1 });
                        setInboundDate("");
                      }}
                      className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 px-2 py-1.5 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Novo Lote
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                      <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">ID Lote</th>
                          <th className="px-4 py-3">Validade</th>
                          <th className="px-4 py-3">Qtd</th>
                          <th className="px-4 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotesProd.map((lote: any) => (
                          <tr key={lote.idLote} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">#{lote.idLote} {lote.instalacaoId ? '(Mercado)' : '(Depósito)'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editLoteId === lote.idLote ? (
                                 <input type="date" value={editLoteDate} onChange={e => setEditLoteDate(e.target.value)} className="bg-white border border-slate-200 text-slate-900 text-sm rounded-md p-1.5 dark:bg-slate-950 dark:border-slate-700 dark:text-white [color-scheme:light_dark]" />
                              ) : (
                                 new Date(lote.dataValidade).toLocaleDateString('pt-BR')
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editLoteId === lote.idLote ? (
                                 <input type="number" min="0" value={editLoteQty} onChange={e => setEditLoteQty(e.target.value)} className="w-20 bg-white border border-slate-200 text-slate-900 text-sm rounded-md p-1.5 dark:bg-slate-950 dark:border-slate-700 dark:text-white font-mono [color-scheme:light_dark]" />
                              ) : (
                                 <span className="font-mono">{lote.quantidadeAtual}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {editLoteId === lote.idLote ? (
                                <div className="flex justify-end gap-2">
                                   <button onClick={() => saveLoteEdit(lote.idLote)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save className="w-4 h-4"/></button>
                                   <button onClick={() => setEditLoteId(null)} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><X className="w-4 h-4"/></button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditLoteId(lote.idLote); setEditLoteQty(lote.quantidadeAtual.toString()); setEditLoteDate(lote.dataValidade.split('T')[0]); }} className="p-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                                   <Edit2 className="w-4 h-4"/>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {lotesProd.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum lote com saldo encontrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}
`;

if (startIndex !== -1 && endIndex !== -1) {
  const codeBefore = code.slice(0, startIndex);
  const codeAfter = code.slice(endIndex);
  code = codeBefore + newModalCode + codeAfter;
  fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
  console.log("Modal replaced");
} else {
  console.log("Could not find modal boundaries.", startIndex, endIndex);
}
