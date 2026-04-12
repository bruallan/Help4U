import React, { useState, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Search, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function App() {
  const [stats, setStats] = useState<ProductStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      if (rows.length <= 15) {
        throw new Error('A planilha não contém dados suficientes. Os dados devem começar na linha 16.');
      }
      
      const productMap = new Map<string, { dates: Date[] }>();
      let processedCount = 0;
      let globalMinDay: Date | null = null;
      let globalMaxDay: Date | null = null;
      
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      for (let i = 15; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const dateVal = row[0];
        const productName = row[13];
        
        if (!dateVal || !productName) continue;
        
        const date = parseExcelDate(dateVal);
        if (!date) continue;
        
        const dayDate = startOfDay(date);
        
        if (!globalMinDay || dayDate.getTime() < globalMinDay.getTime()) globalMinDay = dayDate;
        if (!globalMaxDay || dayDate.getTime() > globalMaxDay.getTime()) globalMaxDay = dayDate;
        
        const nameStr = String(productName).trim();
        if (!nameStr) continue;
        
        if (!productMap.has(nameStr)) {
          productMap.set(nameStr, { dates: [] });
        }
        productMap.get(nameStr)!.dates.push(date);
        processedCount++;
      }
      
      if (processedCount === 0) {
        throw new Error('Nenhum dado válido encontrado. Verifique se as datas estão na Coluna A e os nomes na Coluna N.');
      }
      
      const newStats: ProductStats[] = [];
      
      const totalGlobalDays = globalMinDay && globalMaxDay 
        ? Math.round((globalMaxDay.getTime() - globalMinDay.getTime()) / 86400000) + 1 
        : 30;
      
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
        
        newStats.push({
          name,
          salesCount,
          minDate,
          maxDate,
          velocity,
          timeToSellOne,
          ruptureDays,
          uniqueSalesCount
        });
      }
      
      newStats.sort((a, b) => {
        if (a.velocity === null && b.velocity === null) return 0;
        if (a.velocity === null) return 1;
        if (b.velocity === null) return -1;
        return b.velocity - a.velocity;
      });
      
      setStats(newStats);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar o arquivo.');
      setStats([]);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard de Vendas</h1>
          <p className="text-slate-500 mt-2">
            Importe sua planilha de vendas para calcular a velocidade média e o tempo de venda por produto.
          </p>
        </header>

        {/* Upload Area */}
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

        {/* Results Area */}
        {stats.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Resultados da Análise</h2>
                  <p className="text-sm text-slate-500">{fileName} • {stats.length} produtos encontrados</p>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
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

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
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
                        <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                          Nenhum produto encontrado com o termo "{searchTerm}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
