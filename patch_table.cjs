const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

code = code.replace(
  '<th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">P_Opt</th>',
  '<th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">P_Opt</th>\n              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800 w-16">Ações</th>'
);

code = code.replace(
  '<td className="p-4">{t.priceOpt ? formatCurrency(t.priceOpt) : \'-\'}</td>',
  `<td className="p-4">{t.priceOpt ? formatCurrency(t.priceOpt) : '-'}</td>
                <td className="p-4">
                  <button 
                    onClick={() => handleDeleteTest(t.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir Teste"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>`
);

code = code.replace('colSpan={6}', 'colSpan={7}');

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
