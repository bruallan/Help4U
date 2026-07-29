import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { elasticityTests } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
dotenv.config();

async function run() {
  await db.delete(elasticityTests).where(eq(elasticityTests.productId, "31095981"));
  console.log("Mock deleted");
  process.exit(0);
}
run();
