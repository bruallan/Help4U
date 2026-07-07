const fs = require('fs');

let code = fs.readFileSync('src/components/GestaoValidade.tsx', 'utf8');

code = code.replace(
  'import { Html5QrcodeScanner } from "html5-qrcode";',
  'import { Html5Qrcode } from "html5-qrcode";'
);

code = code.replace(
  `  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, videoConstraints: { facingMode: "environment" } },
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
  }, [showScanner]);`,
  `  useEffect(() => {
    let html5QrCode;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
              }
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
            (error) => {
              // ignore frame errors
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
  }, [showScanner]);`
);

fs.writeFileSync('src/components/GestaoValidade.tsx', code);
