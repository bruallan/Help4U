import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Search, FileSpreadsheet, AlertCircle, Loader2, LayoutDashboard, ShoppingCart, TrendingUp, Menu, X, ZoomIn, ZoomOut, Download, Wallet, Calendar, ChevronDown, Check, Dot, Activity, Sun, Moon, Package, ShoppingBag, Map as MapIcon, ShieldAlert, Building, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ComposedChart, Bar, LineChart, Line, Legend, ReferenceLine } from 'recharts';

import { cn, parseExcelDate, formatCurrency } from './utils';
import { CATEGORY_COLORS } from './constants';
import type { 
  ProductStats, DailyFinancialStats, MappedRow, 
  MarketScatterStat, ProductScatterStat, ActionPlanData 
} from './types';

import { 
  CustomTooltip, CustomFinancialTooltip, 
  CustomMarketScatterTooltip, CustomProductScatterTooltip 
} from './components/Tooltips';
import { ProductDropdown, UnitDropdown } from './components/Dropdowns';
import { PosEstocagem } from './components/PosEstocagem';
import { AnaliseCesta } from './components/AnaliseCesta';
import { MapaCalor } from './components/MapaCalor';
import { GestaoValidade } from './components/GestaoValidade';
import ValidadeEstoque from './components/ValidadeEstoque';
import AuditoriaVMPay from './components/AuditoriaVMPay';
import RepasseSindicos from './components/RepasseSindicos';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export default function App() {
  const processFile = (file: File) => { console.warn("Upload local inativo.") };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [stats, setStats] = useState<ProductStats[]>([]);
  const [financialStats, setFinancialStats] = useState<DailyFinancialStats[]>([]);
  const [marketScatterStats, setMarketScatterStats] = useState<MarketScatterStat[]>([]);
  const [productScatterStats, setProductScatterStats] = useState<ProductScatterStat[]>([]);
  const [dailyProductPerformances, setDailyProductPerformances] = useState<any[]>([]);
  const [desempenhoSelectedProducts, setDesempenhoSelectedProducts] = useState<string[]>([]);
  
  const [mensalSelectedMarkets, setMensalSelectedMarkets] = useState<string[]>([]);
  const [mensalSelectedYear, setMensalSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [mensalAvailableYears, setMensalAvailableYears] = useState<string[]>([]);
  const [mensalMetric, setMensalMetric] = useState<'volume' | 'faturamento' | 'margem_bruta' | 'margem_liquida'>('faturamento');
  const [monthlyPerformanceData, setMonthlyPerformanceData] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadGlobalData = async () => {
      setIsLoading(true);
      try {
        const uniqueClients = new Set<string>();
        let globalMinD: Date | null = null;
        let globalMaxD: Date | null = null;

        const res = await fetch(`${API_BASE}/api/sales`);
        if (!res.ok) throw new Error('Falha ao buscar vendas do Supabase');
        const salesRows = await res.json();
        
        const combinedRows = salesRows.map((row: any) => {
          const dayD = new Date(row.dayDate);
          if (!globalMinD || dayD.getTime() < globalMinD.getTime()) globalMinD = dayD;
          if (!globalMaxD || dayD.getTime() > globalMaxD.getTime()) globalMaxD = dayD;
          
          if (row.client) uniqueClients.add(row.client);
          
          return {
            ...row,
            date: new Date(row.date),
            dayDate: dayD,
            salePrice: Number(row.salePrice),
            costPrice: Number(row.costPrice)
          };
        });

        if (globalMinD && globalMaxD) {
          const minStr = (globalMinD as Date).toISOString().split('T')[0];
          const maxStr = (globalMaxD as Date).toISOString().split('T')[0];
          setDatasetMinDate(minStr);
          setDatasetMaxDate(maxStr);
          setFilterStartDate(minStr);
          setFilterEndDate(maxStr);
        }

        if (combinedRows.length > 0) {
          const available = Array.from(uniqueClients).sort() as string[];
          setAvailableUnits(available);
          setSelectedUnits(available);
          setRawData(combinedRows);
        }
      } catch (err: any) {
        console.error('Error loading cloud data', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGlobalData();
  }, []);

  const [activeTab, setActiveTab] = useState<'vendas' | 'indicadores' | 'lucro_fluxo' | 'dispersao_mercados' | 'dispersao_produtos' | 'desempenho_tipo' | 'plano_acao' | 'pos_estocagem' | 'analise_cesta' | 'mapa_calor' | 'desempenho_mensal' | 'gestao_validade' | 'auditoria' | 'repasse_sindicos' | 'validade_estoque'>('vendas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  
  const [rawData, setRawData] = useState<MappedRow[] | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline-block text-slate-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1 inline-block text-orange-600 dark:text-orange-400" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1 inline-block text-orange-600 dark:text-orange-400" />;
  };

  const applySort = <T,>(data: T[], defaultSort?: (a: T, b: T) => number): T[] => {
    if (!sortConfig) return defaultSort ? [...data].sort(defaultSort) : data;
    return [...data].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const syncAbortControllerRef = useRef<AbortController | null>(null);

  const handleSyncVMPay = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus({ isSyncing: true, status: 'loading', currentDate: '', totalDays: 0, currentDay: 0, error: '' });

    try {
      const res = await fetch(`${API_BASE}/api/sync-db`, { method: 'POST' });
      if (!res.ok) {
        let errStr = "Erro desconhecido";
        try { const d = await res.json(); errStr = d.error || d.message || res.statusText; } catch(e){}
        throw new Error(errStr);
      }
      
      const data = await res.json();
      console.log('Sync result:', data);

      setSyncStatus({ isSyncing: false, status: 'completed', error: '', currentDate: '', totalDays: 0, currentDay: 0 });
      setIsSyncing(false);
      alert('Sincronização do Supabase concluída com sucesso:\n' + data.message);
      window.location.reload(); 
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao iniciar sincronização: ${err.message}`);
      setIsSyncing(false);
      setSyncStatus({ isSyncing: false, status: 'error', error: err.message, currentDate: '', totalDays: 0, currentDay: 0 });
    }
  };
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [datasetMinDate, setDatasetMinDate] = useState<string>('');
  const [datasetMaxDate, setDatasetMaxDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [scatterCategoryFilter, setScatterCategoryFilter] = useState<string>('Todas');

  // Clustering Variables / Settings
  const [frentesParam, setFrentesParam] = useState<Record<string, number>>({});
  const [thresholdDestino, setThresholdDestino] = useState<number>(0.30);
  const [internalThresholds, setInternalThresholds] = useState<{giro: number, densidade: number}>({giro: 0, densidade: 0});
  const [actionPlanData, setActionPlanData] = useState<ActionPlanData[]>([]);

  const [xDomain, setXDomain] = useState<[number, number]>([0, 10000]);
  const [yDomain, setYDomain] = useState<[number, number]>([0, 100]);
  const [isZoomed, setIsZoomed] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [maxVol, setMaxVol] = useState(100);
  
  const calculateActionPlan = useCallback(() => {
    if (!rawData) return;
    
    const filterStartMs = filterStartDate ? new Date(filterStartDate + 'T00:00:00').getTime() : null;
    const filterEndMs = filterEndDate ? new Date(filterEndDate + 'T23:59:59').getTime() : null;

    const filteredRows = rawData.filter(row => {
      if (filterStartMs && row.dayDate.getTime() < filterStartMs) return false;
      if (filterEndMs && row.dayDate.getTime() > filterEndMs) return false;
      if (selectedUnits.length > 0 && row.client && !selectedUnits.includes(row.client)) return false;
      return true;
    });

    // 1. Group tickets by idCupom to count distinct SKUs
    const ticketMap = new Map<string, Set<string>>(); // idCupom -> set of product names
    for (const row of filteredRows) {
      if (!ticketMap.has(row.idCupom)) {
        ticketMap.set(row.idCupom, new Set());
      }
      ticketMap.get(row.idCupom)!.add(row.productName);
    }

    // 2. Aggregate per product
    const prodMap = new Map<string, {
      volume: number;
      margemLiquidaTotal: number;
      ticketsTotais: Set<string>;
      ticketsExclusivos: Set<string>;
    }>();

    for (const row of filteredRows) {
      const pName = row.productName;
      if (!prodMap.has(pName)) {
         prodMap.set(pName, { volume: 0, margemLiquidaTotal: 0, ticketsTotais: new Set(), ticketsExclusivos: new Set() });
      }
      const pData = prodMap.get(pName)!;
      
      // Volume
      pData.volume += 1;
      
      // Margem Líquida Unitária Real (dedução flat de 25%)
      const itemMargem = row.salePrice - row.costPrice - (row.salePrice * 0.25);
      pData.margemLiquidaTotal += itemMargem;
      
      // Taxa destino tracking
      pData.ticketsTotais.add(row.idCupom);
      if (ticketMap.get(row.idCupom)!.size === 1) {
        pData.ticketsExclusivos.add(row.idCupom);
      }
    }

    const interimData = Array.from(prodMap.entries()).map(([produto, data]) => {
      const frentes = frentesParam[produto] || 1;
      const densidadeLucro = data.margemLiquidaTotal / frentes;
      const taxaDestino = data.ticketsTotais.size > 0 ? (data.ticketsExclusivos.size / data.ticketsTotais.size) : 0;
      
      return {
        produto,
        frentes,
        volumeTotal: data.volume,
        densidadeLucro,
        taxaDestino
      };
    });

    // Calc medians if auto
    const vols = interimData.map(d => d.volumeTotal).sort((a,b)=>a-b);
    const dens = interimData.map(d => d.densidadeLucro).sort((a,b)=>a-b);
    
    const medGiro = vols.length > 0 ? vols[Math.floor(vols.length/2)] : 0;
    const medDens = dens.length > 0 ? dens[Math.floor(dens.length/2)] : 0;
    
    setInternalThresholds({ giro: medGiro, densidade: medDens });
    
    // We will use medians directly as default. Let's just use it as threshold if state is 0/null.
    // However, since we might want to manually adjust it, we use the thresholds provided by state if they exist.
    // If the state is 0, we can use medians.
    const finalThresholdGiro = medGiro; // Just hardcode to median or we could introduce more inputs
    const finalThresholdDensidade = medDens;

    const finalPlan: ActionPlanData[] = interimData.map(d => {
      let cluster = '3 - Análise Manual (Baixa Intenção, Baixo Giro, Alta Densidade)'; // Fallback based on logical combinations
      let acaoRecomendada = '-';

      // Rules explicitly from prompt
      if (d.taxaDestino >= thresholdDestino && d.volumeTotal >= finalThresholdGiro) {
        cluster = '1 - Tratores';
        acaoRecomendada = 'Mover para o Fundo';
      } else if (d.taxaDestino >= thresholdDestino && d.volumeTotal < finalThresholdGiro) {
        cluster = '4 - Urgência Estratégica';
        acaoRecomendada = 'Posição Fria / Reduzir Frente / Aumentar Markup';
      } else if (d.taxaDestino < thresholdDestino && d.densidadeLucro >= finalThresholdDensidade) {
        cluster = '2 - Ouro de Impulso';
        acaoRecomendada = 'Checkout / Pontos Quentes';
      } else if (d.taxaDestino < thresholdDestino && d.densidadeLucro < finalThresholdDensidade && d.volumeTotal < finalThresholdGiro) {
        cluster = '5 - Inadimplentes';
        acaoRecomendada = 'Alerta de Guilhotina';
      } else {
        cluster = '3 - Análise Manual';
        acaoRecomendada = 'Avaliar individualmente';
      }

      return {
        ...d,
        cluster,
        acaoRecomendada
      };
    });

    setActionPlanData(finalPlan);
  }, [rawData, filterStartDate, filterEndDate, selectedUnits, frentesParam, thresholdDestino]);

  useEffect(() => {
    calculateActionPlan();
  }, [calculateActionPlan]);

  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState<{x: number, y: number} | null>(null);

  const exportToExcel = () => {
    const dataToExport = filteredStats.map(stat => {
      const vel = stat.velocity ?? 0;
      const alerta = vel * 4;
      return {
        'Tipo': 'Canaleta',
        'Canaleta': '',
        'Produto': stat.name,
        'Quantidade': '',
        'Capacidade': '1000',
        'Nível de par': '',
        'Categoria': '',
        'Nível de alerta': alerta,
        'Utilizar nível mínimo': 'Sim',
        'Nível mínimo': Math.round(alerta),
        'Preço desejado': '',
        'Estado': '',
        'Alternativo': ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: [
      'Tipo', 'Canaleta', 'Produto', 'Quantidade', 'Capacidade', 'Nível de par', 'Categoria', 'Nível de alerta', 'Utilizar nível mínimo', 'Nível mínimo', 'Preço desejado', 'Estado', 'Alternativo'
    ]});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exportação Vendas");
    XLSX.writeFile(wb, "exportacao_vendas.xlsx");
  };

  useEffect(() => {
    if (!rawData) return;
    
    setIsLoading(true);
    const timer = setTimeout(() => {
      try {
        const productMap = new Map<string, { 
          dates: Date[], 
          buyers: Map<string, number>, 
          pixCount: number, 
          totalSale: number, 
          totalCost: number,
          totalDeduction: number,
          category: string
        }>();
        
        let processedCount = 0;
        let globalMinDay: Date | null = null;
        let globalMaxDay: Date | null = null;
        const globalBuyers = new Set<string>();
        const dailyFinances = new Map<string, DailyFinancialStats>();
        const dailyProdPerfMap = new Map<string, any>();
        
        // Market stats map to calculate "Dispersão"
        interface MarketStatsBuilder {
          name: string;
          volume: number;
          faturamento: number;
          margemBruta: number;
          deduction: number;
        }
        const marketStatsMap = new Map<string, MarketStatsBuilder>();
        
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        const getTaxRateForClient = (clientName: string) => {
          if (!clientName) return 0.20;
          const lower = clientName.toLowerCase();
          if (lower.includes('alameda')) return 0.27;
          if (lower.includes('porto') || lower.includes('sollare')) return 0.245;
          if (lower.includes('villa')) return 0.25;
          if (lower.includes('verde vida') || lower.includes('verdevida')) return 0.235;
          if (lower.includes('jardim') || lower.includes('hortências') || lower.includes('hortencias')) return 0.24;
          return 0.20; // Default fallback
        };
        
        const filterStartMs = filterStartDate ? new Date(filterStartDate + 'T00:00:00').getTime() : null;
        const filterEndMs = filterEndDate ? new Date(filterEndDate + 'T23:59:59').getTime() : null;

        const filteredRows = rawData.filter(row => {
          if (filterStartMs && row.dayDate.getTime() < filterStartMs) return false;
          if (filterEndMs && row.dayDate.getTime() > filterEndMs) return false;
          if (selectedUnits.length > 0 && row.client && !selectedUnits.includes(row.client)) return false;
          return true;
        });

        // Agrupamento de Vendas / Transações (3 segundos)
        const sortedForTx = [...filteredRows].sort((a, b) => {
          if (a.client < b.client) return -1;
          if (a.client > b.client) return 1;
          return a.date.getTime() - b.date.getTime();
        });

        let currentTxStartTime = 0;
        let currentTxClient = '';
        const txCountPerDay = new Map<string, number>();

        for (const row of sortedForTx) {
          const rowTime = row.date.getTime();
          const rowClient = row.client;
          const dateStr = row.dayDate.toISOString().split('T')[0];

          if (rowClient !== currentTxClient || (rowTime - currentTxStartTime) > 3000) {
             txCountPerDay.set(dateStr, (txCountPerDay.get(dateStr) || 0) + 1);
             currentTxClient = rowClient;
             currentTxStartTime = rowTime;
          }
        }

        for (let i = 0; i < filteredRows.length; i++) {
          const row = filteredRows[i];
          
          if (!globalMinDay || row.dayDate.getTime() < globalMinDay.getTime()) globalMinDay = row.dayDate;
          if (!globalMaxDay || row.dayDate.getTime() > globalMaxDay.getTime()) globalMaxDay = row.dayDate;
          
          const nameStr = row.productName;
          
          if (row.buyerId) {
            globalBuyers.add(row.buyerId);
          }
        
        if (!productMap.has(nameStr)) {
          productMap.set(nameStr, { dates: [], buyers: new Map(), pixCount: 0, totalSale: 0, totalCost: 0, totalDeduction: 0, category: row.category || 'Sem Categoria' });
        }
        
        const pData = productMap.get(nameStr)!;
        pData.dates.push(row.date);
        if (row.buyerId) {
          pData.buyers.set(row.buyerId, (pData.buyers.get(row.buyerId) || 0) + 1);
        } else {
          pData.pixCount++;
        }
        const currentTaxRate = getTaxRateForClient(row.client);
        const itemDeduction = row.salePrice * currentTaxRate;
        const testMargemLiquida = row.salePrice - row.costPrice - itemDeduction;
        
        if (testMargemLiquida < 0) {
          row.costPrice = 0;
        }

        pData.totalSale += row.salePrice;
        pData.totalCost += row.costPrice;
        pData.totalDeduction += itemDeduction;
        
        // --- Daily financial calc ---
        const dateStr = row.dayDate.toISOString().split('T')[0];
        if (!dailyFinances.has(dateStr)) {
          dailyFinances.set(dateStr, {
            date: row.dayDate,
            dateStr: row.dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            volume: 0,
            transactions: txCountPerDay.get(dateStr) || 0,
            faturamento: 0,
            margemBruta: 0,
            margemLiquida: 0,
            deduction: 0
          });
        }
        
        if (!dailyProdPerfMap.has(dateStr)) {
          dailyProdPerfMap.set(dateStr, {
            date: row.dayDate,
            dateStr: row.dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          });
        }
        const dayPerf = dailyProdPerfMap.get(dateStr)!;
        dayPerf[nameStr] = (dayPerf[nameStr] || 0) + 1;

        const dayStats = dailyFinances.get(dateStr)!;
        
        dayStats.volume += 1;
        dayStats.faturamento += row.salePrice;
        
        const itemMargemBruta = row.salePrice - row.costPrice;
        
        dayStats.margemBruta += itemMargemBruta;
        dayStats.deduction += itemDeduction;
        
        const clientName = row.client || 'Desconhecido';
        if (!marketStatsMap.has(clientName)) {
           marketStatsMap.set(clientName, { name: clientName, volume: 0, faturamento: 0, margemBruta: 0, deduction: 0 });
        }
        const mStats = marketStatsMap.get(clientName)!;
        mStats.volume += 1;
        mStats.faturamento += row.salePrice;
        mStats.margemBruta += itemMargemBruta;
        mStats.deduction += itemDeduction;
        
        processedCount++;
      }
      
      if (processedCount === 0) {
        throw new Error('Nenhum dado válido encontrado. Verifique se as datas estão na Coluna A e os nomes na Coluna N.');
      }
      
      const newStats: ProductStats[] = [];
      const totalGlobalDays = globalMinDay && globalMaxDay 
        ? Math.round((globalMaxDay.getTime() - globalMinDay.getTime()) / 86400000) + 1 
        : 30;
        
      const totalGlobalBuyers = globalBuyers.size > 0 ? globalBuyers.size : 1;
      
      let tempProdStats: any[] = [];
      let maxProdVolume = 0;
      
      for (const [name, data] of productMap.entries()) {
        const dates = data.dates.sort((a, b) => a.getTime() - b.getTime());
        const salesCount = dates.length;
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];
        
        const uniqueDays: Date[] = [];
        for (const d of dates) {
          const day = startOfDay(d);
          if (uniqueDays.length === 0 || day.getTime() > uniqueDays[uniqueDays.length - 1].getTime()) {
            uniqueDays.push(day);
          }
        }
        const uniqueSalesCount = uniqueDays.length;
        
        let timeInDays = totalGlobalDays;
        let ruptureDays = 0;
        
        if (salesCount <= 5) {
          timeInDays = totalGlobalDays;
        } else {
          const gaps: number[] = [];
          for (let i = 1; i < uniqueDays.length; i++) {
            gaps.push(Math.round((uniqueDays[i].getTime() - uniqueDays[i-1].getTime()) / 86400000));
          }
          
          let internalRuptureDays = 0;
          if (gaps.length > 0) {
            const sortedGaps = [...gaps].sort((a, b) => a - b);
            const medianGap = sortedGaps.length % 2 === 0 
              ? (sortedGaps[sortedGaps.length / 2 - 1] + sortedGaps[sortedGaps.length / 2]) / 2
              : sortedGaps[Math.floor(sortedGaps.length / 2)];
              
            for (const gap of gaps) {
              if (gap > 1 && gap >= 3 * medianGap) {
                internalRuptureDays += (gap - 1);
              }
            }
          }
          
          let edgeRuptureDays = 0;
          if (globalMinDay && globalMaxDay) {
            const firstDay = uniqueDays[0];
            const lastDay = uniqueDays[uniqueDays.length - 1];
            
            const edgeBefore = Math.round((firstDay.getTime() - globalMinDay.getTime()) / 86400000);
            const edgeAfter = Math.round((globalMaxDay.getTime() - lastDay.getTime()) / 86400000);
            
            edgeRuptureDays = edgeBefore + edgeAfter;
          }
          
          ruptureDays = internalRuptureDays + edgeRuptureDays;
          timeInDays = totalGlobalDays - ruptureDays;
          
          if (timeInDays <= 0) {
            timeInDays = totalGlobalDays; // fallback
          }
        }
        
        let velocity: number | null = null;
        let timeToSellOne: number | null = null;
        
        if (timeInDays > 0) {
          velocity = salesCount / timeInDays;
          timeToSellOne = timeInDays / salesCount;
        }
        
        // Novas Métricas
        const volume = salesCount;
        const pixPercent = volume > 0 ? (data.pixCount / volume) * 100 : 0;
        
        let identifiedVolume = 0;
        for (const count of data.buyers.values()) {
          identifiedVolume += count;
        }
        
        let hhi = 0;
        if (identifiedVolume > 0) {
          for (const count of data.buyers.values()) {
            const share = (count / identifiedVolume) * 100;
            hhi += (share * share);
          }
        }
        
        const margin = data.totalSale > 0 ? ((data.totalSale - data.totalCost) / data.totalSale) * 100 : 0;
        
        // Velocidade Bruta
        const grossDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000));
        const grossVelocity = volume / grossDays;

        const margemLiquidaProd = data.totalSale - data.totalCost - data.totalDeduction;
        const marginPercentProd = data.totalSale > 0 ? (margemLiquidaProd / data.totalSale) * 100 : 0;
        if (volume > maxProdVolume) maxProdVolume = volume;

        tempProdStats.push({
           name,
           category: data.category,
           volume,
           marginPercent: marginPercentProd,
           faturamento: data.totalSale,
           margemLiquida: margemLiquidaProd,
           totalCost: data.totalCost
        });

        newStats.push({
          name,
          salesCount,
          minDate,
          maxDate,
          velocity,
          timeToSellOne,
          ruptureDays,
          uniqueSalesCount,
          grossVelocity,
          pixPercent,
          hhi,
          margin,
          status: '', // Será preenchido abaixo
          volume
        });
      }
      
      // Calcular medianas para quadrantes
      const volumes = newStats.map(s => s.volume).sort((a, b) => a - b);
      const medianVolume = volumes[Math.floor(volumes.length / 2)] || 0;
      const HHI_CUTOFF = 2500;
      
      newStats.forEach(s => {
        if (s.volume >= medianVolume && s.hhi > HHI_CUTOFF) s.status = 'Alerta de Risco';
        else if (s.volume >= medianVolume && s.hhi <= HHI_CUTOFF) s.status = 'Motor da Loja';
        else if (s.volume < medianVolume && s.hhi <= HHI_CUTOFF) s.status = 'Cauda Longa';
        else s.status = 'Venda Monopolizada Menor';
      });
      
      newStats.sort((a, b) => {
        if (a.velocity === null && b.velocity === null) return 0;
        if (a.velocity === null) return 1;
        if (b.velocity === null) return -1;
        return b.velocity - a.velocity;
      });
      
      const sortedDays = Array.from(dailyFinances.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
      sortedDays.forEach(day => {
        day.margemLiquida = day.margemBruta - day.deduction;
      });
      setFinancialStats(sortedDays);

      const sortedDailyPerf = Array.from(dailyProdPerfMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
      setDailyProductPerformances(sortedDailyPerf);
      
      const marketArray = Array.from(marketStatsMap.values());
      const globalVolume = marketArray.reduce((acc, m) => acc + m.volume, 0);
      
      const newScatterStats: MarketScatterStat[] = marketArray.map(m => {
         const margemLiquida = m.margemBruta - m.deduction;
         const volumePercent = globalVolume > 0 ? (m.volume / globalVolume) * 100 : 0;
         const marginPercent = m.faturamento > 0 ? (margemLiquida / m.faturamento) * 100 : 0;
         return {
            name: m.name,
            volumePercent,
            marginPercent,
            volume: m.volume,
            faturamento: m.faturamento,
            margemLiquida
         };
      });
      setMarketScatterStats(newScatterStats);
      
      const categorySet = new Set<string>();
      const finalProdScatterStats: ProductScatterStat[] = tempProdStats.map(p => {
         categorySet.add(p.category);
         return {
           ...p,
           margemUnitaria: p.volume > 0 ? p.margemLiquida / p.volume : 0,
           volumePercent: medianVolume > 0 ? (p.volume / (medianVolume * 2)) * 100 : 0
         };
      });
      setProductScatterStats(finalProdScatterStats);
      
      setStats(newStats);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar o arquivo no período selecionado.');
      setStats([]);
      setFinancialStats([]);
    } finally {
      setIsLoading(false);
    }
    }, 50);

    return () => clearTimeout(timer);
  }, [rawData, filterStartDate, filterEndDate, selectedUnits]);

  useEffect(() => {
    if (!rawData) return;
    
    const yearsInfo = new Set<string>();
    rawData.forEach(r => yearsInfo.add(r.date.getFullYear().toString()));
    const availYears = Array.from(yearsInfo).sort((a,b) => b.localeCompare(a));
    setMensalAvailableYears(availYears);
    
    if (!availYears.includes(mensalSelectedYear) && availYears.length > 0) {
       setMensalSelectedYear(availYears[0]);
    }
  }, [rawData]);

  useEffect(() => {
    if (!rawData) return;

    // Se nenhum mercado selecionado, usar todos disponíveis (ou inicializar)
    const marketsToUse = mensalSelectedMarkets.length > 0 ? mensalSelectedMarkets : availableUnits;
    if (marketsToUse.length === 0) return;

    const dataByMonth = new Map<number, Record<string, number>>();
    // Inicializar meses 0 a 11
    for (let i = 0; i < 12; i++) {
        const monthObj: Record<string, number> = {};
        marketsToUse.forEach(m => monthObj[m] = 0);
        dataByMonth.set(i, monthObj);
    }

    const getTaxRateForClient = (clientName: string) => {
        const cLower = clientName.toLowerCase();
        if (cLower.includes('ifood')) return 0.23;
        if (cLower.includes('rappi')) return 0.20;
        return 0; // Default or Outros is 0
    };

    const yearData = rawData.filter(row => row.date.getFullYear().toString() === mensalSelectedYear);
    
    // Sort to apply the transaction grouping logic (by client and date)
    const sortedData = [...yearData].sort((a, b) => {
        const clientA = a.client || 'Desconhecido';
        const clientB = b.client || 'Desconhecido';
        if (clientA !== clientB) return clientA.localeCompare(clientB);
        return a.date.getTime() - b.date.getTime();
    });

    let currentTxStartTime = 0;
    let currentTxClient = '';
    
    // First, process non-volume metrics which just sum up per item
    if (mensalMetric !== 'volume') {
      yearData.forEach(row => {
          const clientName = row.client || 'Desconhecido';
          if (!marketsToUse.includes(clientName)) return;

          const monthIdx = row.date.getMonth();
          const sp = row.salePrice || 0;
          const cp = row.costPrice || 0;
          const taxRate = getTaxRateForClient(clientName);
          const ded = sp * taxRate;
          const mb = sp - cp;
          const ml = mb - ded;

          let valToAdd = 0;
          if (mensalMetric === 'faturamento') valToAdd = sp;
          else if (mensalMetric === 'margem_bruta') valToAdd = mb;
          else if (mensalMetric === 'margem_liquida') valToAdd = ml;

          const monthObj = dataByMonth.get(monthIdx)!;
          monthObj[clientName] = (monthObj[clientName] || 0) + valToAdd;
      });
    } else {
      // If volume, we count unique transactions
      sortedData.forEach(row => {
          const clientName = row.client || 'Desconhecido';
          if (!marketsToUse.includes(clientName)) return;

          const monthIdx = row.date.getMonth();
          const rowTime = row.date.getTime();
          
          if (clientName !== currentTxClient || (rowTime - currentTxStartTime) > 3000) {
              const monthObj = dataByMonth.get(monthIdx)!;
              monthObj[clientName] = (monthObj[clientName] || 0) + 1;
              currentTxClient = clientName;
              currentTxStartTime = rowTime;
          }
      });
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const formattedData = Array.from(dataByMonth.entries()).map(([mIdx, mData]) => {
        return {
            name: monthNames[mIdx],
            ...mData
        };
    });

    setMonthlyPerformanceData(formattedData);
  }, [rawData, mensalSelectedMarkets, mensalSelectedYear, mensalMetric, availableUnits]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const filteredStats = useMemo(() => {
    if (!searchTerm) return stats;
    const lowerTerm = searchTerm.toLowerCase();
    return stats.filter(stat => stat.name.toLowerCase().includes(lowerTerm));
  }, [stats, searchTerm]);

  const zDomain = useMemo(() => {
    if (stats.length === 0) return [0, 100];
    const margins = stats.map(s => s.margin);
    return [Math.min(...margins), Math.max(...margins)];
  }, [stats]);

  const availableCategories = useMemo(() => {
    return ['Todas', ...Array.from(new Set(productScatterStats.map(p => p.category))).sort()];
  }, [productScatterStats]);

  const filteredProductScatterStats = useMemo(() => {
    if (scatterCategoryFilter === 'Todas') return productScatterStats;
    return productScatterStats.filter(p => p.category === scatterCategoryFilter);
  }, [productScatterStats, scatterCategoryFilter]);

  const levelCurvesData = useMemo(() => {
    if (productScatterStats.length === 0) return [];
    
    const volumes = productScatterStats.map(s => s.volume).sort((a, b) => a - b);
    const medianVolume = volumes[Math.floor(volumes.length / 2)] || 0;
    if (medianVolume === 0) return [];
    
    // Gerando pontos para as curvas de isovalor da Margem Líquida Total = Volume * MargemUnitaria
    // Y (Margem Unitária R$) = E / VolumeAbsoluto
    // Sabendo que X é (VolumeAbsoluto / (2*Media)) * 100
    // Logo: VolumeAbsoluto = X * 2 * Mediana / 100
    // Y = (E * 100) / (X * 2 * Mediana)
    const points = [];
    // Eixo X de 5% a 500%
    for (let x = 1; x <= 500; x += 2) {
      const volAbsoluto = (x * 2 * medianVolume) / 100;
      if (volAbsoluto === 0) continue;

      points.push({
        volumePercent: x,
        faixa_50: 50 / volAbsoluto,
        faixa_100: 100 / volAbsoluto,
        faixa_150: 150 / volAbsoluto,
        faixa_200: 200 / volAbsoluto,
        faixa_300: 300 / volAbsoluto,
      });
    }
    return points;
  }, [productScatterStats]);

  useEffect(() => {
    if (stats.length > 0) {
      const maxV = Math.max(...stats.map(s => s.volume));
      const newMaxVol = Math.ceil(maxV * 1.1);
      setMaxVol(newMaxVol);
      setYDomain([0, newMaxVol]);
      setXDomain([0, 10000]);
      setIsZoomed(false);
    }
  }, [stats]);

  const handleZoomIn = () => {
    setIsZoomed(true);
    setXDomain(prev => {
      const range = prev[1] - prev[0];
      const center = (prev[0] + prev[1]) / 2;
      const newRange = range / 1.5;
      return [Math.max(0, center - newRange / 2), Math.min(10000, center + newRange / 2)];
    });
    setYDomain(prev => {
      const range = prev[1] - prev[0];
      const center = (prev[0] + prev[1]) / 2;
      const newRange = range / 1.5;
      return [Math.max(0, center - newRange / 2), Math.min(maxVol, center + newRange / 2)];
    });
  };

  const handleZoomOut = () => {
    setIsZoomed(true);
    setXDomain(prev => {
      const range = prev[1] - prev[0];
      const center = (prev[0] + prev[1]) / 2;
      const newRange = range * 1.5;
      let newMin = center - newRange / 2;
      let newMax = center + newRange / 2;
      if (newMax - newMin >= 10000) return [0, 10000];
      if (newMin < 0) { newMax -= newMin; newMin = 0; }
      if (newMax > 10000) { newMin -= (newMax - 10000); newMax = 10000; }
      if (newMin < 0) newMin = 0;
      return [newMin, newMax];
    });
    setYDomain(prev => {
      const range = prev[1] - prev[0];
      const center = (prev[0] + prev[1]) / 2;
      const newRange = range * 1.5;
      let newMin = center - newRange / 2;
      let newMax = center + newRange / 2;
      if (newMax - newMin >= maxVol) return [0, maxVol];
      if (newMin < 0) { newMax -= newMin; newMin = 0; }
      if (newMax > maxVol) { newMin -= (newMax - maxVol); newMax = maxVol; }
      if (newMin < 0) newMin = 0;
      return [newMin, newMax];
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setLastPanPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !lastPanPos || !chartContainerRef.current) return;
    
    const dx = e.clientX - lastPanPos.x;
    const dy = e.clientY - lastPanPos.y;
    
    const { width, height } = chartContainerRef.current.getBoundingClientRect();
    
    setXDomain(prev => {
      const range = prev[1] - prev[0];
      const shiftX = (dx / width) * range;
      let newMin = prev[0] - shiftX;
      let newMax = prev[1] - shiftX;
      
      if (newMax - newMin >= 10000) return [0, 10000];
      if (newMin < 0) { newMax -= newMin; newMin = 0; }
      if (newMax > 10000) { newMin -= (newMax - 10000); newMax = 10000; }
      if (newMin < 0) newMin = 0;
      return [newMin, newMax];
    });
    
    setYDomain(prev => {
      const range = prev[1] - prev[0];
      const shiftY = (dy / height) * range;
      let newMin = prev[0] + shiftY;
      let newMax = prev[1] + shiftY;
      
      if (newMax - newMin >= maxVol) return [0, maxVol];
      if (newMin < 0) { newMax -= newMin; newMin = 0; }
      if (newMax > maxVol) { newMin -= (newMax - maxVol); newMax = maxVol; }
      if (newMin < 0) newMin = 0;
      return [newMin, newMax];
    });
    
    setLastPanPos({ x: e.clientX, y: e.clientY });
    setIsZoomed(true);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setLastPanPos(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="https://help4u.com.br/wp-content/uploads/2025/07/Help4u-v2-1-scaled.png" alt="Help4U" className="h-8 w-auto object-contain" />
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('vendas'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'vendas' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Vendas</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('indicadores'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'indicadores' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Indicadores</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('lucro_fluxo'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'lucro_fluxo' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Wallet className="w-5 h-5" />
            <span>Lucro e Fluxo</span>
          </button>

          <button
            onClick={() => { setActiveTab('dispersao_mercados'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'dispersao_mercados' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Dot className="w-5 h-5" />
            <span>Dispersão Mercados</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('dispersao_produtos'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'dispersao_produtos' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Dot className="w-5 h-5" />
            <span>Dispersão Produtos</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('desempenho_tipo'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'desempenho_tipo' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Activity className="w-5 h-5" />
            <span>Desempenho Tipo</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('desempenho_mensal'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'desempenho_mensal' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Desempenho Mensal</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('plano_acao'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'plano_acao' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Plano de Ação</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('gestao_validade'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'gestao_validade' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Calendar className="w-5 h-5" />
            <span>Gestão de Validade</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('pos_estocagem'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'pos_estocagem' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Package className="w-5 h-5" />
            <span>Pós-Estocagem</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('analise_cesta'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'analise_cesta' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Análise de Cesta</span>
          </button>

          <button
            onClick={() => { setActiveTab('mapa_calor'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'mapa_calor' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <MapIcon className="w-5 h-5" />
            <span>Mapa de Calor</span>
          </button>

          <button
            onClick={() => { setActiveTab('auditoria'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'auditoria' 
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <span>Auditoria VMPay</span>
          </button>

          <button
            onClick={() => { setActiveTab('repasse_sindicos'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'repasse_sindicos' 
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Building className="w-5 h-5 text-emerald-500" />
            <span>Repasse Síndicos</span>
          </button>

          <button
            onClick={() => { setActiveTab('validade_estoque'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'validade_estoque' 
                ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <AlertCircle className="w-5 h-5 text-purple-500" />
            <span>Validade Estoque</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={handleSyncVMPay}
            disabled={isSyncing}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            {isSyncing ? <Activity className="w-5 h-5 text-emerald-500 animate-spin" /> : <UploadCloud className="w-5 h-5 text-emerald-500" />}
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar DB'}</span>
          </button>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-orange-600" />}
            <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        
        {/* Sync Progress Bar */}
        {syncStatus?.isSyncing && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-900/50 p-4 transition-colors">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-emerald-500 animate-spin flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-400">
                    Sincronizando Base de Dados
                  </h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                    Processando dia {syncStatus.currentDay} de {syncStatus.totalDays} ({syncStatus.currentDate})
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-80 max-w-sm flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 mb-2 font-medium">
                    <span>Progresso</span>
                    <span>{Math.round((syncStatus.currentDay / Math.max(1, syncStatus.totalDays)) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                      style={{ width: `${Math.round((syncStatus.currentDay / Math.max(1, syncStatus.totalDays)) * 100)}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("Deseja realmente parar a sincronização?")) {
                      if (syncAbortControllerRef.current) {
                        syncAbortControllerRef.current.abort();
                      }
                      setIsSyncing(false); 
                      if (syncStatus) {
                        setSyncStatus({...syncStatus, isSyncing: false, status: 'stopped'});
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-200 flex-shrink-0 transition-colors"
                >
                  Parar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between md:hidden transition-colors duration-300">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 dark:text-slate-400 p-1">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
            <img src="https://help4u.com.br/wp-content/uploads/2025/07/Help4u-v2-1-scaled.png" alt="Help4U" className="h-6 w-auto object-contain" />
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1 text-slate-500 dark:text-slate-400"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-6xl mx-auto space-y-8">
            
            <header>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {activeTab === 'vendas' ? 'Dashboard de Vendas' : activeTab === 'lucro_fluxo' ? 'Lucro e Fluxo Diário' : activeTab === 'dispersao_mercados' ? 'Dispersão de Mercados' : activeTab === 'dispersao_produtos' ? 'Dispersão de Produtos' : activeTab === 'desempenho_tipo' ? 'Desempenho Tipo' : activeTab === 'desempenho_mensal' ? 'Desempenho Mensal' : activeTab === 'plano_acao' ? 'Plano de Ação' : activeTab === 'gestao_validade' ? 'Gestão de Validade' : activeTab === 'pos_estocagem' ? 'Pós-Estocagem' : activeTab === 'analise_cesta' ? 'Análise de Cesta' : activeTab === 'mapa_calor' ? 'Mapa de Calor' : activeTab === 'auditoria' ? 'Revisão e Auditoria API VMPay' : activeTab === 'repasse_sindicos' ? 'Relatório de Repasse para Síndicos' : activeTab === 'validade_estoque' ? 'Validade Estoque' : 'Indicadores de Risco'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {activeTab === 'vendas' 
                  ? 'Importe sua planilha de vendas para calcular a velocidade média e o tempo de venda por produto.'
                  : activeTab === 'lucro_fluxo' 
                  ? 'Cruze o volume físico de vendas com o funil financeiro (Faturamento > Margem Bruta > Margem Líquida).'
                  : activeTab === 'dispersao_mercados'
                  ? 'Analise a relação entre o share de volume e a margem líquida percentual de cada unidade.'
                  : activeTab === 'dispersao_produtos'
                  ? 'Visualize a alta performance vs. rentabilidade de cada produto considerando o ticket isolado por categoria.'
                  : activeTab === 'desempenho_tipo'
                  ? 'Acompanhe a linha do tempo e o desempenho de volume diário dos produtos selecionados.'
                  : activeTab === 'desempenho_mensal'
                  ? 'Acompanhe o desempenho de faturamento, volume e margem de cada mercado mês a mês durante um ano.'
                  : activeTab === 'gestao_validade'
                  ? 'Combine dados de estoque, giro e afinidade para prevenir perdas e sugerir cortes de preço ou ancoragens de produtos.'
                  : activeTab === 'pos_estocagem'
                  ? 'Cruze as planilhas de planogramas e vendas para encontrar os produtos faltantes e otimizar as prateleiras.'
                  : activeTab === 'plano_acao'
                  ? 'Classifique automaticamente e exporte tarefas operacionais utilizando matriz de dispersão de destino e densidade lucrocntrica.'
                  : activeTab === 'analise_cesta'
                  ? 'Analise o comportamento de compra conjunta (co-ocorrência) e o perfil da cesta de cada produto.'
                  : activeTab === 'mapa_calor'
                  ? 'Desenhe as prateleiras e visualize as zonas mais "quentes" através de um mapa de calor.'
                  : activeTab === 'auditoria'
                  ? 'Compare as transações registradas no Firestore com a API oficial do VMPay para identificar e corrigir lacunas de vendas em massa.'
                  : activeTab === 'repasse_sindicos'
                  ? 'Acompanhe mês a mês o faturamento, cálculo de repasse, energia e relatórios de perdas/furtos de cada condomínio.'
                  : activeTab === 'validade_estoque'
                  ? 'Gerencie e verifique as validades dos lotes de produtos no seu estoque central.'
                  : 'Veja alertas de risco para seus produtos.'}
              </p>
            </header>

            {/* Global Filters */}
            {rawData && activeTab !== 'auditoria' && activeTab !== 'repasse_sindicos' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input 
                    type="date" 
                    value={filterStartDate}
                    min={datasetMinDate}
                    max={filterEndDate || datasetMaxDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="text-sm border-none focus:ring-0 p-1 text-slate-700 dark:text-slate-300 bg-transparent outline-none max-w-[125px]" 
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input 
                    type="date" 
                    value={filterEndDate}
                    min={filterStartDate || datasetMinDate}
                    max={datasetMaxDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="text-sm border-none focus:ring-0 p-1 text-slate-700 dark:text-slate-300 bg-transparent outline-none max-w-[125px]" 
                  />
                </div>
                
                {availableUnits.length > 0 && (
                  <UnitDropdown 
                    availableUnits={availableUnits}
                    selectedUnits={selectedUnits}
                    onChange={setSelectedUnits}
                  />
                )}
              </div>
            )}

            {/* Results Area */}
            {stats.length > 0 && activeTab !== 'pos_estocagem' && activeTab !== 'analise_cesta' && activeTab !== 'mapa_calor' && activeTab !== 'auditoria' && activeTab !== 'repasse_sindicos' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Resultados da Análise</h2>
                      <p className="text-sm text-slate-500 line-clamp-1">{fileName} • {stats.length} produtos</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:w-64 shrink-0">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {activeTab === 'vendas' && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                       <h3 className="text-base font-semibold text-slate-800">Tabela de Vendas</h3>
                       <button onClick={exportToExcel} className="flex items-center space-x-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition">
                          <Download className="w-4 h-4" />
                          <span className="text-sm font-medium">Exportar XLSX</span>
                       </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                              Produto {getSortIcon('name')}
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('salesCount')}>
                              Qtd. Vendas {getSortIcon('salesCount')}
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('velocity')}>
                              Velocidade Média<br/><span className="text-[10px] font-medium normal-case text-slate-400">(vendas / dia)</span> {getSortIcon('velocity')}
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('grossVelocity')}>
                              Velocidade Bruta<br/><span className="text-[10px] font-medium normal-case text-slate-400">(vendas / dia)</span> {getSortIcon('grossVelocity')}
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('timeToSellOne')}>
                              Tempo para Vender 1 Unidade<br/><span className="text-[10px] font-medium normal-case text-slate-400">(dias)</span> {getSortIcon('timeToSellOne')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredStats.length > 0 ? (
                            applySort<any>(filteredStats).map((stat: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                  {stat.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-700 font-medium">
                                  {stat.salesCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                                  {stat.velocity !== null ? (
                                    <div className="flex flex-col items-end">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                                        {stat.velocity.toFixed(2)}
                                      </span>
                                      {stat.ruptureDays > 0 && (
                                        <span className="text-[10px] text-amber-600 mt-1" title={`${stat.ruptureDays.toFixed(1)} dias de ruptura ignorados`}>
                                          -{stat.ruptureDays.toFixed(1)}d ruptura
                                        </span>
                                      )}
                                      {stat.salesCount <= 5 && (
                                        <span className="text-[10px] text-slate-400 mt-1" title="Poucas vendas. Calculado com base em 30 dias.">
                                          Base 30 dias
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs" title="Dados insuficientes">N/A</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                                  {stat.grossVelocity !== null ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                      {stat.grossVelocity.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">N/A</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                                  {stat.timeToSellOne !== null ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                      {stat.timeToSellOne.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs" title="Dados insuficientes (apenas 1 venda ou vendas no mesmo dia)">N/A</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                                Nenhum produto encontrado com o termo "{searchTerm}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {activeTab === 'indicadores' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Matriz de Risco de Demanda e Estoque</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Use os botões <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">+</kbd> e <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">-</kbd> para dar zoom. Clique e arraste no gráfico para percorrer os dados. Bolhas maiores indicam maior margem. Bolhas <span className="text-amber-500 font-medium">laranjas</span> indicam alto índice de Venda Cega (PIX &gt; 40%).
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={handleZoomIn}
                          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                          title="Aproximar (Zoom In)"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={handleZoomOut}
                          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                          title="Afastar (Zoom Out)"
                        >
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        {isZoomed && (
                          <button 
                            onClick={() => { 
                              setXDomain([0, 10000]); 
                              setYDomain([0, maxVol]); 
                              setIsZoomed(false);
                            }}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                          >
                            Resetar Zoom
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div 
                      ref={chartContainerRef}
                      className={cn(
                        "w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-4 select-none",
                        isPanning ? "cursor-grabbing" : "cursor-grab"
                      )}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <ResponsiveContainer width="100%" height={500}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis 
                            type="number" 
                            dataKey="hhi" 
                            name="HHI" 
                            domain={xDomain}
                            allowDataOverflow
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="volume" 
                            name="Volume" 
                            domain={yDomain}
                            allowDataOverflow
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                          />
                          <ZAxis 
                            type="number" 
                            dataKey="margin" 
                            range={[50, 400]} 
                            domain={zDomain}
                            name="Margem" 
                            unit="%" 
                          />
                          <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                          <Scatter data={filteredStats} name="Produtos">
                            {filteredStats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.pixPercent > 40 ? '#f59e0b' : '#3b82f6'} 
                                fillOpacity={0.7}
                                stroke={entry.pixPercent > 40 ? '#d97706' : '#2563eb'}
                                strokeWidth={1}
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900">Itens em Alerta de Risco</h3>
                      <p className="text-sm text-slate-500 mt-1">Produtos com alto risco de encalhe (comprados por poucas pessoas).</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>Nome {getSortIcon('name')}</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('volume')}>Volume {getSortIcon('volume')}</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('hhi')}>HHI {getSortIcon('hhi')}</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('margin')}>Margem {getSortIcon('margin')}</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('pixPercent')}>Vendas PIX {getSortIcon('pixPercent')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {applySort<any>(filteredStats.filter(s => s.status === 'Alerta de Risco')).map((stat: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{stat.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">{stat.volume}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">{stat.hhi.toFixed(0)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">{stat.margin.toFixed(2)}%</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">{stat.pixPercent.toFixed(2)}%</td>
                            </tr>
                          ))}
                          {filteredStats.filter(s => s.status === 'Alerta de Risco').length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                                Nenhum item em alerta de risco encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}
                
                {activeTab === 'lucro_fluxo' && (
                  <div className="space-y-6">
                    {/* Sumário do Período */}
                    {financialStats.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[
                          { title: 'Faturamento Total', value: financialStats.reduce((acc, curr) => acc + curr.faturamento, 0), type: 'currency', color: 'text-orange-400 dark:text-orange-300' },
                          { title: 'Margem Bruta Total', value: financialStats.reduce((acc, curr) => acc + curr.margemBruta, 0), type: 'currency', color: 'text-orange-500 dark:text-orange-400' },
                          { title: 'Margem Líquida Total', value: financialStats.reduce((acc, curr) => acc + curr.margemLiquida, 0), type: 'currency', color: 'text-orange-800 dark:text-orange-500' },
                          { title: 'Volume Total', value: financialStats.reduce((acc, curr) => acc + curr.volume, 0), type: 'number', color: 'text-orange-500 dark:text-orange-400' },
                          { title: 'Ticket Médio', value: financialStats.reduce((acc, curr) => acc + curr.transactions, 0) > 0 ? financialStats.reduce((acc, curr) => acc + curr.faturamento, 0) / financialStats.reduce((acc, curr) => acc + curr.transactions, 0) : 0, type: 'currency', color: 'text-purple-600 dark:text-purple-400' }
                        ].map((item, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 transition-colors">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{item.title}</p>
                            <p className={cn("text-2xl font-bold", item.color)}>
                              {item.type === 'currency' 
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
                                : item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 transition-colors">
                      {financialStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height={500}>
                          <ComposedChart
                            data={financialStats}
                            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                            <XAxis 
                              dataKey="dateStr" 
                              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                              axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="left" 
                              tickFormatter={(value) => `R$ ${value}`}
                              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              yAxisId="right" 
                              orientation="right" 
                              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip content={<CustomFinancialTooltip />} cursor={{ fill: isDarkMode ? '#1e293b' : '#f1f5f9' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            
                            <Bar yAxisId="left" dataKey="faturamento" name="Faturamento" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar yAxisId="left" dataKey="margemBruta" name="Margem Bruta" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar yAxisId="left" dataKey="margemLiquida" name="Margem Líquida" fill="#1e40af" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            
                            <Line 
                              yAxisId="right" 
                              type="monotone" 
                              dataKey="volume" 
                              name="Volume de Vendas" 
                              stroke="#f97316" 
                              strokeWidth={3} 
                              dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }} 
                              activeDot={{ r: 6 }} 
                            />

                            {/* Linhas de Média */}
                            <ReferenceLine yAxisId="left" y={financialStats.reduce((sum, item) => sum + item.faturamento, 0) / financialStats.length} stroke="#93c5fd" strokeDasharray="5 5" opacity={0.6} />
                            <ReferenceLine yAxisId="left" y={financialStats.reduce((sum, item) => sum + item.margemBruta, 0) / financialStats.length} stroke="#3b82f6" strokeDasharray="5 5" opacity={0.6} />
                            <ReferenceLine yAxisId="left" y={financialStats.reduce((sum, item) => sum + item.margemLiquida, 0) / financialStats.length} stroke="#1e40af" strokeDasharray="5 5" opacity={0.6} />
                            <ReferenceLine yAxisId="right" y={financialStats.reduce((sum, item) => sum + item.volume, 0) / financialStats.length} stroke="#f97316" strokeDasharray="5 5" opacity={0.6} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <AlertCircle className="w-10 h-10 text-slate-400 mb-4" />
                          <p className="text-slate-500 font-medium text-center">
                            Nenhum dado financeiro diário encontrado.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'dispersao_mercados' && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6">
                    {marketScatterStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={500}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis 
                            type="number" 
                            dataKey="volumePercent" 
                            name="Volume (%)" 
                            tickFormatter={(val) => typeof val === 'number' ? `${val.toFixed(1)}%` : ''}
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="marginPercent" 
                            name="Margem Líquida (%)" 
                            tickFormatter={(val) => typeof val === 'number' ? `${val.toFixed(1)}%` : ''}
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                            tickLine={false}
                          />
                          <ZAxis type="number" dataKey="volume" range={[100, 800]} />
                          <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomMarketScatterTooltip />} />
                          <Scatter name="Mercados" data={marketScatterStats}>
                            {marketScatterStats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill="#8b5cf6" 
                                fillOpacity={0.7} 
                                stroke="#7c3aed" 
                                strokeWidth={2} 
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="w-10 h-10 text-slate-400 mb-4" />
                        <p className="text-slate-500 font-medium text-center">
                          Nenhum dado de mercado encontrado para criar o gráfico.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'dispersao_produtos' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 transition-colors">
                      <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Análise de Margem vs Volume</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
                          Neste gráfico, cada ponto representa um produto distinto. <br/>
                          <strong>Entendendo o tamanho da bolinha:</strong> O tamanho (diâmetro) do ponto é diretamente proporcional ao <strong>Volume Absoluto de Vendas</strong>. 
                          Uma bolinha maior significa que o produto teve muitas unidades vendidas no período. Bolinhas menores representam produtos que saíram pouco. 
                          Isso ajuda a identificar rapidamente os "campeões de venda" (bolas grandes) e analisar se a margem deles está saudável (posição no eixo vertical).
                        </p>
                        
                        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl text-sm text-orange-800 dark:text-orange-300">
                          <h4 className="font-bold flex items-center mb-2">
                            <Activity className="w-4 h-4 mr-2" />
                            Matemática das Faixas de Margem (Curvas de Nível)
                          </h4>
                          <p className="mb-2">
                            No gráfico abaixo, adicionamos curvas tracejadas que representam as <strong>Zonas de Margem Líquida Total (R$)</strong>.
                            Dois produtos podem gerar os mesmos R$ 50 de lucro de formas diferentes: um com muito volume e margem unitária pequena, outro com pouco volume e margem unitária grande.
                          </p>
                          <div className="bg-white dark:bg-slate-950 p-3 rounded shadow-sm inline-block font-mono text-xs text-slate-700 dark:text-slate-300 mt-2 mb-2 w-full md:w-auto overflow-x-auto">
                            Equação da Margem Unitária:<br/>
                            <span className="font-bold">M_unit = Preço_Venda × (1 - Repasse) - Custo</span><br/><br/>
                            Fórmula das Curvas de Nível (Onde E = Espaçamento, ex: 50, 100, 150):<br/>
                            <span className="font-bold">Margem Unitária (Y) = E / Volume Absolute (X)</span>
                          </div>
                          <p>
                            Isso cria o padrão de "escorregador" (uma hipérbole). Quanto mais para a direita (Alto Volume), menor a Margem Unitária necessária para encostar na linha de R$ 100, por exemplo.
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="category-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Filtrar por Categoria</label>
                        <select
                          id="category-filter"
                          value={scatterCategoryFilter}
                          onChange={(e) => setScatterCategoryFilter(e.target.value)}
                          className="border border-slate-200 dark:border-slate-800 rounded-lg text-sm px-3 py-2 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-w-[200px]"
                        >
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {filteredProductScatterStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={700}>
                        <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                          <XAxis 
                            type="number" 
                            dataKey="volumePercent" 
                            name="Volume (vs 2x Mediana)" 
                            domain={[0, 'auto']}
                            tickFormatter={(val) => typeof val === 'number' ? `${val.toFixed(0)}%` : ''}
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="margemUnitaria" 
                            name="Margem Unitária (R$)" 
                            tickFormatter={(val) => typeof val === 'number' ? `R$ ${val.toFixed(2)}` : ''}
                            tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                            tickLine={false}
                          />
                          <ZAxis type="number" dataKey="volume" range={[40, 400]} />
                          <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomProductScatterTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          
                          {/* Curvas de Nível (Iso-Margem Líquida Total) */}
                          {[50, 100, 150, 200, 300, 500].map(E => (
                            <Line
                              key={`faixa_${E}`}
                              data={levelCurvesData}
                              type="monotone"
                              dataKey={`faixa_${E}`}
                              name={`Zona R$ ${E}`}
                              stroke="#94a3b8"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                              activeDot={false}
                              isAnimationActive={false}
                            />
                          ))}

                          {Array.from(new Set(filteredProductScatterStats.map(p => p.category))).sort().map((cat, idx) => {
                            const categoryName = cat as string;
                            const data = filteredProductScatterStats.filter(p => p.category === categoryName);
                            const color = CATEGORY_COLORS[availableCategories.indexOf(categoryName) % CATEGORY_COLORS.length];
                            return (
                              <Scatter key={categoryName} name={categoryName} data={data} fill={color}>
                                {data.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={color} 
                                    fillOpacity={0.7} 
                                    stroke={color} 
                                    strokeWidth={1} 
                                  />
                                ))}
                              </Scatter>
                            )
                          })}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="w-10 h-10 text-slate-400 mb-4" />
                        <p className="text-slate-500 font-medium text-center">
                          Nenhum dado de produto encontrado para criar o gráfico.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-red-50/30 dark:bg-red-900/10">
                      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        Itens com Preço de Custo Zerado
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Abaixo estão os produtos cujo custo total é R$ 0,00 (seja por não ter sido cadastrado na planilha ou ajustado automaticamente após o sistema identificar que a margem líquida seria negativa em uma venda).
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-950">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>Produto / Categoria {getSortIcon('name')}</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('volume')}>Volume de Vendas {getSortIcon('volume')}</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('faturamento')}>Faturamento Total {getSortIcon('faturamento')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredProductScatterStats.filter(p => p.totalCost === 0).length > 0 ? (
                            applySort<any>(filteredProductScatterStats.filter(p => p.totalCost === 0), (a: any,b: any) => b.volume - a.volume)
                              .map((p: any) => (
                              <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {p.name}
                                  <span className="block text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">{p.category}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400">{p.volume} und.</td>
                                <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.faturamento)}
                                </td>
                              </tr>
                            ))
                          ) : (
                              <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                  Nenhum item com preço de custo igual a zero.
                                </td>
                              </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}
                
                {activeTab === 'desempenho_tipo' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Análise de Volume por Produto</h3>
                        <div className="flex items-center space-x-3">
                          <ProductDropdown 
                            availableProducts={stats.map(s => s.name).sort()}
                            selectedProducts={desempenhoSelectedProducts} 
                            onChange={setDesempenhoSelectedProducts}
                          />
                        </div>
                      </div>
                      
                      {dailyProductPerformances.length > 0 ? (
                        <div className="flex flex-col xl:flex-row gap-6">
                          <div className="flex-1 h-[800px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dailyProductPerformances.map(day => {
                                let totalSelected = 0;
                                desempenhoSelectedProducts.forEach(p => { totalSelected += (day[p] as number) || 0; });
                                return { ...day, TotalSelected: totalSelected };
                              })} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                                <XAxis dataKey="dateStr" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }} tickMargin={10} />
                                <YAxis tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip 
                                  content={({ active, payload, label }: any) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl text-sm min-w-[200px]">
                                          <p className="font-bold text-slate-800 dark:text-slate-200 mb-2 border-b dark:border-slate-800 pb-2">{label}</p>
                                          <div className="space-y-1 text-slate-600 dark:text-slate-400">
                                            {payload.map((entry: any, index: number) => (
                                              <p key={index} className="flex justify-between items-center whitespace-nowrap gap-4">
                                                <span className="flex items-center">
                                                  <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }}></span>
                                                  {entry.name}:
                                                </span>
                                                <span className="font-semibold dark:text-slate-200">{entry.value}</span>
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                {desempenhoSelectedProducts.map((prod, idx) => (
                                  <Line 
                                    key={prod} 
                                    type="monotone" 
                                    dataKey={prod} 
                                    name={prod}
                                    stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} 
                                    strokeWidth={2} 
                                    dot={{ r: 3, fill: CATEGORY_COLORS[idx % CATEGORY_COLORS.length], strokeWidth: 2 }}
                                    activeDot={{ r: 5 }} 
                                  />
                                ))}
                                {desempenhoSelectedProducts.length > 0 && (
                                  <>
                                    <Line 
                                      type="monotone" 
                                      dataKey="TotalSelected" 
                                      name="Somatório (Selecionados)"
                                      stroke={isDarkMode ? '#ffffff' : '#000000'} 
                                      strokeWidth={3} 
                                      dot={false}
                                      activeDot={{ r: 5 }}
                                    />
                                    <ReferenceLine 
                                      y={(() => {
                                        const data = dailyProductPerformances.map(day => {
                                          let totalSelected = 0;
                                          desempenhoSelectedProducts.forEach(p => { totalSelected += (day[p] as number) || 0; });
                                          return totalSelected;
                                        });
                                        if (data.length === 0) return 0;
                                        return data.reduce((a, b) => a + b, 0) / data.length;
                                      })()} 
                                      stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                                      strokeDasharray="3 3"
                                      label={{ position: 'top', value: 'Média do Somatório', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}
                                    />
                                  </>
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="w-full xl:w-80 flex flex-col bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl transition-colors">
                              <h4 className="font-bold text-slate-800 dark:text-slate-200">Total do Período</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Soma das vendas nos dias filtrados</p>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto max-h-[720px] space-y-3 custom-scrollbar">
                              {desempenhoSelectedProducts.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Nenhum produto selecionado.</p>
                              ) : (
                                <>
                                  <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                                    <span className="font-bold text-slate-900 dark:text-white">SOMATÓRIO GERAL</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {desempenhoSelectedProducts.reduce((acc, prod) => {
                                        return acc + dailyProductPerformances.reduce((dayAcc, day) => dayAcc + (day[prod] || 0), 0);
                                      }, 0)} unid.
                                    </span>
                                  </div>
                                  {desempenhoSelectedProducts.map((prod, idx) => {
                                    const total = dailyProductPerformances.reduce((acc, day) => acc + (day[prod] || 0), 0);
                                    const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                                    return (
                                      <div key={prod} className="flex justify-between items-center">
                                        <div className="flex items-center flex-1 min-w-0 mr-3">
                                          <div className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: color }}></div>
                                          <span className="text-sm font-semibold truncate" style={{ color }} title={prod}>{prod}</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 shrink-0">{total} und.</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Activity className="w-10 h-10 text-slate-400 mb-4" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium text-center">
                            Selecione data e importe a planilha para ver a análise de volume.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'desempenho_mensal' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">
                      <div className="flex flex-col md:flex-row gap-4 mb-6 relative z-10">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ano</label>
                          <select 
                            value={mensalSelectedYear} 
                            onChange={(e) => setMensalSelectedYear(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                          >
                            {mensalAvailableYears.length === 0 && <option value={mensalSelectedYear}>{mensalSelectedYear}</option>}
                            {mensalAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Métrica</label>
                          <select 
                            value={mensalMetric} 
                            onChange={(e) => setMensalMetric(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                          >
                            <option value="faturamento">Faturamento Total</option>
                            <option value="margem_bruta">Margem Bruta</option>
                            <option value="margem_liquida">Margem Líquida</option>
                            <option value="volume">Volume de Vendas</option>
                          </select>
                        </div>

                        <div className="flex-[2]">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mercados</label>
                          <UnitDropdown 
                             availableUnits={availableUnits}
                             selectedUnits={mensalSelectedMarkets.length > 0 ? mensalSelectedMarkets : availableUnits}
                             onChange={setMensalSelectedMarkets}
                          />
                        </div>
                      </div>

                      {monthlyPerformanceData.length > 0 ? (
                        <div className="mt-8">
                          <ResponsiveContainer width="100%" height={450}>
                            <LineChart data={monthlyPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                              <XAxis dataKey="name" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }} />
                              <YAxis 
                                tickFormatter={(val) => mensalMetric === 'volume' ? `${val}` : `R$ ${val.toLocaleString('pt-BR')}`}
                                tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} 
                                axisLine={{ stroke: isDarkMode ? '#334155' : '#cbd5e1' }}
                                tickLine={false}
                                width={80}
                              />
                              <RechartsTooltip 
                                formatter={(value: any, name: string) => [
                                  mensalMetric === 'volume' 
                                    ? value 
                                    : `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
                                  name
                                ]}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: isDarkMode ? '#f8fafc' : '#0f172a' }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              
                              {(mensalSelectedMarkets.length > 0 ? mensalSelectedMarkets : availableUnits).map((market, idx) => {
                                 const hue = (idx * 137.5) % 360;
                                 return (
                                   <Line 
                                     key={market}
                                     type="monotone"
                                     dataKey={market}
                                     name={market}
                                     stroke={`hsl(${hue}, 70%, 50%)`}
                                     strokeWidth={2}
                                     dot={{ r: 3, fill: `hsl(${hue}, 70%, 50%)` }}
                                     activeDot={{ r: 6 }}
                                   />
                                 );
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <TrendingUp className="w-10 h-10 text-slate-400 mb-4" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium text-center">
                            Nenhum dado encontrado para os filtros selecionados.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'plano_acao' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                        <div>
                           <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Motor de Clusterização de Sortimento</h3>
                           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure o espaço da gôndola e o algoritmo de clusterização classificará os produtos em ações estratégicas.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                             Medianas (Auto): Volume = <strong>{internalThresholds.giro} unid.</strong> | Densidade = <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(internalThresholds.densidade)}</strong>
                           </p>
                        </div>
                        <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Corte Intenção (Destino):</label>
                          <input 
                            type="number" 
                            step="0.05"
                            min="0"
                            max="1"
                            value={thresholdDestino}
                            onChange={(e) => setThresholdDestino(Number(e.target.value))}
                            className="w-20 text-sm border border-slate-300 dark:border-slate-700 rounded-lg p-1 text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                          <thead className="bg-slate-50 dark:bg-slate-950">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('produto')}>Produto {getSortIcon('produto')}</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider bg-orange-50/50 dark:bg-orange-900/10 cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => handleSort('frentes')}>Frentes Ocupadas {getSortIcon('frentes')}</th>
                              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('volumeTotal')}>Volume Total {getSortIcon('volumeTotal')}</th>
                              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('densidadeLucro')}>Densidade (R$) {getSortIcon('densidadeLucro')}</th>
                              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('taxaDestino')}>Tx. Destino {getSortIcon('taxaDestino')}</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('cluster')}>Cluster Atribuído {getSortIcon('cluster')}</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('acao')}>Ação Recomendada {getSortIcon('acao')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                            {applySort<any>(actionPlanData, (a: any,b: any) => b.volumeTotal - a.volumeTotal).map((row: any, idx: number) => {
                              return (
                                <tr key={row.produto} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">{row.produto}</td>
                                  <td className="px-6 py-4 text-center bg-orange-50/20 dark:bg-orange-900/5">
                                    <input 
                                      type="number"
                                      min="1"
                                      value={row.frentes}
                                      onChange={(e) => {
                                        setFrentesParam(prev => ({
                                          ...prev,
                                          [row.produto]: Math.max(1, Number(e.target.value))
                                        }));
                                      }}
                                      className="w-16 text-center text-sm border border-slate-300 dark:border-slate-700 rounded-md p-1 font-semibold text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                  </td>
                                  <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400 font-medium">{row.volumeTotal}</td>
                                  <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.densidadeLucro)}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400">
                                    {(row.taxaDestino * 100).toFixed(1)}%
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                                      row.cluster.includes('Tratores') && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
                                      row.cluster.includes('Impulso') && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                                      row.cluster.includes('Urgência') && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                                      row.cluster.includes('Inadimplentes') && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                                      row.cluster.includes('Análise Manual') && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
                                    )}>
                                      {row.cluster}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.acaoRecomendada}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {actionPlanData.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12">
                            <Activity className="w-10 h-10 text-slate-400 mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-center">
                              Importe os dados para gerar o plano de ação.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
              </div>
            )}

            {activeTab === 'pos_estocagem' && <PosEstocagem />}
            {activeTab === 'analise_cesta' && rawData && <AnaliseCesta rawData={rawData} />}
            {activeTab === 'mapa_calor' && rawData && <MapaCalor rawData={rawData} availableUnits={availableUnits} />}
            {activeTab === 'gestao_validade' && rawData && <GestaoValidade rawData={rawData} availableUnits={availableUnits} />}
            {activeTab === 'auditoria' && (
              <AuditoriaVMPay 
                rawData={rawData} 
                onRefreshData={() => {
                  window.location.reload();
                }} 
              />
            )}
            {activeTab === 'repasse_sindicos' && rawData && (
              <RepasseSindicos rawData={rawData} availableUnits={availableUnits} />
            )}
            {activeTab === 'validade_estoque' && rawData && (
              <ValidadeEstoque rawData={rawData} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
