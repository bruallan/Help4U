import { execSync } from 'child_process';
const BASE_URL = "https://vmpay.vertitecnologia.com.br";
const TOKEN = "HHPFt0X4OLf17xKZmhHBFER58lTIpQvauYPbjL63";

try {
  let url1 = `${BASE_URL}/api/v1/cashless_facts.json?access_token=${TOKEN}&start_date=2026-04-17T00:00:00Z&end_date=2026-04-17T01:00:00Z&page=1`;
  let res = execSync(`curl -s -o /dev/null -w "%{http_code}" "${url1}"`).toString();
  console.log("CURL status .json:", res);
} catch(e) {
  console.log(e);
}













