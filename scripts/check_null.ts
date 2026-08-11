import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { lotesEstoque } from '../src/db/schema.js';
import { isNull } from 'drizzle-orm';

dotenv.config();

async function run() {
  const result = await db.select().from(lotesEstoque).where(isNull(lotesEstoque.dataValidade));
  console.log(result.map(r => ({ id: r.idLote, date: r.dataValidade, qty: r.quantidadeAtual })));
  process.exit(0);
}
run();
