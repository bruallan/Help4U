const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const target = '{applySort<any>(tableData).map((row: any) => {\\n                const isInfinity = row.ir === Infinity;\\n                \\n                  <tr';
const replace = '{applySort<any>(tableData).map((row: any) => {\\n                const isInfinity = row.ir === Infinity;\\n                return (\\n                  <tr';

code = code.replace(target, replace);
fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
