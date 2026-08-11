const fs = require('fs');
let code = fs.readFileSync('src/components/RecebimentoPendencias.tsx', 'utf8');

const regex = /<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* AGUARDANDO NOTA \*\/\}/;

const replacement = `
            {(() => {
              if (lotesAguardandoValidade.length === 0) {
                 return (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">
                        <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Produto</th>
                            <th className="px-4 py-3 w-24">Qtd</th>
                            <th className="px-4 py-3 w-40">Validade</th>
                            <th className="px-4 py-3 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                            <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum item aguardando.</td></tr>
                        </tbody>
                      </table>
                    </div>
                 );
              }

              // Agrupar lotesAguardandoValidade por fornecedor
              const grupos = {};
              for (const l of lotesAguardandoValidade) {
                const fn = l.fornecedor || 'Desconhecido';
                if (!grupos[fn]) grupos[fn] = [];
                grupos[fn].push(l);
              }

              return Object.entries(grupos).map(([fornecedor, itens]) => (
                <div key={fornecedor} className="mb-6 last:mb-0">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-t-xl border border-slate-200 dark:border-slate-700 border-b-0 font-semibold text-slate-700 dark:text-slate-300">
                    <span className="text-xs uppercase tracking-wider text-slate-500 mr-2">Fornecedor:</span>
                    {fornecedor}
                  </div>
                  <div className="overflow-x-auto rounded-b-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">
                      <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3 w-24">Qtd</th>
                          <th className="px-4 py-3 w-40">Validade</th>
                          <th className="px-4 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map(l => (
                          <tr key={l.idLote} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-3 font-medium truncate max-w-[150px]" title={l.produto}>{l.produto}</td>
                            <td className="px-4 py-3 font-mono">{l.quantidadeAtual}</td>
                            <td className="px-4 py-3">
                              <input 
                                type="date" 
                                className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                                onChange={(e) => {
                                   const el = e.target;
                                   l._tempDate = el.value;
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => handleSalvarValidade(l, l._tempDate)}
                                  className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                                  title="Salvar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(l.idLote)}
                                  className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()}

          </div>

          {/* AGUARDANDO NOTA */}`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('src/components/RecebimentoPendencias.tsx', code);
   console.log("Patched UI group");
} else {
   console.log("Not found UI group");
}
