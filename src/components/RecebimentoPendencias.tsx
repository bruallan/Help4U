import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, Calculator, Calendar, Check, AlertCircle, RefreshCw, Plus, Trash2 
} from "lucide-react";
const API_BASE = (import.meta as any).env?.VITE_API_URL || "";
import { cn } from "../utils";

export default function RecebimentoPendencias({ 
  produtos, lotes, fetchDados 
}: { 
  produtos: any[]; lotes: any[]; fetchDados: () => void 
}) {
  const [isFetchingVMPay, setIsFetchingVMPay] = useState(false);
  const [simuladorProduto, setSimuladorProduto] = useState("");
  const [simuladorQty, setSimuladorQty] = useState<number | "">("");
  const [simuladorDate, setSimuladorDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Filtros
  const lotesAguardandoValidade = lotes.filter(l => l.status === "aguardando_validade");
  const lotesAguardandoNota = lotes.filter(l => l.status === "aguardando_nota");

  const filteredProdutos = useMemo(() => {
    if (!simuladorProduto) return produtos.slice(0, 50);
    const lower = simuladorProduto.toLowerCase();
    return produtos.filter(p => p.produto?.toLowerCase().includes(lower) || p.codigoBarras?.includes(lower)).slice(0, 50);
  }, [produtos, simuladorProduto]);

  const handleBuscarEntradas = async () => {
    setIsFetchingVMPay(true);
    try {
      const res = await fetch(`${API_BASE}/api/vmpay/entradas`);
      if (!res.ok) throw new Error("Erro ao buscar no VMPay");
      const data = await res.json();
      
      // Para cada entrada, criar um lote "aguardando_validade"
      // Assumindo data como array de itens
      const entries = Array.isArray(data) ? data : (data.data || []);
      let count = 0;
      for (const entry of entries) {
         if (entry.kind !== "StorableEntry" && entry.originator_type !== "StorableEntry") continue;
         
         const qty = entry.quantity || (entry.total_cost_price && entry.cost_price ? Math.round(entry.total_cost_price / entry.cost_price) : 1);
         const prodName = entry.good?.display_name || entry.product_name;
         if (!prodName) continue;

         // Check if already exists in aguardando_validade to avoid exact dupes roughly
         const isDupe = lotesAguardandoValidade.find(l => l.produto === prodName && l.quantidadeAtual === qty);
         if (isDupe) continue;

         const pDB = produtos.find(p => p.produto === prodName || p.codigoBarras === entry.good?.barcode);
         
         await fetch(`${API_BASE}/api/lotes`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             produtoId: pDB?.id || null,
             produto: prodName,
             quantidadeAtual: qty,
             dataValidade: null,
             status: "aguardando_validade"
           })
         });
         count++;
      }
      alert(`${count} entradas importadas para Aguardando Validade.`);
      fetchDados();
    } catch(e) {
      console.error(e);
      alert("Erro ao sincronizar com VMPay.");
    }
    setIsFetchingVMPay(false);
  };

  const selectedProd = produtos.find(p => p.produto === simuladorProduto);

  // Simulação de risco
  let riscoText = "-";
  let riscoColor = "text-slate-500";
  if (selectedProd && simuladorDate) {
    const vmd = selectedProd.velocidadeMedia7d || selectedProd.totalVendido / 30 || 0.1;
    const dpv = Math.ceil((new Date(simuladorDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    const isRisco = (simuladorQty || 0) / vmd > dpv;
    if (dpv <= 0) {
      riscoText = "VENCIDO";
      riscoColor = "text-red-600";
    } else if (isRisco) {
      riscoText = "ALTO RISCO";
      riscoColor = "text-orange-600";
    } else {
      riscoText = "SEGURO";
      riscoColor = "text-green-600";
    }
  }

  const handleLancarAguardandoNota = async () => {
    if (!selectedProd) return alert("Selecione um produto.");
    if (!simuladorDate) return alert("Preencha a data de validade.");
    
    try {
      await fetch(`${API_BASE}/api/lotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: selectedProd.id,
          produto: selectedProd.produto,
          quantidadeAtual: simuladorQty === "" ? null : Number(simuladorQty),
          dataValidade: simuladorDate,
          status: "aguardando_nota"
        })
      });
      setSimuladorProduto("");
      setSimuladorQty("");
      setSimuladorDate("");
      fetchDados();
    } catch(e) {
      console.error(e);
      alert("Erro ao lançar");
    }
  };

  const handleForcarValidacao = async (lote: any) => {
    if (!lote.quantidadeAtual || lote.quantidadeAtual <= 0) {
      return alert("Preencha a quantidade antes de forçar a validação.");
    }
    try {
      // 1. Chama API do VMPay para ajuste (Mockado no nosso backend /api/sync/db-to-vmpay)
      await fetch(`${API_BASE}/api/sync/db-to-vmpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoIds: [lote.produto] })
      });
      // 2. Muda status para consolidado
      await fetch(`${API_BASE}/api/lotes/${lote.idLote}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "consolidado" })
      });
      fetchDados();
    } catch(e) {
      alert("Erro ao forçar validação");
    }
  };

  const handleSalvarValidade = async (lote: any, newDate: string) => {
    if (!newDate) return;
    try {
      await fetch(`${API_BASE}/api/lotes/${lote.idLote}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataValidade: newDate, status: "consolidado" })
      });
      fetchDados();
    } catch(e) {
      alert("Erro ao salvar validade");
    }
  };

  const handleUpdateQty = async (lote: any, newQty: number) => {
    try {
      await fetch(`${API_BASE}/api/lotes/${lote.idLote}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidadeAtual: newQty })
      });
      fetchDados();
    } catch(e) {
      alert("Erro ao atualizar quantidade");
    }
  };

  const handleDelete = async (loteId: number) => {
    if (!confirm("Remover este lote?")) return;
    try {
      await fetch(`${API_BASE}/api/lotes/${loteId}`, { method: "DELETE" });
      fetchDados();
    } catch(e) {
      alert("Erro ao deletar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SIMULADOR / RECEBIMENTO CEGO */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Simulador / Recebimento Cego</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">Recebeu produtos sem a nota? Simule o risco e lance para a fila "Aguardando Nota". A quantidade é opcional.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Produto</label>
              <input 
                type="text" 
                value={simuladorProduto}
                onChange={(e) => { setSimuladorProduto(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                placeholder="Buscar produto..."
              />
              {showDropdown && simuladorProduto && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredProdutos.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { setSimuladorProduto(p.produto); setShowDropdown(false); }}
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {p.produto}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade</label>
                <input 
                  type="number" 
                  value={simuladorQty}
                  onChange={(e) => setSimuladorQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                  placeholder="Opcional..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Validade</label>
                <input 
                  type="date" 
                  value={simuladorDate}
                  onChange={(e) => setSimuladorDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                />
              </div>
            </div>

            {selectedProd && simuladorDate && (
              <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Risco Estimado:</span>
                  <span className={cn("font-bold", riscoColor)}>{riscoText}</span>
                </div>
                <div className="text-xs text-slate-400">
                  VMD: {(selectedProd.velocidadeMedia7d || selectedProd.totalVendido/30 || 0).toFixed(2)} uni/dia
                </div>
              </div>
            )}

            <button 
              onClick={handleLancarAguardandoNota}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Lançar para Aguardando Nota
            </button>
          </div>
        </div>

        {/* FILAS DE PENDÊNCIAS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AGUARDANDO VALIDADE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aguardando Validade</h3>
              </div>
              <button 
                onClick={handleBuscarEntradas}
                disabled={isFetchingVMPay}
                className="flex items-center justify-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <RefreshCw className={cn("w-4 h-4", isFetchingVMPay && "animate-spin")} />
                Buscar Entradas VMPay
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Produtos que deram entrada via Nota Fiscal no VMPay. Informe a validade para consolidar.</p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 w-24">Qtd</th>
                    <th className="px-4 py-3 w-40">Validade</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesAguardandoValidade.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum item aguardando.</td></tr>
                  )}
                  {lotesAguardandoValidade.map(l => (
                    <tr key={l.idLote} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium truncate max-w-[150px]" title={l.produto}>{l.produto}</td>
                      <td className="px-4 py-3 font-mono">{l.quantidadeAtual}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="date" 
                          className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"
                          onChange={(e) => {
                             // Poderia ter um estado local, mas para simplicidade vamos atualizar no blur ou botao
                             const el = e.target;
                             l._tempDate = el.value;
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleSalvarValidade(l, l._tempDate)}
                            className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(l.idLote)}
                            className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AGUARDANDO NOTA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aguardando Nota</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">Itens recebidos às cegas. Quando a nota entrar, preencha a quantidade e force a validação.</p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 w-40">Validade</th>
                    <th className="px-4 py-3 w-24">Qtd</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesAguardandoNota.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum item aguardando.</td></tr>
                  )}
                  {lotesAguardandoNota.map(l => {
                    const hasQty = l.quantidadeAtual !== null && l.quantidadeAtual > 0;
                    return (
                      <tr key={l.idLote} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 font-medium truncate max-w-[150px]" title={l.produto}>{l.produto}</td>
                        <td className="px-4 py-3">
                          {l.dataValidade ? new Date(l.dataValidade).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            defaultValue={l.quantidadeAtual || ""}
                            className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 dark:text-white font-mono [color-scheme:light_dark]"
                            onBlur={(e) => handleUpdateQty(l, Number(e.target.value))}
                            placeholder="Qtd..."
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleForcarValidacao(l)}
                              disabled={!hasQty}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap",
                                hasQty ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              )}
                              title="Forçar Validação no VMPay"
                            >
                              <Check className="w-3 h-3" />
                              Forçar Validação
                            </button>
                            <button 
                              onClick={() => handleDelete(l.idLote)}
                              className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
