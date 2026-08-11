const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

const regex = /app\.get\("\/api\/vmpay\/entradas", async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: e\.message \}\);\n  \}\n\}\);/;

const replacement = `app.get("/api/vmpay/entradas", async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });

    // Pega as entradas dos últimos 7 dias
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    let allEntries = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const qs = new URLSearchParams({
          access_token: ACCESS_TOKEN,
          page: page.toString(),
          per_page: "1000",
          kind: "StorableEntry",
          occurred_at_start: start.toISOString(),
          occurred_at_end: end.toISOString()
        });

        const vmpayRes = await fetch(\`https://vmpay.vertitecnologia.com.br/api/v1/distribution_center_inventories?\${qs}\`);
        if (!vmpayRes.ok) throw new Error("Failed to fetch from VMPay");
        
        const data = await vmpayRes.json();
        
        if (data.length > 0) {
            allEntries = allEntries.concat(data);
            if (data.length < 1000) {
                hasMore = false;
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }
    
    res.json(allEntries);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});`;

if (code.match(regex)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('api/index.ts', code);
   console.log("Patched db-to-vmpay");
} else {
   console.log("Not found db-to-vmpay");
}
