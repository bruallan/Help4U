const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const regex = /\\n  const riskWarning = useMemo[\s\S]*?rawData\]\);\\n\\n  return \(/g;
code = code.replace(regex, "");

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
