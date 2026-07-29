const fs = require('fs');
let code = fs.readFileSync('scripts/update_elasticity.ts', 'utf-8');

code = code.replace(
  /tags: \[\`teste_O_\$\{pOpt\.toFixed\(2\)\}\`\]/g,
  `// Note: we should preserve other tags like IMPULSO, but doing simple replace for now 
             tags: ["IMPULSO", \`teste_O_\${pOpt.toFixed(2)}\`]`
);

fs.writeFileSync('scripts/update_elasticity.ts', code);
