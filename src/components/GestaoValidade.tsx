import React, { useState, useMemo } from 'react';
import { MappedRow } from '../types';
import { AlertCircle, Calendar, Package, Search, ShoppingCart, TrendingDown, Layers, Map as MapIcon, ChevronDown, Check, Activity } from 'lucide-react';
import { cn } from '../utils';
import { UnitDropdown } from './Dropdowns';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface GestaoValidadeProps {
  rawData: MappedRow[];
  availableUnits: string[];
}

export function GestaoValidade({ rawData, availableUnits }: GestaoValidadeProps) {
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [searchSku, setSearchSku] = useState("");
  const [manualInputs, setManualInputs] = useState<Record<string, { date: string; qty: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingVMPay, setIsFetchingVMPay] = useState(false);
  const [vmpayLog, setVmpayLog] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  React.useEffect(() => {
    async function loadData() {
      try {
        const docRef = doc(db, 'settings', 'validadeInputs');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setManualInputs(docSnap.data().inputs || {});
        }
      } catch(e) {
        console.error("Failed to load validade inputs", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  React.useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(async () => {
       setIsSaving(true);
       try {
         await setDoc(doc(db, 'settings', 'validadeInputs'), {
           inputs: manualInputs,
           updatedAt: serverTimestamp()
         }, { merge: true });
       } catch(e) {
         console.error("Failed to save validade inputs", e);
       } finally {
         setIsSaving(false);
       }
    }, 1500);
    return () => clearTimeout(timer);
  }, [manualInputs, isLoaded]);

  React.useEffect(() => {
    if (!selectedMarket && availableUnits.length > 0) {
      setSelectedMarket(availableUnits[0]);
    }
  }, [availableUnits, selectedMarket]);

  const handleFetchVMPay = async () => {
    setIsFetchingVMPay(true);
    setVmpayLog([]);
    try {
      const res = await fetch("/api/load-validades");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro no servidor");
      }
      if (data.data) {
        setManualInputs(prev => ({...prev, ...data.data}));
      }
      if (data.logs) {
        setVmpayLog(data.logs);
        setShowLogs(true);
      }
    } catch (e: any) {
       console.error("VMPay Fetch Error", e);
       alert("Erro ao buscar dados: " + e.message);
    } finally {
       setIsFetchingVMPay(false);
    }
  };

  // Computes
  const skuMetrics = useMemo(() => {
    const marketsToUse = selectedMarket ? [selectedMarket] : [];
    if (marketsToUse.length === 0 || rawData.length === 0) return { map: new Map(), medianVolume: 0 };

    const map = new Map<string, {
      volume: number;
      totalCost: number;
      totalSale: number;
      associated: Map<string, number>;
      minDate: Date;
      maxDate: Date;
    }>();

    const tickets = new Map<string, string[]>();

    let globalMin = new Date(8640000000000000);
    let globalMax = new Date(-8640000000000000);

    for (const row of rawData) {
      const clientName = row.client || 'Desconhecido';
      if (!marketsToUse.includes(clientName)) continue;

      if (row.dayDate < globalMin) globalMin = row.dayDate;
      if (row.dayDate > globalMax) globalMax = row.dayDate;

      // Group for affinity
      const tId = row.idCupom;
      if (tId) {
        if (!tickets.has(tId)) tickets.set(tId, []);
        tickets.get(tId)!.push(row.productName);
      }

      if (!map.has(row.productName)) {
        map.set(row.productName, {
          volume: 0,
          totalCost: 0,
          totalSale: 0,
          associated: new Map(),
          minDate: new Date(8640000000000000),
          maxDate: new Date(-8640000000000000)
        });
      }
      
      const p = map.get(row.productName)!;
      p.volume += 1; // 1 iter = 1 qty sold (or row.quantity context, but our rows represent 1 item typically or sale is grouped?)
      p.totalSale += row.salePrice;
      p.totalCost += row.costPrice;
      if (row.dayDate < p.minDate) p.minDate = row.dayDate;
      if (row.dayDate > p.maxDate) p.maxDate = row.dayDate;
    }

    // Co-occurrence
    for (const products of Array.from(tickets.values())) {
      const uniqueProds = Array.from(new Set(products));
      for (const pA of uniqueProds) {
        if (!map.has(pA)) continue;
        const assoc = map.get(pA)!.associated;
        for (const pB of uniqueProds) {
          if (pA !== pB) {
            assoc.set(pB, (assoc.get(pB) || 0) + 1);
          }
        }
      }
    }

    const vols = Array.from(map.values()).map(v => v.volume).sort((a,b) => a-b);
    const medianVolume = vols.length > 0 ? (vols.length % 2 === 0 ? (vols[vols.length/2 - 1] + vols[vols.length/2]) / 2 : vols[Math.floor(vols.length/2)]) : 0;

    const totalDays = Math.max(1, (globalMax.getTime() - globalMin.getTime()) / (1000 * 3600 * 24));
    
    // transform into final workable objects
    const finalMap = new Map<string, any>();
    for (const [sku, v] of Array.from(map.entries())) {
       const vmd = v.volume / totalDays;
       const avgCusto = v.volume > 0 ? v.totalCost / v.volume : 0;
       const avgPreco = v.volume > 0 ? v.totalSale / v.volume : 0;
       const limitPreco = avgCusto * 1.27; // Custo + 27%
       
       const topAssoc = Array.from(v.associated.entries())
         .sort((a,b) => b[1] - a[1])
         .slice(0, 3)
         .map(t => t[0]);
         
       finalMap.set(sku, {
          sku,
          volume: v.volume,
          vmd,
          avgCusto,
          avgPreco,
          limitPreco,
          topAssoc,
          isHighTurnover: v.volume >= medianVolume
       });
    }

    return { map: finalMap, medianVolume };
  }, [rawData, selectedMarket, availableUnits]);

  // Handle Input Changes
  const handleInputChange = (sku: string, field: 'date'|'qty', value: any) => {
    if (!selectedMarket) return;
    const key = `${selectedMarket}_${sku}`;
    setManualInputs(prev => {
      const current = prev[key] || { date: '', qty: 0 };
      return {
        ...prev,
        [key]: { ...current, [field]: field === 'qty' ? Number(value) : value }
      };
    });
  };

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);

  // Compute Results Table
  const tableData = useMemo(() => {
    const arr = [];
    for (const [sku, meta] of Array.from(skuMetrics.map.entries())) {
       // Filter search
       if (searchSku && !sku.toLowerCase().includes(searchSku.toLowerCase())) continue;

       const key = `${selectedMarket}_${sku}`;
       const inputs = manualInputs[key] || { date: '', qty: 0 };
       
       let dpv = Infinity;
       if (inputs.date) {
         const validadeDate = new Date(inputs.date);
         validadeDate.setHours(0,0,0,0);
         dpv = Math.ceil((validadeDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));
       }
       
       const te = meta.vmd > 0 ? inputs.qty / meta.vmd : Infinity;
       let ir = 0;
       if (dpv <= 0) ir = Infinity; // Already expired or expires today
       else if (inputs.qty > 0 && dpv > 0) ir = te / dpv;

       let actionRoute = "Normal";
       let isRisk = ir >= 0.9;
       
       if (isRisk) {
          const pN1 = meta.avgPreco * 0.85;
          const passesVal = pN1 >= meta.limitPreco;
          
          if (passesVal && meta.isHighTurnover) {
             actionRoute = `Corte Preço (-15% = R$ ${pN1.toFixed(2)})`;
          } else {
             actionRoute = `Ancoragem (Combo: ${meta.topAssoc.join(', ') || 'Nenhum'})`;
          }
       } else if (inputs.qty === 0) {
          actionRoute = "-";
       }

       arr.push({
         sku,
         qty: inputs.qty,
         date: inputs.date,
         dpv,
         te,
         ir,
         isRisk,
         actionRoute,
         vmd: meta.vmd,
         topAssoc: meta.topAssoc,
         isHighTurnover: meta.isHighTurnover
       });
    }
    return arr.sort((a,b) => {
       if (a.isRisk && !b.isRisk) return -1;
       if (!a.isRisk && b.isRisk) return 1;
       return b.ir - a.ir;
    });
  }, [skuMetrics, searchSku, manualInputs, todayDate, selectedMarket]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden transition-colors">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center">
               Motor Preditivo de Validade
               {isSaving && <span className="ml-3 text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full flex items-center animate-pulse"><Activity className="w-3 h-3 mr-1" /> Salvando...</span>}
               {!isSaving && isLoaded && <span className="ml-3 text-xs font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center"><Check className="w-3 h-3 mr-1" /> Salvo</span>}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Combine os dados estáticos (estoque a vencer) com o giro dinâmico e o cálculo de afinidade para gerar ações automáticas 
              (Tração própria vs. Ancoragem). Risco (IR ≥ 0.9).
            </p>
          </div>
          <div className="flex gap-2 relative">
            <button
               onClick={handleFetchVMPay}
               disabled={isFetchingVMPay}
               className="inline-flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
             >
               {isFetchingVMPay ? <Activity className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
               <span>Buscar Sistema</span>
             </button>
             {vmpayLog.length > 0 && (
               <button
                 onClick={() => setShowLogs(!showLogs)}
                 className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
               >
                 <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
               </button>
             )}
             
             {showLogs && (
               <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-4 z-50">
                 <h4 className="font-semibold text-sm mb-2 text-slate-900 dark:text-white">Logs de Importação</h4>
                 <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 max-h-40 overflow-y-auto">
                   {vmpayLog.map((l, i) => <li key={i}>{l}</li>)}
                 </ul>
               </div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selecione o Mercado</label>
              <select 
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              >
                {!selectedMarket && <option value="">Selecione um mercado...</option>}
                {availableUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Buscar Produto (SKU)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  value={searchSku}
                  onChange={(e) => setSearchSku(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full pl-10 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white" 
                  placeholder="Filtrar por nome do produto..." 
                />
              </div>
           </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
           <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
             <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-950 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
               <tr>
                 <th className="px-4 py-3">SKU / Produto</th>
                 <th className="px-4 py-3">VMD</th>
                 <th className="px-4 py-3">Giro Alto/Médio</th>
                 <th className="px-4 py-3">Qtde a Vencer (E)</th>
                 <th className="px-4 py-3">Data Validade</th>
                 <th className="px-4 py-3">DPV</th>
                 <th className="px-4 py-3">TE</th>
                 <th className="px-4 py-3">Risco (IR)</th>
                 <th className="px-4 py-3">Ação Sugerida</th>
               </tr>
             </thead>
             <tbody>
               {tableData.length === 0 && (
                 <tr>
                   <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                     Nenhum produto encontrado. Selecione os mercados corretamente.
                   </td>
                 </tr>
               )}
               {tableData.map((row, idx) => {
                  const isInfinity = row.ir === Infinity;
                  return (
                    <tr key={row.sku} className={cn("border-b dark:border-slate-800 transition-colors", row.isRisk ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50")}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={row.sku}>
                        {row.sku}
                      </td>
                      <td className="px-4 py-3 font-mono">{row.vmd.toFixed(2)}</td>
                      <td className="px-4 py-3">
                         {row.isHighTurnover ? (
                           <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">Sim</span>
                         ) : (
                           <span className="inline-flex items-center text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">Não</span>
                         )}
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          min="0"
                          value={row.qty || ''} 
                          onChange={(e) => handleInputChange(row.sku, 'qty', e.target.value)}
                          className="w-20 p-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="date" 
                          value={row.date} 
                          onChange={(e) => handleInputChange(row.sku, 'date', e.target.value)}
                          className="w-36 p-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">{row.qty > 0 && row.date ? (row.dpv > 0 ? `${row.dpv} d` : 'Vencido') : '-'}</td>
                      <td className="px-4 py-3">{row.qty > 0 ? (row.te === Infinity ? 'Sem Giro' : `${row.te.toFixed(1)} d`) : '-'}</td>
                      <td className="px-4 py-3">
                        {row.qty > 0 && row.date ? (
                          <span className={cn(
                            "font-bold font-mono px-2 py-1 rounded",
                            row.isRisk 
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" 
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          )}>
                            {isInfinity ? 'CRÍTICO' : row.ir.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.qty > 0 && row.isRisk ? (
                          <div className={cn(
                            "border-l-4 pl-3 py-1",
                            row.actionRoute.includes('Corte') ? "border-orange-500 text-orange-700 dark:text-orange-400" : "border-purple-500 text-purple-700 dark:text-purple-400"
                          )}>
                            <p className="font-semibold leading-tight">{row.actionRoute}</p>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  )
               })}
             </tbody>
           </table>
        </div>

      </div>
    </div>
  )
}
