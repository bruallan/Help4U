import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { lotesEstoque } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

dotenv.config();

async function run() {
  const result = await db.update(lotesEstoque)
    .set({ quantidadeAtual: 0 })
    .where(sql`extract(year from ${lotesEstoque.dataValidade}) = 1969`)
    .returning();
    
  console.log(`Updated ${result.length} lotes`);
  process.exit(0);
}
run();
