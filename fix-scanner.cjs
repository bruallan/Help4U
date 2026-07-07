const fs = require('fs');

let code = fs.readFileSync('src/components/GestaoValidade.tsx', 'utf8');

// Imports
code = code.replace(
  'import {\n  AlertCircle,',
  `import { Html5QrcodeScanner } from "html5-qrcode";
import {
  AlertCircle,
  Camera,
  X,`
);

// State
code = code.replace(
  '  const [showLogs, setShowLogs] = useState(false);',
  `  const [showLogs, setShowLogs] = useState(false);
  const [showScanner, setShowScanner] = useState(false);`
);

// useEffect
code = code.replace(
  '  React.useEffect(() => {',
  `  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(
        async (decodedText) => {
          scanner.clear();
          setShowScanner(false);
          // Fetch product by barcode
          try {
            const res = await fetch(\`\${API_BASE}/api/barcode/\${decodedText}\`);
            if (res.ok) {
              const product = await res.json();
              setSearchSku(product.produto);
            } else {
              alert("Produto não encontrado para o código: " + decodedText);
            }
          } catch (e) {
            console.error(e);
            alert("Erro ao buscar produto pelo código de barras.");
          }
        },
        (error) => {}
      );

      return () => {
        scanner.clear().catch((e) => console.error(e));
      };
    }
  }, [showScanner]);

  React.useEffect(() => {`
);

// UI element
code = code.replace(
  `              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full pl-10 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                placeholder="Filtrar por nome do produto..."
              />`,
  `              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full pl-10 pr-12 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                placeholder="Filtrar por nome do produto..."
              />
              <button
                onClick={() => setShowScanner(true)}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <Camera className="w-5 h-5 text-slate-500 hover:text-orange-600 transition-colors" />
              </button>`
);

// Modal
code = code.replace(
  `      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">`,
  `      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Escanear Código de Barras</h3>
              <button onClick={() => setShowScanner(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div id="reader" className="w-full"></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">`
);

fs.writeFileSync('src/components/GestaoValidade.tsx', code);
