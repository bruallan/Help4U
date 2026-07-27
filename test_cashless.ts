import * as dotenv from 'dotenv';
dotenv.config();

const VMPAY_API_KEY = process.env.VMPAY_API_KEY;
const BASE_URL = "https://vmpay.vertitecnologia.com.br";

async function fetchApi(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${BASE_URL}/api/v1${endpoint}`);
  url.searchParams.append('access_token', VMPAY_API_KEY as string);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }
  console.log("Fetching URL:", url.toString());
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });
  console.log("Status:", res.status);
  if (!res.ok) {
     const text = await res.text();
     console.log("Error response:", text);
  } else {
     console.log("Success!");
  }
}

async function run() {
  const startIso1 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log("Test 1: ISO String", startIso1);
  await fetchApi('/cashless_facts', { start_date: startIso1, page: 1, per_page: 10 });
  
  console.log("Test 2: No start date");
  await fetchApi('/cashless_facts', { page: 1, per_page: 10 });
  
  console.log("Test 3: dd/mm/yyyy hh:mi:ss");
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startIso3 = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  console.log("Test 3 value:", startIso3);
  await fetchApi('/cashless_facts', { start_date: startIso3, page: 1, per_page: 10 });
}

run();
