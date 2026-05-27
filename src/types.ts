export interface ProductStats {
  name: string;
  salesCount: number;
  minDate: Date;
  maxDate: Date;
  velocity: number | null;
  timeToSellOne: number | null;
  ruptureDays: number;
  uniqueSalesCount: number;
  grossVelocity: number | null;
  pixPercent: number;
  hhi: number;
  margin: number;
  status: string;
  volume: number;
}

export interface DailyFinancialStats {
  date: Date;
  dateStr: string;
  volume: number;
  transactions: number;
  faturamento: number;
  margemBruta: number;
  margemLiquida: number;
  deduction: number;
}

export interface MappedRow {
  date: Date;
  dayDate: Date;
  productName: string;
  buyerId: string;
  salePrice: number;
  costPrice: number;
  client: string;
  category: string;
  idCupom: string;
}

export interface MarketScatterStat {
  name: string;
  volumePercent: number;
  marginPercent: number;
  volume: number;
  margemLiquida: number;
  faturamento: number;
}

export interface ProductScatterStat {
  name: string;
  category: string;
  volumePercent: number;
  marginPercent: number;
  margemUnitaria: number;
  volume: number;
  margemLiquida: number;
  faturamento: number;
  totalCost: number;
}

export interface ActionPlanData {
  produto: string;
  frentes: number;
  volumeTotal: number;
  densidadeLucro: number;
  taxaDestino: number;
  cluster: string;
  acaoRecomendada: string;
}
