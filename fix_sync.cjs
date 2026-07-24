const fs = require('fs');

let content = fs.readFileSync('scripts/sync_vmpay.ts', 'utf8');

content = content.replace(
  "let currentStart = new Date('2026-01-01T00:00:00Z');",
  `const latestFact = await db.select({ date: fatoVendas.dataVenda }).from(fatoVendas).orderBy(sql\`data_venda DESC\`).limit(1);
  let currentStart = latestFact.length > 0 ? new Date(latestFact[0].date) : new Date('2026-01-01T00:00:00Z');`
);

content = content.replace(
  "let currentStart = new Date('2026-01-01T00:00:00Z');",
  `const latestMov = await db.select({ date: fatoMovimentos.movimentoData }).from(fatoMovimentos).orderBy(sql\`movimento_data DESC\`).limit(1);
  let currentStart = latestMov.length > 0 ? new Date(latestMov[0].date) : new Date('2026-01-01T00:00:00Z');`
);

fs.writeFileSync('scripts/sync_vmpay.ts', content);
