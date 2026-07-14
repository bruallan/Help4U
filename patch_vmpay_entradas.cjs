const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const newRoute = `
app.get("/api/vmpay/entradas", async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });

    // Pega as entradas dos últimos X dias (ex: 7 dias)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const qs = new URLSearchParams({
      access_token: ACCESS_TOKEN,
      page: "1",
      per_page: "50",
      kind: "StorableEntry",
      occurred_at_start: start.toISOString(),
      occurred_at_end: end.toISOString()
    });

    const vmpayRes = await fetch(\`https://vmpay.vertitecnologia.com.br/api/v1/distribution_center_inventories?\${qs}\`);
    if (!vmpayRes.ok) throw new Error("Failed to fetch from VMPay");
    
    const data = await vmpayRes.json();
    res.json(data);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('// --- Proxy Endpoints', newRoute + '\n// --- Proxy Endpoints');
fs.writeFileSync('api/index.ts', code);
