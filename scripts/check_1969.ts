import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { lotesEstoque } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

dotenv.config();

async function run() {
  const result = await db.select().from(lotesEstoque)
    .where(sql`extract(year from ${lotesEstoque.dataValidade}) = 1969`);
  console.log("Real 1969:", result.length);
  process.exit(0);
}
run();
