const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const tableStart = '<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">';
const tableEndStr = '              })}\n            </tbody>\n          </table>\n        </div>';

const cardsCode = `
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableData.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500">
              Nenhum lote cadastrado.
            </div>
          )}
          {applySort<any>(tableData).map((row: any) => {
            const isInfinity = row.ir === Infinity;
            return (
              <div 
                key={row.sku} 
                className={cn(
                  "flex flex-col p-4 rounded-xl border transition-colors cursor-pointer",
                  row.isRisk 
                    ? "border-red-200 bg-red-50/50 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                )}
                onClick={() => setEditingLoteProduto(row.sku)}
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight" title={row.sku}>
                    {row.sku}
                  </h4>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingLoteProduto(row.sku); }}
                    className="p-1.5 bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-600 dark:bg-slate-800 dark:hover:bg-purple-900/30 dark:text-slate-400 dark:hover:text-purple-400 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm mt-auto border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Qtd Vencer</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{row.qty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Data Venc.</p>
                    <p className="text-slate-900 dark:text-slate-100 font-medium">{row.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Risco (IR)</p>
                    {row.qty > 0 && row.date !== "-" ? (
                      <span
                        className={cn(
                          "font-bold font-mono px-1.5 py-0.5 rounded text-xs inline-block whitespace-nowrap",
                          row.isRisk
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        )}
                      >
                        {isInfinity ? "∞ CRÍ." : row.ir.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
`;

// we need to slice the code to replace
const startIndex = code.indexOf(tableStart);
const endIndex = code.indexOf(tableEndStr) + tableEndStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  const codeBefore = code.slice(0, startIndex);
  const codeAfter = code.slice(endIndex);
  code = codeBefore + cardsCode + codeAfter;
  fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
  console.log("Cards replaced");
} else {
  console.log("Could not find table boundaries.");
}
