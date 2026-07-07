const fs = require('fs');

let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

code = code.replace(
  'import { Html5QrcodeScanner } from "html5-qrcode";',
  'import { Html5Qrcode } from "html5-qrcode";'
);

code = code.replace(
  `  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { qrbox: { width: 250, height: 250 }, fps: 5 },
        false,
      );
      scanner.render(
        async (decodedText) => {
          scanner.clear();
          setIsScanning(false);
          try {
            const res = await fetch(\`\${API_BASE}/api/barcode/\${decodedText}\`);
            if (res.ok) {
              const data = await res.json();
              setModalProduto(data.produto);
              setShowDropdown(false);
            } else {
              alert("Produto não encontrado para este código de barras.");
            }
          } catch (e) {
            console.error(e);
            alert("Erro ao buscar produto.");
          }
        },
        (err) => {
          // ignore
        },
      );

      return () => {
        scanner.clear().catch((e) => console.error(e));
      };
    }
  }, [isScanning]);`,
  `  useEffect(() => {
    let html5QrCode;

    if (isScanning) {
      html5QrCode = new Html5Qrcode("reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 }
            },
            async (decodedText) => {
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
              }
              setIsScanning(false);
              try {
                const res = await fetch(\`\${API_BASE}/api/barcode/\${decodedText}\`);
                if (res.ok) {
                  const data = await res.json();
                  setModalProduto(data.produto);
                  setShowDropdown(false);
                  setTimeout(() => {
                    document.getElementById('validade-input')?.focus();
                  }, 100);
                } else {
                  alert("Produto não encontrado para este código de barras.");
                }
              } catch (e) {
                console.error(e);
                alert("Erro ao buscar produto.");
              }
            },
            (error) => {
              // ignore
            }
          );
        } catch (err) {
          console.error("Erro ao iniciar a câmera", err);
          alert("Não foi possível iniciar a câmera. Verifique as permissões.");
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isScanning]);`
);

code = code.replace(
  `                {isScanning && (
                  <div
                    id="reader"
                    className="w-full mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800"
                  ></div>
                )}`,
  `                {isScanning && (
                  <div className="mt-2 flex flex-col items-center gap-4">
                    <div
                      id="reader"
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center"
                    >
                      <span className="text-slate-400 text-sm">Carregando câmera...</span>
                    </div>
                    <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-3">
                      <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-2">
                        Problemas para ler? Tente tirar uma foto do código de barras:
                      </p>
                      <label className="flex items-center justify-center w-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 font-medium py-2 px-4 rounded-xl cursor-pointer transition-colors shadow-sm">
                        <Camera className="w-4 h-4 mr-2" />
                        Tirar Foto
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              try {
                                const html5QrCode = new Html5Qrcode("reader");
                                const decodedText = await html5QrCode.scanFile(e.target.files[0], true);
                                setIsScanning(false);
                                
                                const res = await fetch(\`\${API_BASE}/api/barcode/\${decodedText}\`);
                                if (res.ok) {
                                  const product = await res.json();
                                  setModalProduto(product.produto);
                                  setShowDropdown(false);
                                  setTimeout(() => {
                                    document.getElementById('validade-input')?.focus();
                                  }, 100);
                                } else {
                                  alert("Produto não encontrado para o código: " + decodedText);
                                }
                              } catch (err) {
                                console.error(err);
                                alert("Não foi possível identificar um código de barras na imagem. Tente focar bem no código.");
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}`
);

code = code.replace(
  `                  value={modalDataValidade}`,
  `                  id="validade-input"
                  value={modalDataValidade}`
);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
