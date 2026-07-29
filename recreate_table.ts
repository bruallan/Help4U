import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
dotenv.config();

async function run() {
  await db.execute(sql`DROP TABLE IF EXISTS elasticity_tests`);
  await db.execute(sql`
    CREATE TABLE elasticity_tests (
      id text PRIMARY KEY,
      product_id text NOT NULL,
      status text NOT NULL,
      price_a double precision,
      vol_a double precision,
      margin_a double precision,
      date_a_start timestamp,
      date_a_end timestamp,
      price_b double precision,
      vol_b double precision,
      margin_b double precision,
      date_b_start timestamp,
      date_b_end timestamp,
      c_total double precision,
      elasticity_coef double precision,
      price_opt double precision,
      expected_margin_opt double precision,
      actual_margin_opt double precision,
      error_percentage double precision,
      iteration_count integer DEFAULT 1,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  console.log("Table recreated");
  process.exit(0);
}
run();
