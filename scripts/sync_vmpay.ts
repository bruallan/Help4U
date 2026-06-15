import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const EMAIL = process.env.SMTP_EMAIL;
const PASSWORD = process.env.SMTP_PASSWORD;
const BASE_URL = "https://vmpay.vertitecnologia.com.br";

// Configuração Web do seu Firestore (que você já usa no app)
// O GitHub Actions vai se conectar direto ao Firebase!
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const logs: string[] = [];
const log = (msg: string) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
  logs.push(`[${ts}] ${msg}`);
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSync() {
  if (!VMPAY_API_KEY) {
    throw new Error('VMPAY_API_KEY não está configurada nos Secrets do GitHub!');
  }

  log('Iniciando rotina pesada de Sincronização via GitHub Actions...');

  // 1. Descobrir dias faltantes analisando o banco de dados
  const salesQuery = await getDocs(collection(db, "sales"));
  
  // Default to 60 days ago if DB is completely empty.
  // This prevents hitting VMPay with 6+ months of historical backfills which crash their server (502).
  let maxDate = new Date();
  maxDate.setUTCDate(maxDate.getUTCDate() - 60);
  maxDate.setUTCHours(0, 0, 0, 0);
  
  salesQuery.forEach((docSnapshot) => {
    const d = new Date(docSnapshot.data().dayDate);
    if (d > maxDate) maxDate = d;
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const missingDates: string[] = [];
  let currentDate = new Date(maxDate);
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);

  while (currentDate < today) {
    missingDates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  if (missingDates.length === 0) {
    log('Nenhum dia para sincronizar. Banco de dados já está atualizado!');
    return;
  }

  log(`Encontrados ${missingDates.length} dias para sincronizar.`);

  // 2. Pré-carregar Categorias do VM Pay
  log('Carregando categorias...');
  const catRes = await fetch(`${BASE_URL}/api/v1/categories?access_token=${VMPAY_API_KEY}&per_page=1000`);
  let categoryDict: Record<number, string> = {};
  if (catRes.ok) {
    const cats = await catRes.json();
    for (const c of cats) categoryDict[c.id] = c.name;
    log(`Carregadas ${cats.length} categorias.`)
  } else {
    log(`AVISO: Falha ao carregar categorias (HTTP ${catRes.status})`);
  }

  // 3. Executar Busca e Salvar
  let totalSaved = 0;
  let isError = false;
  let errorMsg = '';
  let abortReason = '';

  try {
    let consecutive5xx = 0;
    
    // Roda no máximo pelas datas faltantes
    for (const dateStr of missingDates) {
      if (abortReason) break;
      
      const startOfDay = new Date(dateStr + 'T00:00:00Z');
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
      const start_date_iso = startOfDay.toISOString().split('.')[0] + 'Z';
      const end_date_iso = endOfDay.toISOString().split('.')[0] + 'Z';

      log(`>>> Iniciando sync para ${dateStr}`);
      const allFacts: any[] = [];
      let pagina = 1;
      let temMais = true;
      let fallbackDay = false;

      while (temMais) {
        if (abortReason) break;
        
        const url = `${BASE_URL}/api/v1/cashless_facts?access_token=${VMPAY_API_KEY}&start_date=${start_date_iso}&end_date=${end_date_iso}&per_page=5&page=${pagina}`;
        let success = false;
        let retries = 0;
        let fatosDaPagina = [];

        // Reduzido para 3 tentativas por página, conforme solicitado
        while (!success && retries < 3) {
          try {
            const res = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            if (!res.ok) {
              if (res.status >= 500) consecutive5xx++;
              else consecutive5xx = 0; // reset se não for erro de servidor
              throw new Error(`Status ${res.status}`);
            }
            fatosDaPagina = await res.json();
            success = true;
            consecutive5xx = 0; // reset on success
          } catch (err: any) {
            retries++;
            log(`Erro Pág ${pagina}: ${err.message}. Retentativa ${retries}/3 em breve...`);
            
            // Se tomarmos 3 erros de servidor 500+ seguidos (no total da execução), aborta TUDO
            if (consecutive5xx >= 3) {
               abortReason = `A API retornou erros de servidor (ex: 502) ${consecutive5xx} vezes seguidas. O VM Pay está fora do ar ou negando requisições. Abortando serviço.`;
               log(`⚠️ ${abortReason}`);
               break; // Sai do while das tentativas
            }
            await wait(2000 * retries);
          }
        }

        if (abortReason) break; // Sai do while de páginas

        if (!success) {
           log(`AVISO CRÍTICO: Falha irreparável ao buscar página ${pagina} do dia ${dateStr} após 3 tentativas. Ignorando este dia e continuando.`);
           fallbackDay = true;
           break;
        }

        if (!fatosDaPagina || fatosDaPagina.length === 0) {
           temMais = false;
           break;
        }

        allFacts.push(...fatosDaPagina);
        log(`Lida página ${pagina} do dia ${dateStr} com ${fatosDaPagina.length} registros.`);
        
        if (fatosDaPagina.length < 5) temMais = false;
        pagina++;
        await wait(1000); // Nunca fazemos DDoS no VM Pay. Um segundo de respiro.
      }

      if (abortReason) break; // Sai do for de dias

      if (fallbackDay) continue; // Go to next day

      if (allFacts.length > 0) {
        log(`Formatando e enviando ${allFacts.length} registros para o Firebase (dia ${dateStr})...`);

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
            idCupom: String(fato.uuid || fato.order_id || fato.id) // ID Único exigido
          };
        });

        const chunkSize = 400;
        for (let i = 0; i < dbRows.length; i += chunkSize) {
          const chunk = dbRows.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(row => {
            const docRef = doc(collection(db, "sales"), row.idCupom); 
            batch.set(docRef, row);
          });
          await batch.commit();
          log(`Gravados ${i + chunk.length} de ${dbRows.length} registros...`);
        }
        totalSaved += dbRows.length;
      } else {
        log(`Nenhum faturamento registrado em ${dateStr}. Trocando de dia.`);
      }
    }
  } catch (e: any) {
    isError = true;
    errorMsg = e.message;
    log(`CRITICAL ENGINE ERROR: ${e.message}`);
  } finally {
    log(`======= SINCRONIZAÇÃO CONCLUÍDA =======`);
    if (abortReason) log(`Status Interrompido: ${abortReason}`);
    log(`Total processado e salvo no banco desta vez: ${totalSaved} registros.`);

    // 4. Enviar email resumido MESMO SE der erro
    if (EMAIL && PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL, pass: PASSWORD }
        });

        const subjectStatus = abortReason || isError ? '⚠️ PARCIAL/FALHA' : '✅ SUCESSO';
        await transporter.sendMail({
          from: EMAIL,
          to: EMAIL,
          subject: `[VMPay Sync] Relatório GitHub - ${subjectStatus}`,
          text: `A sincronização automática terminou.\n\nStatus: ${abortReason || (isError ? errorMsg : "Sucesso Total")}\nDados Salvos: ${totalSaved}\n\n=== LOGS COMPLETOS ===\n${logs.join('\n')}`
        });
        log('Email de relatório enviado com sucesso.');
      } catch (e: any) {
        log(`Não foi possível enviar e-mail: ${e.message}`);
      }
    }
    
    // Derruba a exec action com erro se foi abortado ou pegou excecao
    if (abortReason || isError) {
      process.exit(1); 
    }
  }
}

runSync();
