const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const newEndpoint = `
// Sync Produtos (Quantidades do VMPay)
app.post("/api/vmpay/refresh-stock", async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });

    // Fetch products
    let page = 1;
    let hasMore = true;
    while(hasMore) {
      const qs = new URLSearchParams({
        access_token: ACCESS_TOKEN,
        page: page.toString(),
        per_page: "1000"
      });
      const url = \`\${BASE_URL}/api/v1/products?\${qs}\`;
      const fetchRes = await fetchWithRetry(url);
      const products = await fetchRes.json();
      
      if (!products || products.length === 0) break;
      if (products.length < 1000) hasMore = false;
      
      for (const p of products) {
         if (p.id) {
           await db.update(dimProdutos)
             .set({ 
               quantidadeEstoque: p.inventories?.[0]?.total_quantity || 0 
             })
             .where(eq(dimProdutos.id, p.id));
         }
      }
      page++;
    }
    res.json({ success: true, message: "Estoque atualizado com sucesso" });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code + '\n' + newEndpoint;
fs.writeFileSync('api/index.ts', code);
