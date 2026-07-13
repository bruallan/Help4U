const fs = require('fs');

function speedUp(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  code = code.replace(
    `              fps: 10,
              qrbox: { width: 250, height: 150 },`,
    `              fps: 30,
              disableFlip: false,
              qrbox: { width: 300, height: 150 },`
  );

  fs.writeFileSync(filePath, code);
}

speedUp('src/components/GestaoValidade.tsx');
speedUp('src/components/ValidadeEstoque.tsx');
