const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

if (!code.includes('MOCK FINISHED TESTS')) {
  // Let's add a script to mock finished tests to show on UI
  const mockEndpoints = `
app.post("/api/elasticity/mock", async (req, res) => {
  try {
    const testId = crypto.randomUUID();
    await db.insert(elasticityTests).values({
       id: testId,
       productId: "163",
       status: 'validating_opt',
       priceA: 10.0,
       volA: 50,
       marginA: 200,
       priceB: 12.0,
       volB: 35,
       marginB: 180,
       priceOpt: 10.8,
       expectedMarginOpt: 215,
       actualMarginOpt: 170,
       errorPercentage: 20.93,
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
// MOCK FINISHED TESTS
`;
  code = code.replace(
    'app.post("/api/sync-db", (req, res) => {',
    mockEndpoints + '\napp.post("/api/sync-db", (req, res) => {'
  );
  fs.writeFileSync('api/index.ts', code);
}
