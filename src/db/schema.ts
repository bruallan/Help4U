import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export const dimCategorias = pgTable("dim_categorias", {
  id: integer("id").primaryKey(),
  nome: text("nome").notNull(),
});

export const dimProdutos = pgTable("dim_produtos", {
  id: integer("id").primaryKey(),
  produto: text("produto").notNull(),
  categoria: text("categoria"),
  categoriaId: integer("categoria_id"),
  codigoBarras: text("codigo_barras"),
  precoCusto: doublePrecision("preco_custo"),
  precoPadrao: doublePrecision("preco_padrao"),
  totalVendido: doublePrecision("total_vendido"),
  ncmCode: text("ncm_code"),
  cestCode: text("cest_code"),
  taxOperationId: integer("tax_operation_id"),
  taxOperationName: text("tax_operation_name"),
  quantidadeEstoque: doublePrecision("quantidade_estoque"),
});

export const dimCodigosDeBarra = pgTable("dim_codigos_de_barra", {
  idProduto: integer("id_produto").notNull(),
  codigoPrincipal: text("codigo_principal"),
  codigoAdicional: text("codigo_adicional").notNull(),
});

export const dimInstalacoes = pgTable("dim_instalacoes", {
  instalacaoId: integer("instalacao_id").primaryKey(),
  instalacao: text("instalacao").notNull(),
  maquinaId: integer("maquina_id").notNull(),
});

export const dimPlanogramas = pgTable("dim_planogramas", {
  planItemId: integer("plan_item_id").primaryKey(),
  instalacaoId: integer("instalacao_id").notNull(),
  instalacao: text("instalacao").notNull(),
  planId: integer("plan_id").notNull(),
  idProduto: integer("id_produto"),
  produto: text("produto"),
  saldo: doublePrecision("saldo"),
  nivelPar: doublePrecision("nivel_par"),
  nivelAlerta: doublePrecision("nivel_alerta"),
  usarNivelMinimo: boolean("usar_nivel_minimo"),
  nivelMinimo: doublePrecision("nivel_minimo"),
  preco: doublePrecision("preco"),
  usaPrecoPadrao: boolean("usa_preco_padrao"),
  precoPromocao: doublePrecision("preco_promocao"),
  status: text("status"),
  validade: timestamp("validade"),
  alternativoApenas: boolean("alternativo_apenas"),
  velocidadeMedia7d: doublePrecision("velocidade_media_7d"),
});

export const fatoVendas = pgTable("fato_vendas", {
  vendaId: text("venda_id").primaryKey(), // using text in case string id
  dataVenda: timestamp("data_venda").notNull(),
  produtoId: integer("produto_id"),
  produto: text("produto"),
  categoriaId: integer("categoria_id"),
  instalacao: text("instalacao"),
  cardNumber: text("card_number"),
  statusVenda: text("status_venda"),
  tipoCartao: text("tipo_cartao"),
  tipoPagamento: text("tipo_pagamento"),
  tipoPix: text("tipo_pix"),
  valor: doublePrecision("valor"),
  precoCusto: doublePrecision("preco_custo"),
  quantidade: doublePrecision("quantidade"),
});

export const fatoMovimentos = pgTable("fato_movimentos", {
  movimentoId: text("movimento_id").primaryKey(), // using text
  movimentoData: timestamp("movimento_data").notNull(),
  saldoAnterior: doublePrecision("saldo_anterior"),
  quantidade: doublePrecision("quantidade"),
  saldoFinal: doublePrecision("saldo_final"),
  produtoId: integer("produto_id"),
  produto: text("produto"),
  fornecedor: text("fornecedor"),
  operacaoTipo: text("operacao_tipo"),
  precoCusto: doublePrecision("preco_custo"),
});

export const lotesEstoque = pgTable("lotes_estoque", {
  idLote: serial("id_lote").primaryKey(),
  produtoId: integer("produto_id").references(() => dimProdutos.id),
  produto: text("produto"),
  dataValidade: timestamp("data_validade"),
  quantidadeAtual: integer("quantidade_atual"),
  instalacaoId: integer("instalacao_id"), // null = Depósito, otherwise Mercado
  status: text("status").default("consolidado"), // "consolidado", "aguardando_nota", "aguardando_validade"
  fornecedor: text("fornecedor"),
});

export const elasticityTests = pgTable('elasticity_tests', {
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
});

export const furtos = pgTable('furtos', {
  id: serial('id').primaryKey(),
  mercado: text('mercado').notNull(),
  dataFurto: timestamp('data_furto'),
  valor: doublePrecision('valor').notNull(),
  itens: text('itens'),
  status: text('status').notNull(), // 'recuperado', 'pendente'
  createdAt: timestamp('created_at').defaultNow(),
});

export const layoutGondola = pgTable("layout_gondola", {
  marketName: text("market_name").primaryKey(),
  columns: integer("columns").notNull(),
  rowsPerColumn: integer("rows_per_column").notNull(),
  rects: jsonb("rects").default('[]').notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const authorizedEmails = pgTable('authorized_emails', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  addedBy: text('added_by'),
  createdAt: timestamp('created_at').defaultNow(),
});
