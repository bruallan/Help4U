const fs = require('fs');
let code = fs.readFileSync('src/components/GestaoValidade.tsx', 'utf8');

code = code.replace(
  `{ fps: 10, qrbox: { width: 250, height: 250 } }`,
  `{ fps: 10, qrbox: { width: 250, height: 250 }, videoConstraints: { facingMode: "environment" } }`
);

fs.writeFileSync('src/components/GestaoValidade.tsx', code);
