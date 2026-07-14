const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

code = code.replace(/useMemo\(\(\) => lotesConsolidados\.filter/g, 'useMemo(() => lotes.filter');
code = code.replace(/import RecebimentoPendencias from "\.\/RecebimentoPendencias";\\nimport \{ Html5Qrcode/g, 'import RecebimentoPendencias from "./RecebimentoPendencias";\nimport { Html5Qrcode');

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
