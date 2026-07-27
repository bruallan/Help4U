import { db } from "./src/db/index.js";
import { lotesEstoque, dimPlanogramas } from "./src/db/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  await db.update(lotesEstoque).set({ dataValidade: null }).where(sql`data_validade = '2100-01-01'`);
  await db.update(dimPlanogramas).set({ validade: null }).where(sql`validade = '2100-01-01'`);
  console.log("Updated!");
  process.exit(0);
}
main();
