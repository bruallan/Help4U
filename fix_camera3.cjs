const fs = require('fs');

let code = fs.readFileSync('src/components/GestaoValidade.tsx', 'utf8');

code = code.replace(
  `            <div className="p-4">
              <div id="reader" className="w-full"></div>
            </div>`,
  `            <div className="p-4 flex flex-col items-center gap-4">
              <div id="reader" className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                 <span className="text-slate-400 text-sm">Carregando câmera...</span>
              </div>
              
              <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-3">
                  Se a câmera de vídeo não abrir (comum no iOS/Safari), use o botão abaixo para abrir a câmera nativa do celular:
                </p>
                <label className="flex items-center justify-center w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-xl cursor-pointer transition-colors shadow-sm">
                  <Camera className="w-5 h-5 mr-2" />
                  Tirar Foto Nativa
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
                          setShowScanner(false);
                          
                          const res = await fetch(\`\${API_BASE}/api/barcode/\${decodedText}\`);
                          if (res.ok) {
                            const product = await res.json();
                            setSearchSku(product.produto);
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
            </div>`
);

fs.writeFileSync('src/components/GestaoValidade.tsx', code);
