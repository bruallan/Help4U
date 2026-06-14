// src/db/schema.ts
import { numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull(),
  dayDate: timestamp('day_date').notNull(),
  productName: text('product_name').notNull(),
  buyerId: text('buyer_id'),
  salePrice: numeric('sale_price'),
  costPrice: numeric('cost_price'),
  client: text('client'),
  category: text('category'),
  idCupom: text('id_cupom')
});
