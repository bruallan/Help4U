import React from 'react';
import { cn, formatCurrency } from '../utils';
import type { 
  ProductStats, DailyFinancialStats, 
  MarketScatterStat, ProductScatterStat 
} from '../types';

export const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductStats;
    return (
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl text-sm min-w-[200px]">
        <p className="font-bold text-slate-800 dark:text-slate-200 mb-2 border-b dark:border-slate-800 pb-2">{data.name}</p>
        <div className="space-y-1 text-slate-600 dark:text-slate-400">
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Volume:</span> {data.volume} unid.</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">HHI (Concentração):</span> {data.hhi?.toFixed(0) ?? 'N/A'}</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Margem:</span> {data.margin?.toFixed(2) ?? 'N/A'}%</p>
          <p><span className="font-medium text-slate-700 dark:text-slate-300">Vendas PIX:</span> {data.pixPercent?.toFixed(2) ?? 'N/A'}%</p>
        </div>
        <div className="mt-3 pt-2 border-t dark:border-slate-800">
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            data.status === 'Alerta de Risco' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
            data.status === 'Motor da Loja' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
            data.status === 'Cauda Longa' && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400",
            data.status === 'Venda Monopolizada Menor' && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          )}>
            {data.status}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const CustomFinancialTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailyFinancialStats;

    return (
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl text-sm min-w-[220px]">
        <p className="font-bold text-slate-800 dark:text-slate-200 mb-2 border-b dark:border-slate-800 pb-2">{data.dateStr}</p>
        <div className="space-y-2 text-slate-600 dark:text-slate-400">
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="w-3 h-3 rounded-full bg-orange-300 mr-2"></span>Faturamento:</span>
            <span className="dark:text-slate-200">{formatCurrency(data.faturamento)}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Margem Bruta:</span>
            <span className="dark:text-slate-200">{formatCurrency(data.margemBruta)}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="w-3 h-3 rounded-full bg-orange-800 mr-2"></span>Margem Líquida:</span>
            <span className={cn(data.margemLiquida < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "dark:text-slate-200")}>
              {formatCurrency(data.margemLiquida)}
            </span>
          </p>
          <div className="border-t dark:border-slate-800 my-1"></div>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Volume Vendas:</span>
            <span className="dark:text-slate-200">{data.volume} unid.</span>
          </p>
          <div className="border-t dark:border-slate-800 my-1"></div>
          <p className="flex justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="w-3 h-3 rounded-full bg-purple-500 mr-2"></span>Ticket Médio:</span>
            <span className="dark:text-slate-200">{data.transactions > 0 ? formatCurrency(data.faturamento / data.transactions) : formatCurrency(0)}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const CustomMarketScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as MarketScatterStat;

    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl text-sm min-w-[200px]">
        <p className="font-bold text-slate-800 mb-2 border-b pb-2">{data.name}</p>
        <div className="space-y-1 text-slate-600">
          <p><span className="font-medium text-slate-700">Volume (% do Total):</span> {data.volumePercent?.toFixed(2)}%</p>
          <p><span className="font-medium text-slate-700">Margem Líquida (% do Faturamento):</span> {data.marginPercent?.toFixed(2)}%</p>
          <p><span className="font-medium text-slate-700">Volume Absoluto:</span> {data.volume} unid.</p>
          <p><span className="font-medium text-slate-700">Faturamento:</span> {formatCurrency(data.faturamento)}</p>
          <p><span className="font-medium text-slate-700">Margem Líquida (R$):</span> {formatCurrency(data.margemLiquida)}</p>
        </div>
      </div>
    );
  }
  return null;
};

export const CustomProductScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductScatterStat;
    
    if (!data.name) return null;

    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl text-sm min-w-[200px]">
        <p className="font-bold text-slate-800 mb-1 border-b pb-1">{data.name}</p>
        <p className="text-xs text-slate-500 mb-2 uppercase font-semibold">{data.category}</p>
        <div className="space-y-1 text-slate-600">
          <p><span className="font-medium text-slate-700">Volume Relativo:</span> {data.volumePercent?.toFixed(2)}%</p>
          <p><span className="font-medium text-slate-700">Margem Unitária:</span> {formatCurrency(data.margemUnitaria || 0)}</p>
          <p><span className="font-medium text-slate-700">Margem %:</span> {data.marginPercent?.toFixed(2)}%</p>
          <p><span className="font-medium text-slate-700">Volume Absoluto:</span> {data.volume} unid.</p>
          <p><span className="font-medium text-slate-700">Faturamento:</span> {formatCurrency(data.faturamento)}</p>
          <p><span className="font-medium text-slate-700">Margem Líquida Total:</span> {formatCurrency(data.margemLiquida)}</p>
        </div>
      </div>
    );
  }
  return null;
};
