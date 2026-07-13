const fs = require('fs');

// Fix api/index.ts
let apiCode = fs.readFileSync('api/index.ts', 'utf8');
apiCode = apiCode.replace(/eq\(dimPlanogramas\.id, plano\.id\)/g, 'eq(dimPlanogramas.planItemId, plano.planItemId)');
fs.writeFileSync('api/index.ts', apiCode);

// Fix ValidadeEstoque.tsx
let uiCode = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

// The riskWarning block
const riskRegex = /const riskWarning = useMemo\(\(\) => \{[\s\S]*?rawData\]\);/;
const match = uiCode.match(riskRegex);

if (match) {
  const riskCode = match[0];
  uiCode = uiCode.replace(riskCode, '');
  
  // Find where to put it safely: after rawData, produtosDB, etc.
  // We can put it right before `return (` inside the component
  const returnIdx = uiCode.lastIndexOf('return (');
  uiCode = uiCode.slice(0, returnIdx) + '\\n  ' + riskCode + '\\n\\n  ' + uiCode.slice(returnIdx);
  
  fs.writeFileSync('src/components/ValidadeEstoque.tsx', uiCode);
}
