import * as dotenv from 'dotenv';
import { db } from './src/db/index.js';
import { elasticityTests } from './src/db/schema.js';
dotenv.config();

async function run() {
  await db.insert(elasticityTests).values({
    id: "c4ba6b3f-8226-4a6a-acff-e2f821661119",
    productId: "31095981", // DORITOS id
    status: 'validating_opt',
    priceA: 4.5,
    volA: 50,
    marginA: 100,
    priceB: 5.0,
    volB: 35,
    marginB: 87.5,
    cTotal: 2.5,
    elasticityCoef: -2.7,
    priceOpt: 4.8,
    expectedMarginOpt: 95,
    actualMarginOpt: 80,
    errorPercentage: 15.7,
  });
  console.log("Mock inserted");
  process.exit(0);
}
run();
