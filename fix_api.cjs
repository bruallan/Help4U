const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

const newEndpoint = `
// Cron Job Route para inserir todos os produtos faltantes nos planogramas
app.post("/api/cron/fill-planograms", (req, res) => {
  exec("tsx scripts/fill_planograms.ts", (error, stdout, stderr) => {
    if (error) {
      console.error(\`exec error: \${error}\`);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: "Fill planograms concluído", stdout, stderr });
  });
});
`;

if (!content.includes('/api/cron/fill-planograms')) {
  content = content.replace('app.post("/api/cron/fefo-sync"', newEndpoint + '\napp.post("/api/cron/fefo-sync"');
  fs.writeFileSync('api/index.ts', content);
}
