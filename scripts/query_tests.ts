import { db } from "../src/db/index.js";
import { elasticityTests } from "../src/db/schema.js";

async function main() {
  const data = await db.select().from(elasticityTests);
  console.log("Tests in DB:", data.length);
  process.exit(0);
}
main().catch(console.error);
