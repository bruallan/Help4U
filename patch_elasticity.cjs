const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

// eligible products logic
code = code.replace(
  'const avgError =',
  `const eligibleProducts = products.filter(p => p.tags && p.tags.some((t: string) => t.toLowerCase() === 'impulso'));
  const getProductName = (id: string) => {
    const p = products.find(p => p.id.toString() === id.toString());
    return p ? p.name : id;
  };
  const avgError =`
);

code = code.replace(
  '{products.length}</p>',
  '{eligibleProducts.length}</p>'
);

code = code.replace(
  '{products.map(p => (',
  '{eligibleProducts.map(p => ('
);

code = code.replace(
  '<td className="p-4">{t.productId}</td>',
  '<td className="p-4">{getProductName(t.productId)}</td>'
);

code = code.replace(
  '<h3 className="font-bold text-slate-900 dark:text-white">{t.productId}</h3>',
  '<h3 className="font-bold text-slate-900 dark:text-white">{getProductName(t.productId)}</h3>'
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
