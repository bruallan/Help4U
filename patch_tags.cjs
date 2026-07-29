const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

code = code.replace(
  /const updatePayload = \{\s*product: \{\s*tags: \[\`teste_B_\$\{price_b\}\`\]\s*\}\s*\};/g,
  `
    // Fetch product to get current tags
    const pRes = await fetch(\`\${BASE_URL}/api/v1/products/\${product_id}?access_token=\${ACCESS_TOKEN}\`);
    const pData = await pRes.json();
    let currentTags = pData.tags || [];
    // Remove previous phase tags
    currentTags = currentTags.filter((t: string) => !t.startsWith('teste_'));
    currentTags.push(\`teste_B_\${price_b}\`);
    
    const updatePayload = {
       product: {
          tags: currentTags
       }
    };
  `
);

fs.writeFileSync('api/index.ts', code);
