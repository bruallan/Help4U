const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

// Add verification
code = code.replace(
  'const { product_id, price_b, days } = req.body;\n    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;',
  `const { product_id, price_b, days } = req.body;\n    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;\n    \n    // Verify existing test\n    const existingTest = await db.select().from(elasticityTests).where(\n      and(\n        eq(elasticityTests.productId, String(product_id)),\n        inArray(elasticityTests.status, ['waiting_A', 'running_B', 'validating_opt'])\n      )\n    ).limit(1);\n    \n    if (existingTest.length > 0) {\n       return res.status(400).json({ error: "Já existe um teste ativo para este produto." });\n    }`
);

// Add DELETE route
const deleteRoute = `
app.delete("/api/elasticity/:id", async (req, res) => {
   try {
     const { id } = req.params;
     const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
     
     // 1. Get the test
     const testResults = await db.select().from(elasticityTests).where(eq(elasticityTests.id, id)).limit(1);
     if (testResults.length === 0) {
        return res.status(404).json({ error: "Teste não encontrado" });
     }
     const test = testResults[0];
     
     // 2. Fetch current product from VMPay to update price and tags
     const pRes = await fetch(\`\${BASE_URL}/api/v1/products/\${test.productId}?access_token=\${ACCESS_TOKEN}\`);
     if (pRes.ok) {
         const pData = await pRes.json();
         let currentTags = pData.tags || [];
         currentTags = currentTags.filter((t) => !t.startsWith('teste_'));
         
         const updatePayload = {
            product: {
               tags: currentTags,
               default_price: test.priceA // revert to original price
            }
         };
         
         await fetch(\`\${BASE_URL}/api/v1/products/\${test.productId}?access_token=\${ACCESS_TOKEN}\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
         });
     }
     
     // 3. Delete from DB
     await db.delete(elasticityTests).where(eq(elasticityTests.id, id));
     
     res.json({ success: true });
   } catch (e) {
     res.status(500).json({ error: e.message });
   }
});
`;

code = code.replace(
  '// MOCK FINISHED TESTS',
  deleteRoute + '\n\n// MOCK FINISHED TESTS'
);

fs.writeFileSync('api/index.ts', code);
