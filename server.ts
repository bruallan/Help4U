import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from 'dotenv';

dotenv.config();

// Fix process.cwd() for path resolution
const __dirname = process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // VMPay integration route
  app.get('/api/load-validades', async (req, res) => {
    try {
      const BASE_URL = "https://vmpay.vertitecnologia.com.br";
      const ACCESS_TOKEN = process.env.VMPAY_API_KEY;

      if (!ACCESS_TOKEN) {
        return res.status(401).json({ error: "Missing VMPAY_API_KEY environment variable. Adicione na aba Settings (Secrets)." });
      }

      // Dates: Last 60 days
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataFim.getDate() - 60);

      const start_date_str = dataInicio.toISOString().split('T')[0];
      const end_date_str = dataFim.toISOString().split('T')[0];

      // 2. Scheduled Visits
      const checkpointsPorInstalacao: Record<string, { checkpoint_id: number, data: Date }[]> = {};
      let pagina = 1;
      let temMais = true;

      while (temMais) {
        const urlVisitas = `${BASE_URL}/api/v1/scheduled_visits?access_token=${ACCESS_TOKEN}&start_date=${start_date_str}&end_date=${end_date_str}&per_page=100&page=${pagina}`;
        const visitasRes = await fetch(urlVisitas);
        
        if (!visitasRes.ok) {
           throw new Error(`Erro API visitas: ${visitasRes.status}`);
        }
        
        const visitas = await visitasRes.json();
        if (!visitas || visitas.length === 0) break;

        for (const visita of visitas) {
          for (const cp of (visita.checkpoints || [])) {
            const inst_id = cp.installation_id;
            const cp_id = cp.id;
            const finished = cp.finished;
            const finished_at = cp.finished_at;

            if (finished && finished_at && inst_id) {
              const dt_finished = new Date(finished_at);
              if (!checkpointsPorInstalacao[inst_id]) {
                checkpointsPorInstalacao[inst_id] = [];
              }
              checkpointsPorInstalacao[inst_id].push({
                checkpoint_id: cp_id,
                data: dt_finished
              });
            }
          }
        }

        if (visitas.length < 100) temMais = false;
        pagina++;
        
        // Prevent infinite loops / too many requests temporarily
        if (pagina > 10) break; 
      }

      // 3. Installations Names
      const instalacoesDict: Record<string, string> = {};
      const urlInstGeral = `${BASE_URL}/api/v1/installations?access_token=${ACCESS_TOKEN}&per_page=100`;
      try {
        const instRes = await fetch(urlInstGeral);
        if (instRes.ok) {
           const insts = await instRes.json();
           for (const inst of insts) {
             instalacoesDict[inst.id] = inst.place || "Sem Nome";
           }
        }
      } catch (e) { console.error("Error fetching installations list", e); }

      for (const inst_id of Object.keys(checkpointsPorInstalacao)) {
        if (!instalacoesDict[inst_id]) {
          try {
            const urlUnica = `${BASE_URL}/api/v1/installations/${inst_id}?access_token=${ACCESS_TOKEN}`;
            const unRes = await fetch(urlUnica);
            if (unRes.ok) {
               const unData = await unRes.json();
               instalacoesDict[inst_id] = unData.place || `Instalação ${inst_id}`;
            } else {
               instalacoesDict[inst_id] = `Instalação ${inst_id}`;
            }
          } catch(e) { instalacoesDict[inst_id] = `Instalação ${inst_id}`; }
        }
      }

      // 4. Products Names
      const produtosDict: Record<number, string> = {};
      pagina = 1;
      temMais = true;
      while (temMais) {
        const urlGoods = `${BASE_URL}/api/v1/goods?access_token=${ACCESS_TOKEN}&per_page=100&page=${pagina}`;
        try {
          const res = await fetch(urlGoods);
          if (res.ok) {
            const prods = await res.json();
            if (!prods || prods.length === 0) break;
            for (const p of prods) {
              produtosDict[p.id] = p.name || "Produto Sem Nome";
            }
            if (prods.length < 100) temMais = false;
            pagina++;
            if (pagina > 10) break;
          } else {
            break;
          }
        } catch(e) { break; }
      }

      // 5. Checkpoints expiration extraction
      const inputsOutput: Record<string, { date: string; qty: number }> = {};
      const logs = [];

      for (const [inst_id, cps] of Object.entries(checkpointsPorInstalacao)) {
        const nomeInstalacao = instalacoesDict[inst_id];
        
        // Sort DESC
        cps.sort((a, b) => b.data.getTime() - a.data.getTime());
        
        let encontrou_valido = false;

        for (const data_cp of cps) {
          const cp_id = data_cp.checkpoint_id;
          const urlCp = `${BASE_URL}/api/v1/scheduled_visit_checkpoints/${cp_id}?access_token=${ACCESS_TOKEN}`;
          
          try {
            const res = await fetch(urlCp);
            if (res.ok) {
              const data = await res.json();
              const inventories = data.inventories || [];
              
              const tem_validade = inventories.some((i: any) => i.expiration_date);

              if (tem_validade) {
                encontrou_valido = true;
                logs.push(`Validades encontradas na ${nomeInstalacao} (CP ${cp_id})`);
                
                for (const item of inventories) {
                   const exp_date = item.expiration_date;
                   if (exp_date) {
                     const good_id = item.good_id;
                     const nomeProduto = produtosDict[good_id] || "Produto Desconhecido";
                     
                     // The Python script extracts year, month, date, we can just save it YYYY-MM-DD
                     const dateClean = exp_date.split('T')[0];
                     
                     // We match the React component's expected key: `${selectedMarket}_${sku}`
                     const stateKey = `${nomeInstalacao}_${nomeProduto}`;
                     
                     inputsOutput[stateKey] = {
                       date: dateClean,
                       qty: item.quantity || 1 // defaulting to 1 if no quantity, ideally we capture it if API has it
                     };
                   }
                }
                break; // Stop after first valid checkpoint for this installation
              }
            }
          } catch(e) { }
        }
        
        if (!encontrou_valido) {
           logs.push(`AVISO: A ${nomeInstalacao} não possui inventário com validades nos últimos 60 dias`);
        }
      }

      res.json({ success: true, count: Object.keys(inputsOutput).length, data: inputsOutput, logs });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to process validade" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
