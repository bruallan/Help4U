import * as dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { furtos } from '../src/db/schema.js';

dotenv.config();

const furtosData = [
  // Porto Sollare
  { mercado: 'Porto Sollare', dataFurto: new Date(2024, 6, 15), valor: 9.98, itens: 'guarana + h20h', status: 'pendente' },
  { mercado: 'Porto Sollare', dataFurto: new Date(2024, 6, 14), valor: 1.99, itens: 'Sal grosso', status: 'pendente' },
  { mercado: 'Porto Sollare', dataFurto: new Date(2024, 5, 28), valor: 9.99, itens: 'Geladinho', status: 'pendente' },
  { mercado: 'Porto Sollare', dataFurto: new Date(2024, 5, 5), valor: 16.47, itens: '3x Budweiser', status: 'recuperado' },
  { mercado: 'Porto Sollare', dataFurto: new Date(2024, 5, 1), valor: 6.99, itens: 'Suco Maratá Laranja 1L', status: 'recuperado' },

  // Villa
  { mercado: 'Villa', dataFurto: new Date(2024, 6, 15), valor: 60.14, itens: '3x whey + farinha lactea + atum + ecobag', status: 'recuperado' },
  { mercado: 'Villa', dataFurto: new Date(2024, 5, 14), valor: 19.88, itens: 'Bisc Treloso + Coca 1,5L', status: 'pendente' },

  // Alameda
  { mercado: 'Alameda', dataFurto: new Date(2024, 6, 10), valor: 3.99, itens: 'Ecobag', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 4), valor: 35.65, itens: 'varios itens', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 4, 31), valor: 6.89, itens: 'Farinha de trigo dona benta', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 26), valor: 3.99, itens: 'Pão francês', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 6, 22), valor: 3.89, itens: 'salg fangandos', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 6, 4), valor: 25.98, itens: '2x Saco de carvão', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 6, 9), valor: 65.43, itens: '1 escondidinho + 5 pizzas + 1 bisc', status: 'pendente' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 7), valor: 24.97, itens: '2 brotinhos + 1 bisc caseiro', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 9), valor: 5.07, itens: '3x Esponjas', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 3), valor: 27.98, itens: 'manteiga + choc prontu 50% cacau', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 5, 2), valor: 8.27, itens: 'hamb + pepsi', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 4, 29), valor: 53.00, itens: 'vários itens', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 4, 31), valor: 32.26, itens: 'vários itens', status: 'recuperado' },
  { mercado: 'Alameda', dataFurto: new Date(2024, 6, 5), valor: 46.51, itens: 'vários itens', status: 'recuperado' },

  // Jardim Das H.
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 29), valor: 25.99, itens: 'File de peito 1kg', status: 'recuperado' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 27), valor: 4.79, itens: 'Amstel', status: 'recuperado' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 28), valor: 4.99, itens: 'sprite', status: 'recuperado' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 28), valor: 3.29, itens: 'KRO Cebola', status: 'recuperado' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 21), valor: 1.98, itens: 'Baton branco', status: 'pendente' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 4, 29), valor: 3.25, itens: 'trident azul', status: 'pendente' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 6, 25), valor: 1.99, itens: 'Água mineral', status: 'pendente' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 21), valor: 4.79, itens: 'Amstel', status: 'pendente' },
  { mercado: 'Jardim Das H.', dataFurto: new Date(2024, 5, 29), valor: 5.49, itens: 'Budweiser', status: 'pendente' },

  // Verde Vida
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 5, 28), valor: 3.99, itens: 'Creme de Leite', status: 'recuperado' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 5, 28), valor: 5.49, itens: 'Kit Kat', status: 'recuperado' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 6, 4), valor: 7.69, itens: 'Café Nescafé', status: 'recuperado' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 6, 1), valor: 10.37, itens: '2x Cerveja itaipava + água', status: 'pendente' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 5, 27), valor: 8.98, itens: 'pao frances + sprite', status: 'pendente' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 5, 25), valor: 12.99, itens: 'Choc Barra Alpino (Erro amarelo)', status: 'pendente' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 6, 20), valor: 6.89, itens: 'Farinha de Trigo', status: 'pendente' },
  { mercado: 'Verde Vida', dataFurto: new Date(2024, 6, 2), valor: 9.99, itens: 'Brownie', status: 'pendente' },

  // Parque Das V / Parque Das V.
  { mercado: 'Parque Das Violetas', dataFurto: new Date(2024, 5, 12), valor: 6.99, itens: 'Suco Uva 1,5L', status: 'pendente' },
  { mercado: 'Parque Das Violetas', dataFurto: new Date(2024, 5, 12), valor: 5.49, itens: 'Salg Cebolitos', status: 'pendente' },
  { mercado: 'Parque Das Violetas', dataFurto: new Date(2024, 5, 19), valor: 25.16, itens: '2x salg sol + coca 350ml + picole', status: 'pendente' },

  // Jardim
  { mercado: 'Jardim', dataFurto: new Date(2024, 4, 30), valor: 5.49, itens: 'barra rech snickers', status: 'pendente' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 5, 10), valor: 29.46, itens: '2x agua + coca 1,5L + alpino', status: 'recuperado' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 5, 9), valor: 19.98, itens: '2x geladinho gelatto', status: 'recuperado' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 5, 9), valor: 4.49, itens: 'Guaraná', status: 'recuperado' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 4, 8), valor: 2.59, itens: 'Baton branco', status: 'recuperado' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 4, 8), valor: 4.99, itens: 'Sprit 350ml', status: 'recuperado' },
  { mercado: 'Jardim', dataFurto: new Date(2024, 5, 1), valor: 14.99, itens: 'Energético Monster Zero', status: 'recuperado' },

  // Villa Dos P.
  { mercado: 'Villa Dos P.', dataFurto: new Date(2024, 5, 29), valor: 3.89, itens: 'Milho de Pipoca', status: 'pendente' },
  { mercado: 'Villa Dos P.', dataFurto: new Date(2024, 6, 16), valor: 12.99, itens: 'Barra de chocolate oreo', status: 'pendente' },
];

async function run() {
  await db.delete(furtos);
  const result = await db.insert(furtos).values(furtosData).returning();
  console.log(`Inserted ${result.length} furtos`);
  process.exit(0);
}
run();
