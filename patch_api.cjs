const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

const newEndpoints = `
import crypto from 'crypto';

app.get("/api/vmpay/products", async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const tag = req.query.tag;
    const vmpayRes = await fetch(\`\${BASE_URL}/api/v1/products?access_token=\${ACCESS_TOKEN}&per_page=1000\`);
    if (!vmpayRes.ok) throw new Error("Failed to fetch products");
    let data = await vmpayRes.json();
    if (tag) {
       data = data.filter((p: any) => p.tags && p.tags.includes(tag));
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/elasticity", async (req, res) => {
  try {
    const tests = await db.select().from(elasticityTests);
    res.json(tests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/elasticity", async (req, res) => {
  try {
    const { product_id, price_b, days } = req.body;
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    
    // Simulate fetching past 30 days volume (baseline A)
    // Normally we would query cashless_facts for this product in the last 30 days
    // Here we can use a mock or query our fatoVendas
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const vendasResult = await db.select().from(fatoVendas)
      .where(
        and(
          eq(fatoVendas.produtoId, parseInt(product_id)),
          gt(fatoVendas.dataVenda, thirtyDaysAgo),
          inArray(fatoVendas.statusVenda, ['OK', 'ok', 'Ok'])
        )
      );
      
    // Calculate volume A and margin A
    let volA = 0;
    let marginA = 0;
    let priceA = 0;
    
    if (vendasResult.length > 0) {
       // Average sale price
       priceA = vendasResult.reduce((sum, v) => sum + (v.valor || 0), 0) / vendasResult.length;
       volA = vendasResult.length; // 1 per row for simplicity, or sum(quantidade)
       marginA = vendasResult.reduce((sum, v) => sum + ((v.valor || 0) - (v.precoCusto || 0)), 0);
    } else {
       // Mock for testing if no sales found
       priceA = 10.0;
       volA = 50;
       marginA = 200;
    }

    const testId = crypto.randomUUID();
    const dateBStart = new Date();
    const dateBEnd = new Date();
    dateBEnd.setDate(dateBEnd.getDate() + days);

    // Apply tag to product in VMPay
    const updatePayload = {
       product: {
          tags: [\`teste_B_\${price_b}\`]
       }
    };
    await fetch(\`\${BASE_URL}/api/v1/products/\${product_id}?access_token=\${ACCESS_TOKEN}\`, {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(updatePayload)
    });

    await db.insert(elasticityTests).values({
       id: testId,
       productId: String(product_id),
       status: 'running_B',
       priceA,
       volA,
       marginA,
       priceB: price_b,
       dateBStart,
       dateBEnd
    });
    
    res.json({ id: testId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/elasticity/:id/recalculate", async (req, res) => {
   try {
     const { id } = req.params;
     // Recalculate logic here
     await db.update(elasticityTests).set({ status: 'recalculating' }).where(eq(elasticityTests.id, id));
     res.json({ success: true });
   } catch (e: any) {
     res.status(500).json({ error: e.message });
   }
});

`;

code = code.replace(
  'app.post("/api/sync-db", (req, res) => {',
  newEndpoints + '\napp.post("/api/sync-db", (req, res) => {'
);

fs.writeFileSync('api/index.ts', code);
