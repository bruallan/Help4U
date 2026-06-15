import fetch from 'node-fetch';
const BASE_URL = "https://vmpay.vertitecnologia.com.br";
const TOKEN = "HHPFt0X4OLf17xKZmhHBFER58lTIpQvauYPbjL63";

async function testApi() {
  const ds = '2026-04-17T00:00:00Z';
  const de = '2026-04-17T23:59:59Z';
  
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  
  let res, text;
  
  // Test 1: start_date only
  try {
    const url1 = `${BASE_URL}/api/v1/cashless_facts?access_token=${TOKEN}&start_date=${ds}&page=1`;
    res = await fetch(url1, { headers });
    text = await res.text();
    console.log("Test 1 (start_date only):", res.status, text.substring(0, 100));
  } catch(e) { console.log(e); }

  // Test 2: start_date + end_date
  try {
    const url2 = `${BASE_URL}/api/v1/cashless_facts?access_token=${TOKEN}&start_date=${ds}&end_date=${de}&page=1`;
    res = await fetch(url2, { headers });
    text = await res.text();
    console.log("Test 2 (start+end):", res.status, text.substring(0, 100));
  } catch(e) { console.log(e); }
  
  // Test 3: start_date + end_date + per_page=5
  try {
    const url3 = `${BASE_URL}/api/v1/cashless_facts?access_token=${TOKEN}&start_date=${ds}&end_date=${de}&per_page=5&page=1`;
    res = await fetch(url3, { headers });
    text = await res.text();
    console.log("Test 3 (start+end+per_page=5):", res.status, text.substring(0, 100));
  } catch(e) { console.log(e); }
  
}
testApi();
