const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const regexTable = /<th className="px-4 py-3">ID Lote<\/th>\s*<th className="px-4 py-3">Validade<\/th>\s*<th className="px-4 py-3">Qtd<\/th>\s*<th className="px-4 py-3 text-right">Ação<\/th>/;

const replacementTable = `<th className="px-4 py-3">ID Lote</th>
                          <th className="px-4 py-3">Validade</th>
                          <th className="px-4 py-3">Fornecedor</th>
                          <th className="px-4 py-3">Qtd</th>
                          <th className="px-4 py-3 text-right">Ação</th>`;

const regexTr = /<td className="px-4 py-3 whitespace-nowrap">#\{lote\.idLote\}.*?<\/td>\s*<td className="px-4 py-3 whitespace-nowrap">[\s\S]*?<\/td>\s*<td className="px-4 py-3 whitespace-nowrap">[\s\S]*?<\/td>\s*<td className="px-4 py-3 text-right whitespace-nowrap">/;

const replacementTr = `<td className="px-4 py-3 whitespace-nowrap">#{lote.idLote} {lote.instalacaoId ? '(Mercado)' : '(Depósito)'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editLoteId === lote.idLote ? (
                                 <input type="date" value={editLoteDate} onChange={e => setEditLoteDate(e.target.value)} className="bg-white border border-slate-200 text-slate-900 text-sm rounded-md p-1.5 dark:bg-slate-950 dark:border-slate-700 dark:text-white [color-scheme:light_dark]" />
                              ) : (
                                 lote.dataValidade ? new Date(lote.dataValidade).toLocaleDateString('pt-BR') : '-'
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500" title={lote.fornecedor || 'Desconhecido'}>
                              {lote.fornecedor ? (lote.fornecedor.length > 20 ? lote.fornecedor.substring(0, 20) + '...' : lote.fornecedor) : 'Desconhecido'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editLoteId === lote.idLote ? (
                                 <input type="number" min="0" value={editLoteQty} onChange={e => setEditLoteQty(e.target.value)} className="w-20 bg-white border border-slate-200 text-slate-900 text-sm rounded-md p-1.5 dark:bg-slate-950 dark:border-slate-700 dark:text-white font-mono [color-scheme:light_dark]" />
                              ) : (
                                 <span className="font-mono">{lote.quantidadeAtual}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">`;

if (code.match(regexTable) && code.match(regexTr)) {
   code = code.replace(regexTable, replacementTable);
   code = code.replace(regexTr, replacementTr);
   fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
   console.log("Patched fornecedor table");
} else {
   console.log("Not found fornecedor table");
}
