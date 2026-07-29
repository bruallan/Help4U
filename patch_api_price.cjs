const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

code = code.replace(
  /let volA = 0;\n    let marginA = 0;\n    let priceA = 0;[\s\S]*?const dateBStart = new Date\(\);/m,
  `// Fetch product to get current tags and default_price
    const pRes = await fetch(\`\${BASE_URL}/api/v1/products/\${product_id}?access_token=\${ACCESS_TOKEN}\`);
    const pData = await pRes.json();
    let currentTags = pData.tags || [];

    // Calculate volume A and margin A
    let volA = 0;
    let marginA = 0;
    let priceA = 0;
    
    if (vendasResult.length > 0) {
       priceA = vendasResult.reduce((sum, v) => sum + (v.valor || 0), 0) / vendasResult.length;
       volA = vendasResult.length;
       marginA = vendasResult.reduce((sum, v) => sum + ((v.valor || 0) - (v.precoCusto || 0)), 0);
    } else {
       // Use real product price if no sales found, but use 1 for volume to avoid div by zero
       priceA = pData.default_price || 10.0;
       volA = 10;
       marginA = 20;
    }
    
    const testId = crypto.randomUUID();
    const dateBStart = new Date();`
);

// We also need to remove the now redundant fetch
code = code.replace(
  /\/\/ Fetch product to get current tags\n    const pRes = await fetch[^;]+;\n    const pData = await pRes\.json\(\);\n    let currentTags = pData\.tags \|\| \[\];\n/m,
  ''
);

fs.writeFileSync('api/index.ts', code);
