const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const effectCode = `  useEffect(() => {
    let html5QrCodeSearch: any;
    if (isScanningSearch) {
      html5QrCodeSearch = new Html5Qrcode("reader-search");
      html5QrCodeSearch.start(
        { facingMode: "environment" },
        { fps: 30, qrbox: { width: 300, height: 150 } },
        (decodedText: string) => {
           if (html5QrCodeSearch.isScanning) html5QrCodeSearch.stop();
           setIsScanningSearch(false);
           setSearchSku(decodedText);
        },
        (err: any) => {}
      ).catch(console.error);
    }
    return () => {
      if (html5QrCodeSearch && html5QrCodeSearch.isScanning) {
        html5QrCodeSearch.stop().catch(console.error);
      }
    };
  }, [isScanningSearch]);
`;

code = code.replace('  useEffect(() => {', effectCode + '\n  useEffect(() => {');
fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
