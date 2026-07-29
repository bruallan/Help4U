import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { elasticityTests } from './src/db/schema.js';
dotenv.config();

async function run() {
  const data = await db.select().from(elasticityTests);
  console.log(data);
  process.exit(0);
}
run();
