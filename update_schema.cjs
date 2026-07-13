const fs = require('fs');

let code = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!code.includes('instalacaoId: integer("instalacao_id")')) {
  code = code.replace(
    'quantidadeAtual: integer("quantidade_atual"),',
    'quantidadeAtual: integer("quantidade_atual"),\n  instalacaoId: integer("instalacao_id"), // null = Depósito, otherwise Mercado'
  );
  fs.writeFileSync('src/db/schema.ts', code);
}
