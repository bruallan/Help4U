const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');
code = code.replace('const [isScanning, setIsScanning] = useState(false);', 'const [isScanning, setIsScanning] = useState(false);\n  const [isScanningSearch, setIsScanningSearch] = useState(false);');
fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
