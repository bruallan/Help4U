import express from "express";
import cors from "cors";
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { db } from '../src/db/index.js';
import { fatoVendas, dimInstalacoes, dimPlanogramas } from '../src/db/schema.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const BASE_URL = "https://vmpay.vertitecnologia.com.br";

// --- Endpoints via Supabase (Drizzle) ---
import { exec } from 'child_process';
app.post('/api/sync-db', (req, res) => {
  exec('npm run db:sync', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: "Sync concluído", stdout, stderr });
  });
});

app.get('/api/sales', async (req, res) => {
  try {
    const data = await db.select().from(fatoVendas);
    const dbRows = data.map(v => ({
      date: v.dataVenda,
      dayDate: v.dataVenda,
      productName: v.produto || "Produto Desconhecido",
      buyerId: v.cardNumber || "Desconhecido",
      salePrice: Number(v.valor) || 0,
      costPrice: Number(v.precoCusto) || 0,
      client: v.instalacao || "Desconhecido",
      category: v.categoriaId ? String(v.categoriaId) : "Sem Categoria",
      idCupom: v.vendaId
    }));
    res.json(dbRows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/planogramas', async (req, res) => {
  try {
    const data = await db.select().from(dimPlanogramas);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/installations_details', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    
    // First read machines from the database
    const instalacoes = await db.select().from(dimInstalacoes);
    const results = [];
    
    for (const inst of instalacoes) {
        if (!inst.maquinaId || !inst.instalacaoId) continue;
        const url = `${BASE_URL}/api/v1/machines/${inst.maquinaId}/installations/${inst.instalacaoId}?access_token=${ACCESS_TOKEN}`;
        const fetchRes = await fetchWithRetry(url);
        if (fetchRes.ok) {
           const data = await fetchRes.json();
           results.push(data);
        }
    }
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Reusable robust fetch wrapper with retries and exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 4, delayMs = 1200): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Set a 35 seconds timeout for fetching page
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      
      const res = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        const backoff = delayMs * Math.pow(2.2, attempt);
        console.warn(`[VMPay API] Rate limited (429) on attempt ${attempt}/${retries}. Retrying in ${Math.round(backoff)}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err: any) {
      lastError = err;
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        break;
      }
      
      // Calculate backoff
      const backoff = delayMs * Math.pow(1.8, attempt);
      console.warn(`[VMPay API] Fetch failed on attempt ${attempt}/${retries} for url: ${url.split('?')[0]}. Error: ${err.message || err}. Retrying in ${Math.round(backoff)}ms...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastError || new Error("Fetch failed after maximum retries");
}

// --- Proxy Endpoints to avoid CORS limits and hide VMPAY API KEY ---

app.get('/api/proxy/cashless_facts', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });

    const { start_date, end_date, page, per_page } = req.query;
    const url = `${BASE_URL}/api/v1/cashless_facts?access_token=${ACCESS_TOKEN}&start_date=${start_date}&end_date=${end_date}&per_page=${per_page || 100}&page=${page || 1}`;
    
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/categories', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const url = `${BASE_URL}/api/v1/categories?access_token=${ACCESS_TOKEN}&per_page=1000`;
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/installations', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const { page } = req.query;
    const url = `${BASE_URL}/api/v1/installations?access_token=${ACCESS_TOKEN}&per_page=100&page=${page || 1}`;
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/scheduled_visits', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const { start_date, end_date, page } = req.query;
    const url = `${BASE_URL}/api/v1/scheduled_visits?access_token=${ACCESS_TOKEN}&start_date=${start_date}&end_date=${end_date}&per_page=100&page=${page || 1}`;
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/goods', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const { page } = req.query;
    const url = `${BASE_URL}/api/v1/goods?access_token=${ACCESS_TOKEN}&per_page=100&page=${page || 1}`;
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy/scheduled_visit_checkpoints/:id', async (req, res) => {
  try {
    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });
    const url = `${BASE_URL}/api/v1/scheduled_visit_checkpoints/${req.params.id}?access_token=${ACCESS_TOKEN}`;
    const fetchRes = await fetchWithRetry(url);
    const data = await fetchRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sync-single-day', async (req, res) => {
  try {
    const { dateStr } = req.body;
    if (!dateStr) return res.status(400).json({ error: "Missing dateStr" });

    const ACCESS_TOKEN = process.env.VMPAY_API_KEY;
    if (!ACCESS_TOKEN) return res.status(401).json({ error: "Missing VMPAY_API_KEY" });

    const startOfDay = new Date(dateStr + 'T00:00:00Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.000Z');
    const start_date = startOfDay.toISOString().split('.')[0] + 'Z';
    const end_date = endOfDay.toISOString().split('.')[0] + 'Z';

    // 1. Get Categories
    let categoryDict: Record<number, string> = {};
    try {
      const catUrl = `${BASE_URL}/api/v1/categories?access_token=${ACCESS_TOKEN}&per_page=1000`;
      const catRes = await fetchWithRetry(catUrl, {}, 3, 1000);
      if (catRes.ok) {
        const cats = await catRes.json();
        for (const c of cats) categoryDict[c.id] = c.name;
      }
    } catch(e) {}

    // 2. Fetch all pages from VMPay
    let allFacts: any[] = [];
    let page = 1;
    let hasMore = true;

    const endDayTime = endOfDay.getTime();

    while (hasMore) {
      const url = `${BASE_URL}/api/v1/cashless_facts?access_token=${ACCESS_TOKEN}&start_date=${start_date}&end_date=${end_date}&per_page=100&page=${page}`;
      const fetchRes = await fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }, 4, 1500); // 4 retries, starting with 1.5s delay
      
      const data = await fetchRes.json();
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      const validData = data.filter((f: any) => new Date(f.occurred_at).getTime() <= endDayTime);
      allFacts.push(...validData);

      if (validData.length < data.length) {
         hasMore = false; // hit boundary
      }
      
      page++;
      
      // Delay between pages to prevent rate limits
      await new Promise(r => setTimeout(r, 150));
    }

    // 3. Format rows
    const dbRows = allFacts.map(fato => {
      let buyerId = fato.masked_card_number || (fato.order_id ? String(fato.order_id) : (fato.uuid || "Desconhecido"));
      const categId = fato.good?.category_id;
      const categoryName = categId && categoryDict[categId] ? categoryDict[categId] : "Sem Categoria";

      return {
        date: fato.occurred_at,
        dayDate: fato.occurred_at, 
        productName: fato.good?.name || "Produto Desconhecido",
        buyerId,
        salePrice: Number(fato.value) || 0,
        costPrice: Number(fato.cost_price) || 0,
        client: fato.place || "Desconhecido",
        category: categoryName,
        idCupom: String(fato.uuid || fato.order_id || fato.id)
      };
    });

    res.json({ success: true, count: dbRows.length, data: dbRows });
  } catch (e: any) {
    console.error("VMPay Fetch error on date " + req.body.dateStr, e);
    res.status(500).json({ error: e.message });
  }
});

// --- Remote Email Sender Endpoint ---

app.post('/api/send-sync-email', async (req, res) => {
  try {
    const { dateStr, mappedRowsCount, logsContent } = req.body;
    const EMAIL = process.env.SMTP_EMAIL;
    const PASSWORD = process.env.SMTP_PASSWORD;

    if (!EMAIL || !PASSWORD) {
      return res.status(400).json({ success: false, message: "SMTP credentials not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL, pass: PASSWORD }
    });

    const mailOptions = {
      from: EMAIL,
      to: EMAIL,
      subject: `[VMPay Sync] Relatório de Sincronização Diária - Firestore - ${dateStr}`,
      text: `Sincronização Finalizada.\n\nData base: ${dateStr}\nRegistros Obtidos: ${mappedRowsCount}\n\n=== LOGS DA EXECUÇÃO ===\n${logsContent}`
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email enviado com sucesso" });
  } catch (e: any) {
    console.error("Failed to send email", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default app;
