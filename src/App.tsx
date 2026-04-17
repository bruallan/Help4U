import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Search, FileSpreadsheet, AlertCircle, Loader2, LayoutDashboard, ShoppingCart, TrendingUp, Menu, X, ZoomIn, ZoomOut, Download, Wallet, Calendar, ChevronDown, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ComposedChart, Bar, Line, Legend } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProductStats {
  name: string;
  salesCount: number;
  minDate: Date;
  maxDate: Date;
  velocity: number | null; // vendas por dia
  timeToSellOne: number | null; // dias
  ruptureDays: number;
  uniqueSalesCount: number;
  // Novas métricas
  grossVelocity: number | null;
  pixPercent: number;
  hhi: number;
  margin: number;
  status: string;
  volume: number;
}

interface DailyFinancialStats {
  date: Date;
  dateStr: string;
  volume: number;
  faturamento: number;
  margemBruta: number;
  margemLiquida: number;
  deduction: number;
}

interface MappedRow {
  date: Date;
  dayDate: Date;
  productName: string;
  buyerId: string;
  salePrice: number;
  costPrice: number;
  client: string;
}

function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  
  if (typeof val === 'string') {
    const parts = val.trim().split(' ');
    const datePart = parts[0];
    const timePart = parts[1];
    
    if (!datePart) return null;
    
    const dateParts = datePart.includes('/') ? datePart.split('/') : datePart.split('-');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    let year = parseInt(dateParts[2], 10);
    
    if (year < 100) {
      year += 2000;
    }
    
    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
      const timeParts = timePart.split(':');
      hours = parseInt(timeParts[0] || '0', 10);
      minutes = parseInt(timeParts[1] || '0', 10);
      seconds = parseInt(timeParts[2] || '0', 10);
    }
    
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  return null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductStats;
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl text-sm min-w-[200px]">
        <p className="font-bold text-slate-800 mb-2 border-b pb-2">{data.name}</p>
        <div className="space-y-1 text-slate-600">
          <p><span className="font-medium text-slate-700">Volume:</span> {data.volume} unid.</p>
          <p><span className="font-medium text-slate-700">HHI (Concentração):</span> {data.hhi.toFixed(0)}</p>
          <p><span className="font-medium text-slate-700">Margem:</span> {data.margin.toFixed(2)}%</p>
          <p><span className="font-medium text-slate-700">Vendas PIX:</span> {data.pixPercent.toFixed(2)}%</p>
        </div>
        <div className="mt-3 pt-2 border-t">
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            data.status === 'Alerta de Risco' && "bg-red-100 text-red-800",
            data.status === 'Motor da Loja' && "bg-emerald-100 text-emerald-800",
            data.status === 'Cauda Longa' && "bg-slate-100 text-slate-800",
            data.status === 'Venda Monopolizada Menor' && "bg-amber-100 text-amber-800"
          )}>
            {data.status}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomFinancialTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailyFinancialStats;
    
    const formatCurrency = (val: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl text-sm min-w-[220px]">
        <p className="font-bold text-slate-800 mb-2 border-b pb-2">{data.dateStr}</p>
        <div className="space-y-2 text-slate-600">
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 flex items-center"><span className="w-3 h-3 rounded-full bg-blue-300 mr-2"></span>Faturamento:</span>
            <span>{formatCurrency(data.faturamento)}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>Margem Bruta:</span>
            <span>{formatCurrency(data.margemBruta)}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 flex items-center"><span className="w-3 h-3 rounded-full bg-blue-800 mr-2"></span>Margem Líquida:</span>
            <span className={cn(data.margemLiquida < 0 ? "text-red-600 font-semibold" : "")}>
              {formatCurrency(data.margemLiquida)}
            </span>
          </p>
          <div className="border-t my-1"></div>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Volume Vendas:</span>
            <span>{data.volume} unid.</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const UnitDropdown = ({ availableUnits, selectedUnits, onChange }: { availableUnits: string[], selectedUnits: string[], onChange: (s: string[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUnit = (u: string) => {
    if (selectedUnits.includes(u)) onChange(selectedUnits.filter(x => x !== u));
    else onChange([...selectedUnits, u]);
  };

  const toggleAll = () => {
    if (selectedUnits.length === availableUnits.length) onChange([]);
    else onChange([...availableUnits]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-50 transition"
      >
        <span className="text-sm font-medium text-slate-700">
          Unidades ({selectedUnits.length})
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-50 p-2 max-h-64 overflow-y-auto">
          <div 
            className="flex items-center p-2 hover:bg-slate-50 rounded-lg cursor-pointer border-b border-slate-100 mb-1"
            onClick={toggleAll}
          >
            <div className={cn("w-4 h-4 rounded flex items-center justify-center mr-3 border", 
              selectedUnits.length === availableUnits.length ? "bg-blue-600 border-blue-600" : "border-slate-300"
            )}>
              {selectedUnits.length === availableUnits.length && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-semibold text-slate-800">Selecionar Todas</span>
          </div>
          
          {availableUnits.map(unit => {
            const isSelected = selectedUnits.includes(unit);
            return (
              <div 
                key={unit} 
                className="flex items-center p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                onClick={() => toggleUnit(unit)}
              >
                <div className={cn("w-4 h-4 rounded flex items-center justify-center mr-3 border", 
                  isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-slate-700 truncate">{unit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [stats, setStats] = useState<ProductStats[]>([]);
  const [financialStats, setFinancialStats] = useState<DailyFinancialStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'vendas' | 'indicadores' | 'lucro_fluxo'>('vendas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [rawData, setRawData] = useState<MappedRow[] | null>(null);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [datasetMinDate, setDatasetMinDate] = useState<string>('');
  const [datasetMaxDate, setDatasetMaxDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const [xDomain, setXDomain] = useState<[number, number]>([0, 10000]);
  const [yDomain, setYDomain] = useState<[number, number]>([0, 100]);
  const [isZoomed, setIsZoomed] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [maxVol, setMaxVol] = useState(100);
  
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

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      if (!workbook.SheetNames.length) {
        throw new Error('A planilha está vazia.');
      }
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      
      if (rows.length < 2) {
        throw new Error('A planilha não contém dados suficientes.');
      }
      
      let headerRowIndex = -1;
      let colMap = { date: -1, product: -1, buyer: -1, sale: -1, cost: -1, client: -1 };

      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        const colIndex = row.findIndex(c => String(c).trim() === "Data/hora");
        if (colIndex !== -1) {
          headerRowIndex = i;
          row.forEach((cell, idx) => {
            const val = String(cell).trim();
            if (val === "Data/hora") colMap.date = idx;
            else if (val === "Produto") colMap.product = idx;
            else if (val === "Número do cartão") colMap.buyer = idx;
            else if (val === "Valor (R$)") colMap.sale = idx;
            else if (val === "Preço de Custo (R$)") colMap.cost = idx;
            else if (val === "Cliente") colMap.client = idx;
          });
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Cabeçalho 'Data/hora' não encontrado nas primeiras 50 linhas.");
      }
      if (colMap.date === -1 || colMap.product === -1) {
        throw new Error("As colunas 'Data/hora' e 'Produto' são obrigatórias.");
      }
      
      let minD: Date | null = null;
      let maxD: Date | null = null;
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      const mappedRows: MappedRow[] = [];
      const uniqueClients = new Set<string>();

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const dateVal = row[colMap.date];
        if (!dateVal) continue;
        const date = parseExcelDate(dateVal);
        if (!date) continue;
        const dayDate = startOfDay(date);
        
        if (!minD || dayDate.getTime() < minD.getTime()) minD = dayDate;
        if (!maxD || dayDate.getTime() > maxD.getTime()) maxD = dayDate;

        const productName = row[colMap.product];
        if (productName == null || !String(productName).trim()) continue;

        const buyerId = colMap.buyer !== -1 && row[colMap.buyer] != null ? String(row[colMap.buyer]).trim() : '';
        const salePrice = colMap.sale !== -1 ? (parseFloat(row[colMap.sale]) || 0) : 0;
        const costPrice = colMap.cost !== -1 ? (parseFloat(row[colMap.cost]) || 0) : 0;
        const client = colMap.client !== -1 && row[colMap.client] != null ? String(row[colMap.client]).trim() : '';

        if (client) uniqueClients.add(client);

        mappedRows.push({
            date,
            dayDate,
            productName: String(productName).trim(),
            buyerId,
            salePrice,
            costPrice,
            client
        });
      }
      
      if (minD && maxD) {
        const minStr = minD.toISOString().split('T')[0];
        const maxStr = maxD.toISOString().split('T')[0];
        setDatasetMinDate(minStr);
        setDatasetMaxDate(maxStr);
        setFilterStartDate(minStr);
        setFilterEndDate(maxStr);
      }

      const available = Array.from(uniqueClients).sort();
      setAvailableUnits(available);
      setSelectedUnits(available);
      setRawData(mappedRows);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar o arquivo.');
    } finally {
      setIsLoading(false);
    }
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
          totalCost: number 
        }>();
        
        let processedCount = 0;
        let globalMinDay: Date | null = null;
        let globalMaxDay: Date | null = null;
        const globalBuyers = new Set<string>();
        const dailyFinances = new Map<string, DailyFinancialStats>();
        
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        const defaultTaxRate = 0.20; // Default 20%
        const alamedaTaxRate = 0.27; // 27% para Alameda
        
        const filterStartMs = filterStartDate ? new Date(filterStartDate + 'T00:00:00').getTime() : null;
        const filterEndMs = filterEndDate ? new Date(filterEndDate + 'T23:59:59').getTime() : null;

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          
          if (filterStartMs && row.dayDate.getTime() < filterStartMs) continue;
          if (filterEndMs && row.dayDate.getTime() > filterEndMs) continue;
          if (selectedUnits.length > 0 && row.client && !selectedUnits.includes(row.client)) continue;
          
          if (!globalMinDay || row.dayDate.getTime() < globalMinDay.getTime()) globalMinDay = row.dayDate;
          if (!globalMaxDay || row.dayDate.getTime() > globalMaxDay.getTime()) globalMaxDay = row.dayDate;
          
          const nameStr = row.productName;
          
          if (row.buyerId) {
            globalBuyers.add(row.buyerId);
          }
        
        if (!productMap.has(nameStr)) {
          productMap.set(nameStr, { dates: [], buyers: new Map(), pixCount: 0, totalSale: 0, totalCost: 0 });
        }
        
        const pData = productMap.get(nameStr)!;
        pData.dates.push(row.date);
        if (row.buyerId) {
          pData.buyers.set(row.buyerId, (pData.buyers.get(row.buyerId) || 0) + 1);
        } else {
          pData.pixCount++;
        }
        pData.totalSale += row.salePrice;
        pData.totalCost += row.costPrice;
        
        // --- Daily financial calc ---
        const dateStr = row.dayDate.toISOString().split('T')[0];
        if (!dailyFinances.has(dateStr)) {
          dailyFinances.set(dateStr, {
            date: row.dayDate,
            dateStr: row.dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            volume: 0,
            faturamento: 0,
            margemBruta: 0,
            margemLiquida: 0,
            deduction: 0
          });
        }
        const dayStats = dailyFinances.get(dateStr)!;
        
        const isAlameda = row.client === "Condomínio Alameda das Águas";
        const currentTaxRate = isAlameda ? alamedaTaxRate : defaultTaxRate;
        
        dayStats.volume += 1;
        dayStats.faturamento += row.salePrice;
        
        const itemMargemBruta = row.salePrice - row.costPrice;
        dayStats.margemBruta += itemMargemBruta;
        dayStats.deduction += (row.salePrice * currentTaxRate);
        
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
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-600">
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Help4U</span>
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => { setActiveTab('vendas'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === 'vendas' 
                ? "bg-blue-50 text-blue-700" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                ? "bg-blue-50 text-blue-700" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                ? "bg-blue-50 text-blue-700" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Wallet className="w-5 h-5" />
            <span>Lucro e Fluxo</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 p-1">
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 text-lg font-semibold text-slate-900">Help4U</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto space-y-8">
            
            <header>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {activeTab === 'vendas' ? 'Dashboard de Vendas' : activeTab === 'lucro_fluxo' ? 'Lucro e Fluxo Diário' : 'Indicadores de Risco'}
              </h1>
              <p className="text-slate-500 mt-2">
                {activeTab === 'vendas' 
                  ? 'Importe sua planilha de vendas para calcular a velocidade média e o tempo de venda por produto.'
                  : activeTab === 'lucro_fluxo' 
                  ? 'Cruze o volume físico de vendas com o funil financeiro (Faturamento > Margem Bruta > Margem Líquida).'
                  : 'Matriz de Risco de Demanda e Estoque baseada em Volume, Penetração e Venda Cega.'}
              </p>
            </header>

            {/* Upload Area (Only show if no stats) */}
            {stats.length === 0 && !rawData && (
              <div className="space-y-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden",
                    isDragging 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400",
                    isLoading && "pointer-events-none opacity-70"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileInput} 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                  />
                  
                  {isLoading ? (
                    <div className="flex flex-col items-center space-y-4">
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                      <p className="text-sm font-medium text-slate-600">Processando planilha...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-4 text-center p-6">
                      <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-700">
                          Clique para enviar ou arraste sua planilha aqui
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Suporta arquivos .xlsx, .xls e .csv
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center space-x-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Global Filters */}
            {rawData && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input 
                    type="date" 
                    value={filterStartDate}
                    min={datasetMinDate}
                    max={filterEndDate || datasetMaxDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="text-sm border-none focus:ring-0 p-1 text-slate-700 bg-transparent outline-none max-w-[125px]" 
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input 
                    type="date" 
                    value={filterEndDate}
                    min={filterStartDate || datasetMinDate}
                    max={datasetMaxDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="text-sm border-none focus:ring-0 p-1 text-slate-700 bg-transparent outline-none max-w-[125px]" 
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
            {stats.length > 0 && (
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
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {activeTab === 'vendas' && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                       <h3 className="text-base font-semibold text-slate-800">Tabela de Vendas</h3>
                       <button onClick={exportToExcel} className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                          <Download className="w-4 h-4" />
                          <span className="text-sm font-medium">Exportar XLSX</span>
                       </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Produto
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Qtd. Vendas
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Velocidade Média<br/><span className="text-[10px] font-medium normal-case text-slate-400">(vendas / dia)</span>
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Velocidade Bruta<br/><span className="text-[10px] font-medium normal-case text-slate-400">(vendas / dia)</span>
                            </th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Tempo para Vender 1 Unidade<br/><span className="text-[10px] font-medium normal-case text-slate-400">(dias)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredStats.length > 0 ? (
                            filteredStats.map((stat, idx) => (
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
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
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
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Matriz de Risco de Demanda e Estoque</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Use os botões <kbd className="px-1.5 py-0.5 bg-slate-200 rounded-md text-xs font-mono font-semibold text-slate-700">+</kbd> e <kbd className="px-1.5 py-0.5 bg-slate-200 rounded-md text-xs font-mono font-semibold text-slate-700">-</kbd> para dar zoom. Clique e arraste no gráfico para percorrer os dados. Bolhas maiores indicam maior margem. Bolhas <span className="text-amber-500 font-medium">laranjas</span> indicam alto índice de Venda Cega (PIX &gt; 40%).
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={handleZoomIn}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="Aproximar (Zoom In)"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={handleZoomOut}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
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
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                          >
                            Resetar Zoom
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div 
                      ref={chartContainerRef}
                      className={cn(
                        "w-full bg-slate-50 rounded-xl border border-slate-100 p-4 select-none",
                        isPanning ? "cursor-grabbing" : "cursor-grab"
                      )}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <ResponsiveContainer width="100%" height={500}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis 
                            type="number" 
                            dataKey="hhi" 
                            name="HHI" 
                            domain={xDomain}
                            allowDataOverflow
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="volume" 
                            name="Volume" 
                            domain={yDomain}
                            allowDataOverflow
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
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
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">HHI</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Margem</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendas PIX</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredStats.filter(s => s.status === 'Alerta de Risco').map((stat, idx) => (
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
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6">
                    {financialStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={500}>
                        <ComposedChart
                          data={financialStats}
                          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="dateStr" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickLine={false}
                          />
                          <YAxis 
                            yAxisId="left" 
                            tickFormatter={(value) => `R$ ${value}`}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip content={<CustomFinancialTooltip />} cursor={{ fill: '#f1f5f9' }} />
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
                )}
                
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
