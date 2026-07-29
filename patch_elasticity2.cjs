const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

// Change fetch back to ?tag=impulso
code = code.replace(
  'fetch(`${API_BASE}/api/vmpay/products`)',
  'fetch(`${API_BASE}/api/vmpay/products?tag=impulso`)'
);

// We no longer need eligibleProducts since the server filters it!
code = code.replace(
  `const eligibleProducts = products.filter(p => p.tags && p.tags.some((t: string) => t.toLowerCase() === 'impulso'));`,
  `const eligibleProducts = products;`
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
