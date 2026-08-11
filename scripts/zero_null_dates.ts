import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { lotesEstoque } from '../src/db/schema.js';
import { isNull, eq, sql } from 'drizzle-orm';

dotenv.config();

async function run() {
  const result = await db.update(lotesEstoque)
    .set({ quantidadeAtual: 0 })
    .where(isNull(lotesEstoque.dataValidade))
    .returning();
    
  console.log(`Updated ${result.length} lotes with null dataValidade to 0 qty.`);
  process.exit(0);
}
run();
