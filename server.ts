import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './src/db/index.ts';
import { sales } from './src/db/schema.ts';
import { eq, gte, lt, and } from 'drizzle-orm';

// Read config locally
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

dotenv.config();

// Fix process.cwd() for path resolution
const __dirname = process.cwd();

let globalSyncState = {
  isSyncing: false,
  totalDays: 0,
  currentDay: 0,
  currentDate: '',
  status: 'idle', // 'idle', 'syncing', 'completed', 'error', 'stopped'
  error: '',
  forceStop: false
};
let globalAbortController: AbortController | null = null;

async function syncDailyCashless(targetDate: Date) {
  const BASE_URL = "https://vmpay.vertitecnologia.com.br";
  const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
  const EMAIL = process.env.SMTP_EMAIL;
  const PASSWORD = process.env.SMTP_PASSWORD;

  const logs: string[] = [];
  function log(msg: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
    logs.push(`[${timestamp}] ${msg}`);
  }

  if (!ACCESS_TOKEN) {
    log("ERROR: Missing VMPAY_API_KEY");
    return;
  }

  try {
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const start_date_iso = startOfDay.toISOString().split('.')[0] + 'Z';
    const end_date_iso = endOfDay.toISOString().split('.')[0] + 'Z';

    const dateStr = startOfDay.toISOString().split('T')[0];
    log(`Starting execution for ${dateStr} (from ${start_date_iso} to ${end_date_iso})`);

    let pagina = 1;
    let temMais = true;
    const allFacts: any[] = [];

    while (temMais) {
      if (globalSyncState.forceStop) throw new Error("Parado pelo usuário");
      const urlFacts = `${BASE_URL}/api/v1/cashless_facts?access_token=${ACCESS_TOKEN}&start_date=${start_date_iso}&end_date=${end_date_iso}&per_page=200&page=${pagina}`;
      
      let success = false;
      let retries = 0;
      let fatosRes: Response | null = null;
      
      while (!success && retries < 3) {
         if (globalSyncState.forceStop) throw new Error("Parado pelo usuário");
         try {
            fatosRes = await fetch(urlFacts, { signal: globalAbortController?.signal });
            if (!fatosRes.ok) {
               const errorText = await fatosRes.text().catch(() => 'No text returned');
               if (fatosRes.status >= 500) {
                  throw new Error(`${fatosRes.status} Server Error: ${errorText}`);
               }
               throw new Error(`Error API cashless_facts: ${fatosRes.status} ${errorText}`);
            }
            success = true;
         } catch (e: any) {
            retries++;
            log(`Retry ${retries}/3 after error: ${e.message}`);
            if (retries >= 3 || globalSyncState.forceStop) break;
            
            // Loop for delay so we can interrupt it if stopped
            for (let t = 0; t < 10000 * retries; t += 1000) {
               if (globalSyncState.forceStop) throw new Error("Parado pelo usuário");
               await new Promise(r => setTimeout(r, 1000));
            }
         }
      }

      if (!success || !fatosRes) {
         throw new Error(`Failed to fetch page ${pagina} after 3 retries`);
      }
      
      const fatos = await fatosRes.json();
      if (!fatos || fatos.length === 0) break;
      
      allFacts.push(...fatos);
      log(`Read page ${pagina} - Received ${fatos.length} records`);
      
      if (fatos.length < 200) temMais = false;
      pagina++;
      if (pagina > 200) break; 
      
      // small delay between successful requests to prevent rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    log(`Total facts loaded: ${allFacts.length}`);

    let categoryDict: Record<number, string> = {};
    try {
      const urlCat = `${BASE_URL}/api/v1/categories?access_token=${ACCESS_TOKEN}&per_page=1000`;
      const catRes = await fetch(urlCat);
      if (catRes.ok) {
        const cats = await catRes.json();
        for (const c of cats) {
          categoryDict[c.id] = c.name;
        }
      }
    } catch(e) { log("Warning: Error fetching categories"); }

    const mappedRows = allFacts.map(fato => {
      let buyerId = fato.masked_card_number;
      if (!buyerId) {
        buyerId = fato.order_id ? `${fato.order_id}` : (fato.uuid || "Desconhecido");
      }
      
      const categId = fato.good?.category_id;
      let categoryName = categId && categoryDict[categId] ? categoryDict[categId] : "Sem Categoria";

      return {
        date: fato.occurred_at,
        dayDate: fato.occurred_at, 
        productName: fato.good?.name || "Produto Desconhecido",
        buyerId: buyerId,
        salePrice: fato.value || 0,
        costPrice: fato.cost_price || 0,
        client: fato.place || "Desconhecido",
        category: categoryName,
        idCupom: (fato.uuid || fato.order_id || fato.id).toString()
      };
    });

    log(`Processed ${mappedRows.length} mapped rows`);

    const dbRows = mappedRows.map(r => ({
      date: new Date(r.date),
      dayDate: new Date(r.dayDate),
      productName: r.productName,
      buyerId: r.buyerId,
      salePrice: String(r.salePrice),
      costPrice: String(r.costPrice),
      client: r.client,
      category: r.category,
      idCupom: r.idCupom
    }));

    log(`Saving to Cloud SQL PostgreSQL...`);
    
    // Clean up existing records for this day to avoid duplicates
    const nextDay = new Date(startOfDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    await db.delete(sales).where(and(gte(sales.dayDate, startOfDay), lt(sales.dayDate, nextDay)));

    const chunkSize = 2000;
    for (let i = 0; i < dbRows.length; i += chunkSize) {
      const chunk = dbRows.slice(i, i + chunkSize);
      await db.insert(sales).values(chunk);
    }

    log(`Saved ${dbRows.length} rows to Postgres`);

    // Send email
    if (EMAIL && PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL,
          pass: PASSWORD
        }
      });

      const mailOptions = {
        from: EMAIL,
        to: EMAIL,
        subject: `[VMPay Sync] Relatório de Sincronização Diária - ${dateStr}`,
        text: `Sincronização Finalizada.\n\nData base: ${dateStr}\nRegistros Obtidos: ${mappedRows.length}\n\n=== LOGS DA EXECUÇÃO ===\n${logs.join('\n')}`,
        attachments: [
          {
            filename: `raw_data_${dateStr}.json`,
            content: JSON.stringify(mappedRows)
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      log(`Email sent to ${EMAIL} successfully.`);
    } else {
      log(`Warning: SMTP_EMAIL or SMTP_PASSWORD not set. Email not sent.`);
    }

  } catch (err: any) {
    log(`ERROR during sync: ${err.message}`);
    if (EMAIL && PASSWORD) {
       try {
         const transporter = nodemailer.createTransport({
           service: 'gmail',
           auth: { user: EMAIL, pass: PASSWORD }
         });
         await transporter.sendMail({
           from: EMAIL,
           to: EMAIL,
           subject: `[VMPay Sync] ERRO Sincronização - ${targetDate.toISOString().split('T')[0]}`,
           text: `Aconteceu um erro durante a rotina.\n\nLOGS\n${logs.join('\n')}\n\nERROR:\n${err.stack || err.message}`
         });
       } catch (e) {}
    }
  }
}

async function syncAllMissingDays() {
  if (globalSyncState.isSyncing) {
    console.log(`[syncAllMissingDays] Sync already in progress, skipping.`);
    return;
  }

  globalSyncState.isSyncing = true;
  globalSyncState.status = 'syncing';
  globalSyncState.error = '';
  globalSyncState.forceStop = false;
  globalAbortController = new AbortController();
  
  try {
    const startDate = new Date('2026-01-01T00:00:00Z');
    // yesterday
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    endDate.setUTCHours(0, 0, 0, 0);

    const missingDates: Date[] = [];
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const startOfDay = new Date(current);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(startOfDay);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      
      // Check postgres
      const existing = await db.select({ id: sales.id }).from(sales).where(and(gte(sales.dayDate, startOfDay), lt(sales.dayDate, nextDay))).limit(1);
      if (existing.length === 0) {
        missingDates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    console.log(`[syncAllMissingDays] Found ${missingDates.length} missing dates to sync.`);
    
    globalSyncState.totalDays = missingDates.length;
    globalSyncState.currentDay = 0;

    for (let i = 0; i < missingDates.length; i++) {
      if (globalSyncState.forceStop) {
        console.log(`[syncAllMissingDays] Sync stopped by user.`);
        globalSyncState.status = 'stopped';
        break;
      }
      const missingDate = missingDates[i];
      globalSyncState.currentDay = i + 1;
      globalSyncState.currentDate = missingDate.toISOString().split('T')[0];
      
      console.log(`[syncAllMissingDays] Processing day ${i + 1}/${missingDates.length} - ${missingDate.toISOString().split('T')[0]}`);
      try {
        await syncDailyCashless(missingDate);
      } catch (e: any) {
        console.error(`[syncAllMissingDays] Failed to sync ${missingDate.toISOString()}: ${e.message}`);
        if (globalSyncState.forceStop) break;
      }
      if (globalSyncState.forceStop) break;
      await new Promise(r => setTimeout(r, 2000)); // sleep between days
    }
    
    if (globalSyncState.forceStop) {
      globalSyncState.status = 'stopped';
    } else {
      globalSyncState.status = 'completed';
    }
  } catch (error: any) {
    globalSyncState.status = 'error';
    globalSyncState.error = error.message;
    console.error(`[syncAllMissingDays] Fatal error: ${error.message}`);
  } finally {
    globalSyncState.isSyncing = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get('/api/sales', async (req, res) => {
    try {
      const allSales = await db.select().from(sales);
      res.json({ success: true, count: allSales.length, data: allSales });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to load sales" });
    }
  });

  app.get('/api/sync-status', (req, res) => {
    res.json(globalSyncState);
  });

  app.post('/api/stop-sync', (req, res) => {
    if (globalSyncState.isSyncing) {
      globalSyncState.forceStop = true;
      if (globalAbortController) {
        globalAbortController.abort();
      }
      res.json({ success: true, message: 'Parando sincronização...' });
    } else {
      res.status(400).json({ success: false, message: 'Nenhuma sincronização em andamento.' });
    }
  });

  app.get('/api/trigger-sync-all', async (req, res) => {
    try {
      if (globalSyncState.isSyncing) {
        return res.status(400).json({ success: false, message: 'Sync already in progress.' });
      }
      syncAllMissingDays().catch(console.error);
      res.json({ success: true, message: `Sync de dias faltando iniciado em segundo plano.` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Schedule cron running at 1:00 AM every day
  cron.schedule('0 1 * * *', async () => {
    console.log(`Running daily cron to sync all missing days up to yesterday`);
    await syncAllMissingDays();
  });

  // VMPay integration route
  app.get('/api/load-cashless-facts', async (req, res) => {
    try {
      const BASE_URL = "https://vmpay.vertitecnologia.com.br";
      const ACCESS_TOKEN = process.env.VMPAY_API_KEY;

      if (!ACCESS_TOKEN) {
        return res.status(401).json({ error: "Missing VMPAY_API_KEY environment variable. Adicione na aba Settings (Secrets)." });
      }

      const { start_date, end_date } = req.query as { start_date: string, end_date: string };
      
      if (!start_date || !end_date) {
        return res.status(400).json({ error: "Missing start_date or end_date query params" });
      }

      let pagina = 1;
      let temMais = true;
      const allFacts: any[] = [];

      while (temMais) {
        const urlFacts = `${BASE_URL}/api/v1/cashless_facts?access_token=${ACCESS_TOKEN}&start_date=${start_date}&end_date=${end_date}&per_page=200&page=${pagina}`;
        const fatosRes = await fetch(urlFacts);
        
        if (!fatosRes.ok) {
           throw new Error(`Erro API cashless_facts: ${fatosRes.status} ${await fatosRes.text()}`);
        }
        
        const fatos = await fatosRes.json();
        if (!fatos || fatos.length === 0) break;
        
        allFacts.push(...fatos);
        
        if (fatos.length < 200) temMais = false;
        pagina++;
        if (pagina > 200) break; 
      }

      let categoryDict: Record<number, string> = {};
      try {
        const urlCat = `${BASE_URL}/api/v1/categories?access_token=${ACCESS_TOKEN}&per_page=1000`;
        const catRes = await fetch(urlCat);
        if (catRes.ok) {
          const cats = await catRes.json();
          for (const c of cats) {
            categoryDict[c.id] = c.name;
          }
        }
      } catch(e) { console.error("Error fetching categories", e); }

      const mappedRows = allFacts.map(fato => {
        let buyerId = fato.masked_card_number;
        if (!buyerId) {
          buyerId = fato.order_id ? `${fato.order_id}` : (fato.uuid || "Desconhecido");
        }
        
        const categId = fato.good?.category_id;
        let categoryName = categId && categoryDict[categId] ? categoryDict[categId] : "Sem Categoria";

        return {
          date: fato.occurred_at,
          dayDate: fato.occurred_at, 
          productName: fato.good?.name || "Produto Desconhecido",
          buyerId: buyerId,
          salePrice: fato.value || 0,
          costPrice: fato.cost_price || 0,
          client: fato.place || "Desconhecido",
          category: categoryName,
          idCupom: (fato.uuid || fato.order_id || fato.id).toString()
        };
      });

      res.json({ success: true, count: mappedRows.length, data: mappedRows });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to sync cashless_facts" });
    }
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
