const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const searchBlockStart = '<div className="relative w-full sm:w-64">';
const searchBlockEnd = '        </div>\n\n        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';

// Let's find exactly the block to replace
const startIndex = code.indexOf(searchBlockStart);
if (startIndex !== -1) {
  const innerSearchStr = '        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
  const innerIndex = code.indexOf(innerSearchStr, startIndex);
  if (innerIndex !== -1) {
     const codeBefore = code.slice(0, startIndex);
     const codeAfter = code.slice(innerIndex + innerSearchStr.length);
     
     const newControls = `
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                placeholder="Filtrar produto..."
              />
            </div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const [key, dir] = e.target.value.split('-');
                  setSortConfig({ key: key as any, direction: dir as any });
                } else {
                  setSortConfig(null);
                }
              }}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
            >
              <option value="">Ordenar por...</option>
              <option value="sku-asc">Produto (A-Z)</option>
              <option value="sku-desc">Produto (Z-A)</option>
              <option value="qty-asc">Qtd Vencer (Menor)</option>
              <option value="qty-desc">Qtd Vencer (Maior)</option>
              <option value="date-asc">Data Venc. (Mais próxima)</option>
              <option value="date-desc">Data Venc. (Mais distante)</option>
              <option value="ir-desc">Risco (Maior)</option>
              <option value="ir-asc">Risco (Menor)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">`;

     code = codeBefore + newControls + codeAfter;
     fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
     console.log("Sort patched");
  } else {
     console.log("Inner search string not found");
  }
} else {
  console.log("Search block start not found");
}
