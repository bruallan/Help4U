const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx_restored', 'utf8');
code = code.replace('MappedRow pes";', 'MappedRow } from "../types";\n');
fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
