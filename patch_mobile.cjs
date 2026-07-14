const fs = require('fs');

let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const headOld = `<thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-950 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("sku")}
                >
                  SKU / Produto {getSortIcon("sku")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("vmd")}
                >
                  VMD {getSortIcon("vmd")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("isHighTurnover")}
                >
                  Giro Alto/Médio {getSortIcon("isHighTurnover")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("qty")}
                >
                  Qtde Mais Próxima a Vencer {getSortIcon("qty")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Data Validade Mais próxima {getSortIcon("date")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("dpv")}
                >
                  DPV {getSortIcon("dpv")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("te")}
                >
                  TE {getSortIcon("te")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("ir")}
                >
                  Risco (IR) {getSortIcon("ir")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("actionRoute")}
                >
                  Ação Sugerida {getSortIcon("actionRoute")}
                </th>
              </tr>
            </thead>`;

const headNew = `<thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-950 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap sticky left-0 z-10 bg-slate-50 dark:bg-slate-950 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]"
                  onClick={() => handleSort("sku")}
                >
                  SKU / Produto {getSortIcon("sku")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("vmd")}
                >
                  VMD {getSortIcon("vmd")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("isHighTurnover")}
                >
                  Giro Alto/Médio {getSortIcon("isHighTurnover")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("qty")}
                >
                  Qtd a Vencer {getSortIcon("qty")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("date")}
                >
                  Data Venc. {getSortIcon("date")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("dpv")}
                >
                  DPV {getSortIcon("dpv")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("te")}
                >
                  TE {getSortIcon("te")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("ir")}
                >
                  Risco (IR) {getSortIcon("ir")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("actionRoute")}
                >
                  Ação Sugerida {getSortIcon("actionRoute")}
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Editar</th>
              </tr>
            </thead>`;
code = code.replace(headOld, headNew);

code = code.replace(
  'className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate"',
  'className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[140px] sm:max-w-[200px] truncate whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]"'
);

// We need to add whitespace-nowrap to other columns as well.
code = code.replace(/<td className="px-4 py-3">/g, '<td className="px-4 py-3 whitespace-nowrap">');
code = code.replace(/<td className="px-4 py-3 font-mono">/g, '<td className="px-4 py-3 font-mono whitespace-nowrap">');
code = code.replace(/<td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">/g, '<td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">');
code = code.replace(/<td className="px-4 py-3 text-slate-900 dark:text-slate-100">/g, '<td className="px-4 py-3 text-slate-900 dark:text-slate-100 whitespace-nowrap">');
code = code.replace(/<td className="px-4 py-3 text-sm">/g, '<td className="px-4 py-3 text-sm min-w-[160px] whitespace-nowrap">');

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
