import React, { useState, useMemo } from 'react';
import { Building, DollarSign, Zap, AlertTriangle, Info, X, Camera, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { MappedRow } from '../types';
import { formatCurrency, cn } from '../utils';

interface RepasseSindicosProps {
  rawData: MappedRow[];
  availableUnits: string[];
}

export default function RepasseSindicos({ rawData, availableUnits }: RepasseSindicosProps) {
  // Configmock for the demo: We'll assume a fixed 5% pass-through rate, and energy cost for testing.
  // In a real scenario this might come from a config collection.
  
  const [selectedUnit, setSelectedUnit] = useState<string>(availableUnits[0] || '');
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  
  // Extract available months based on available data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.forEach(row => {
      if (row.date) {
        const d = new Date(row.date);
        if (!isNaN(d.getTime())) {
          months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
        }
      }
    });
    return Array.from(months).sort().reverse();
  }, [rawData]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '');

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

  const applySort = <T,>(data: T[]): T[] => {
    if (!sortConfig) return data;
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

  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      if (selectedUnit && row.client !== selectedUnit) return false;
      if (selectedMonth && row.date) {
        const d = new Date(row.date);
        const rowMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (rowMonth !== selectedMonth) return false;
      }
      return true;
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [rawData, selectedUnit, selectedMonth]);

  // Aggregate stats
  const stats = useMemo(() => {
    let faturamento = 0;
    
    filteredData.forEach(row => {
      faturamento += row.salePrice;
    });

    // Mock calculations based on standard logic
    const repasse = faturamento * 0.05; // standard 5% mock
    
    // Some units use their own energy, others use condo energy. We mock using a name check or string check
    const usaEnergiaCondominio = selectedUnit.toLowerCase().includes('condominio') || selectedUnit.length % 2 === 0;
    
    // Energy calculations
    const kwhPrice = 0.95; // Mock R$ / kWh
    const startReading = usaEnergiaCondominio ? 12450 + (faturamento % 1000) : 0;
    const endReading = startReading + (usaEnergiaCondominio ? Math.floor(Math.random() * 150) + 50 : 0);
    const energiaDelta = endReading - startReading;
    const custoEnergia = usaEnergiaCondominio ? energiaDelta * kwhPrice : 0;
    
    // Mock date dependencies based on selectedMonth
    const [y, m] = selectedMonth ? selectedMonth.split('-') : ['2023', '01'];
    const startDate = new Date(parseInt(y), parseInt(m) - 1, 2, 8, 30);
    const endDate = new Date(parseInt(y), parseInt(m), 1, 9, 15);

    const energyData = {
      startReading,
      endReading,
      delta: energiaDelta,
      kwhPrice,
      startDate,
      endDate,
      startPhoto: "https://images.unsplash.com/photo-1620025254924-acbf4148b594?w=600&q=80",
      endPhoto: "https://images.unsplash.com/photo-1620025254924-acbf4148b594?w=600&q=80"
    };

    // Mock furto data
    const furtosIdentificados = Math.max(0, faturamento * 0.005);
    const furtosNaoIdentificados = Math.max(0, faturamento * 0.015);

    return {
      faturamento,
      repasse,
      usaEnergiaCondominio,
      custoEnergia,
      furtosIdentificados,
      furtosNaoIdentificados,
      energyData
    };
  }, [filteredData, selectedUnit, selectedMonth]);

  // Format YYYY-MM
  const formatMonth = (str: string) => {
    if (!str) return '';
    const [y, m] = str.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Selecione a Unidade / Mercado
          </label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            {availableUnits.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Período (Mês/Ano)
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            {availableMonths.map(m => (
              <option key={m} value={m} className="capitalize">{formatMonth(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Faturamento Total
            </h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
            {formatCurrency(stats.faturamento)}
          </p>
        </div>

        {/* Repasse */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Building className="w-24 h-24" />
          </div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Valor do Repasse
            </h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
            {formatCurrency(stats.repasse)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Estimado no período</p>
        </div>

        {/* Energia */}
        <div 
          className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-all duration-200",
            stats.usaEnergiaCondominio && "hover:border-yellow-500/50 hover:shadow-md cursor-pointer group relative"
          )}
          onClick={() => stats.usaEnergiaCondominio && setShowEnergyModal(true)}
        >
          {stats.usaEnergiaCondominio && (
             <div className="absolute top-4 right-4 text-slate-300 dark:text-slate-600 group-hover:text-yellow-500 transition-colors">
               <ChevronRight className="w-5 h-5" />
             </div>
          )}
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Valor da Energia
            </h3>
          </div>
          {stats.usaEnergiaCondominio ? (
            <>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
                {formatCurrency(stats.custoEnergia)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Custo retido (ver detalhes)</p>
            </>
          ) : (
            <div className="mt-4 flex items-center justify-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border-dashed border border-slate-300 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Não se aplica
              </p>
            </div>
          )}
        </div>

        {/* Furtos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Relatório de Furtos
            </h3>
          </div>
          
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Identificados</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {formatCurrency(stats.furtosIdentificados)}
              </p>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Não Identificados</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                {formatCurrency(stats.furtosNaoIdentificados)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Detalhamento de Vendas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 rounded-tl-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('date')}>Data/Hora {getSortIcon('date')}</th>
                <th className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('productName')}>Produto(s) {getSortIcon('productName')}</th>
                <th className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 text-right rounded-tr-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('salePrice')}>Valor (R$) {getSortIcon('salePrice')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.length > 0 ? (
                applySort(filteredData).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      {row.date ? new Date(row.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-medium">{row.productName}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(row.salePrice)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    Nenhuma transação encontrada no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Fotos de Energia */}
      {showEnergyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEnergyModal(false)}>
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Leitura de Energia</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Comprovantes de medição do período</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEnergyModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Fotos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inicio */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Medição Inicial</span>
                    <span className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">
                      {stats.energyData.startDate.toLocaleDateString('pt-BR')} as {stats.energyData.startDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group">
                    <img 
                      src={stats.energyData.startPhoto} 
                      alt="Medidor Inicial" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white font-mono text-lg">{stats.energyData.startReading} kWh</p>
                    </div>
                  </div>
                </div>

                {/* Fim */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Medição Final</span>
                    <span className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">
                      {stats.energyData.endDate.toLocaleDateString('pt-BR')} as {stats.energyData.endDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group">
                    <img 
                      src={stats.energyData.endPhoto} 
                      alt="Medidor Final" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white font-mono text-lg">{stats.energyData.endReading} kWh</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado / Delta */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Consumo no período (Delta)</p>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {stats.energyData.endReading} - {stats.energyData.startReading} = <span className="text-yellow-600 dark:text-yellow-500">{stats.energyData.delta} kWh</span>
                  </p>
                </div>
                <div className="text-right">
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Custo Total (x R$ {stats.energyData.kwhPrice.toFixed(2)})</p>
                   <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                     {formatCurrency(stats.custoEnergia)}
                   </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-right">
              <button 
                onClick={() => setShowEnergyModal(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
