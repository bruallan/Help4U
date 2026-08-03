import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { dimProdutos, dimCodigosDeBarra } from './src/db/schema.js';
import { eq, or } from 'drizzle-orm';

dotenv.config();

async function run() {
  const prod = await db.select().from(dimProdutos).limit(5);
  console.log("Produtos:", prod.map(p => p.codigoBarras));

  const cod = await db.select().from(dimCodigosDeBarra).limit(5);
  console.log("Codigos:", cod);
  
  process.exit(0);
}
run();
