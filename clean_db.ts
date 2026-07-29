import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { elasticityTests } from './src/db/schema.js';
dotenv.config();

async function run() {
  await db.delete(elasticityTests);
  console.log("Cleaned");
  process.exit(0);
}
run();
