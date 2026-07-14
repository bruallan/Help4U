const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const theadOld = `<thead className="text-xs uppercase bg-red-100 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Qtd em dim_produtos</th>
                  <th className="px-4 py-3">Soma dos Lotes</th>
                  <th className="px-4 py-3">Diferença</th>
                  <th className="px-4 py-3 text-right">Ações Individuais</th>
                </tr>
              </thead>`;

const theadNew = `<thead className="text-xs uppercase bg-red-100 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap sticky left-0 z-10 bg-red-100 dark:bg-red-900 shadow-[1px_0_0_0_#fca5a5] dark:shadow-[1px_0_0_0_#7f1d1d]">Produto</th>
                  <th className="px-4 py-3 whitespace-nowrap">Qtd no BD</th>
                  <th className="px-4 py-3 whitespace-nowrap">Soma dos Lotes</th>
                  <th className="px-4 py-3 whitespace-nowrap">Diferença</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Ações Individuais</th>
                </tr>
              </thead>`;

code = code.replace(theadOld, theadNew);

const tdOld1 = `<td className="px-4 py-3 font-medium">{a.produto}</td>
                    <td className="px-4 py-3 font-mono">{a.qtdDimProdutos}</td>
                    <td className="px-4 py-3 font-mono">{a.qtdLotes}</td>
                    <td className="px-4 py-3 font-mono font-bold text-red-600 dark:text-red-400">`;

const tdNew1 = `<td className="px-4 py-3 font-medium whitespace-nowrap sticky left-0 z-10 bg-red-50 dark:bg-[#2b1011] shadow-[1px_0_0_0_#fca5a5] dark:shadow-[1px_0_0_0_#7f1d1d] max-w-[140px] sm:max-w-[200px] truncate" title={a.produto}>{a.produto}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{a.qtdDimProdutos}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{a.qtdLotes}</td>
                    <td className="px-4 py-3 font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap">`;

code = code.replace(tdOld1, tdNew1);

const tdOld2 = `<td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">`;
const tdNew2 = `<td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">`;

code = code.replace(tdOld2, tdNew2);
fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
