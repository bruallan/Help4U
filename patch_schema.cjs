const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf-8');

code = code.replace(
  /export const elasticityTests = pgTable\('elasticity_tests', \{[\s\S]*?\}\);/m,
  `export const elasticityTests = pgTable('elasticity_tests', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  status: text('status').notNull(), // 'waiting_A', 'running_B', 'validating_opt', 'finished', 'recalculating'
  priceA: doublePrecision('price_a'),
  volA: doublePrecision('vol_a'),
  marginA: doublePrecision('margin_a'),
  dateAStart: timestamp('date_a_start'),
  dateAEnd: timestamp('date_a_end'),
  priceB: doublePrecision('price_b'),
  volB: doublePrecision('vol_b'),
  marginB: doublePrecision('margin_b'),
  dateBStart: timestamp('date_b_start'),
  dateBEnd: timestamp('date_b_end'),
  cTotal: doublePrecision('c_total'),
  elasticityCoef: doublePrecision('elasticity_coef'),
  priceOpt: doublePrecision('price_opt'),
  expectedMarginOpt: doublePrecision('expected_margin_opt'),
  actualMarginOpt: doublePrecision('actual_margin_opt'),
  errorPercentage: doublePrecision('error_percentage'),
  iterationCount: integer('iteration_count').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});`
);

fs.writeFileSync('src/db/schema.ts', code);
