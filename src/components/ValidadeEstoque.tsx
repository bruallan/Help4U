import React, { useState, useMemo, useEffect } from "react";
import { MappedRow } from "../types";
import {
  AlertCircle,
  Search,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Camera,
} from "lucide-react";
import { cn } from "../utils";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

interface ValidadeEstoqueProps {
  rawData: MappedRow[];
}

interface Lote {
  idLote: number;
  produtoId: number;
  produto: string;
  dataValidade: string;
  quantidadeAtual: number;
}

interface ProdutoDB {
  id: number;
  produto: string;
  quantidadeEstoque: number;
}

export default function ValidadeEstoque({ rawData }: ValidadeEstoqueProps) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [produtosDB, setProdutosDB] = useState<ProdutoDB[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchSku, setSearchSku] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  const riskWarning = useMemo(() => {
    if (!modalProduto || !modalDataValidade || !modalQuantidade) return null;
    
    const metric = skuMetrics.map.get(modalProduto);
    if (!metric) return null;
    
    let globalMin = new Date(8640000000000000);
    let globalMax = new Date(-8640000000000000);
    for (const row of rawData) {
      if (row.dayDate < globalMin) globalMin = row.dayDate;
      if (row.dayDate > globalMax) globalMax = row.dayDate;
    }
    const maxDays = Math.max(1, (globalMax.getTime() - globalMin.getTime()) / 86400000);
    const vmd = metric.volume / maxDays;
    
    if (vmd === 0) return null;
    
    const prodDb = produtosDB.find((p) => p.produto === modalProduto);
    const totalEstoque = prodDb?.quantidadeEstoque || 0;
    
    const novoTotal = totalEstoque + Number(modalQuantidade);
    const daysToSell = novoTotal / vmd;
    
    const expiryDate = new Date(modalDataValidade);
    const today = new Date();
    const daysToExpiry = (expiryDate.getTime() - today.getTime()) / 86400000;
    
    if (daysToSell > daysToExpiry * 0.9) {
      return {
        vmd: vmd.toFixed(2),
        daysToSell: Math.ceil(daysToSell),
        daysToExpiry: Math.ceil(daysToExpiry),
        novoTotal
      };
    }
    
    return null;
  }, [modalProduto, modalDataValidade, modalQuantidade, skuMetrics, produtosDB, rawData]);

  // Modal state
  const [modalProduto, setModalProduto] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [modalDataValidade, setModalDataValidade] = useState("");
  const [modalQuantidade, setModalQuantidade] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let html5QrCode;

    if (isScanning) {
      html5QrCode = new Html5Qrcode("reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 30,
              disableFlip: false,
              qrbox: { width: 300, height: 150 },
              formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]
            },
            async (decodedText) => {
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
              }
              setIsScanning(false);
              try {
                const res = await fetch(`${API_BASE}/api/barcode/${decodedText}`);
                if (res.ok) {
                  const data = await res.json();
                  setModalProduto(data.produto);
                  setShowDropdown(false);
                  setTimeout(() => {
                    document.getElementById('validade-input')?.focus();
                  }, 100);
                } else {
                  alert("Produto não encontrado para este código de barras.");
                }
              } catch (e) {
                console.error(e);
                alert("Erro ao buscar produto.");
              }
            },
            (error) => {
              // ignore
            }
          );
        } catch (err) {
          console.error("Erro ao iniciar a câmera", err);
          alert("Não foi possível iniciar a câmera. Verifique as permissões.");
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const fetchDados = async () => {
    setIsLoading(true);
    try {
      const [resLotes, resProdutos] = await Promise.all([
        fetch(`${API_BASE}/api/lotes`),
        fetch(`${API_BASE}/api/produtos`),
      ]);
      const dataLotes = await resLotes.json();
      const dataProdutos = await resProdutos.json();
      setLotes(dataLotes);
      setProdutosDB(dataProdutos);
    } catch (e) {
      console.error("Erro ao buscar dados do banco", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const handleSalvarLote = async () => {
    if (!modalProduto || !modalDataValidade || !modalQuantidade) {
      alert("Preencha todos os campos.");
      return;
    }
    const prod = produtosDB.find((p) => p.produto === modalProduto);
    if (!prod) {
      alert("Produto não encontrado.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/lotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: prod.id,
          produto: prod.produto,
          dataValidade: modalDataValidade,
          quantidadeAtual: Number(modalQuantidade),
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setModalProduto("");
        setModalDataValidade("");
        setModalQuantidade("");
        fetchDados();
      } else {
        alert("Erro ao salvar lote.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar lote.");
    }
  };

  // Calcula VMD e Métricas de Vendas
  const skuMetrics = useMemo(() => {
    if (rawData.length === 0) return { map: new Map(), medianVolume: 0 };

    const map = new Map<
      string,
      {
        volume: number;
        totalCost: number;
        totalSale: number;
        associated: Map<string, number>;
        minDate: Date;
        maxDate: Date;
      }
    >();

    const tickets = new Map<string, string[]>();

    let globalMin = new Date(8640000000000000);
    let globalMax = new Date(-8640000000000000);

    for (const row of rawData) {
      if (row.dayDate < globalMin) globalMin = row.dayDate;
      if (row.dayDate > globalMax) globalMax = row.dayDate;

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
          maxDate: new Date(-8640000000000000),
        });
      }

      const p = map.get(row.productName)!;
      p.volume += 1;
      p.totalSale += row.salePrice;
      p.totalCost += row.costPrice;
      if (row.dayDate < p.minDate) p.minDate = row.dayDate;
      if (row.dayDate > p.maxDate) p.maxDate = row.dayDate;
    }

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

    const vols = Array.from(map.values())
      .map((v) => v.volume)
      .sort((a, b) => a - b);
    const medianVolume =
      vols.length > 0
        ? vols.length % 2 === 0
          ? (vols[vols.length / 2 - 1] + vols[vols.length / 2]) / 2
          : vols[Math.floor(vols.length / 2)]
        : 0;

    const totalDays = Math.max(
      1,
      (globalMax.getTime() - globalMin.getTime()) / (1000 * 3600 * 24),
    );

    const finalMap = new Map<string, any>();
    for (const [sku, v] of Array.from(map.entries())) {
      const vmd = v.volume / totalDays;
      const avgCusto = v.volume > 0 ? v.totalCost / v.volume : 0;
      const avgPreco = v.volume > 0 ? v.totalSale / v.volume : 0;
      const limitPreco = avgCusto * 1.27; // Custo + 27%

      const topAssoc = Array.from(v.associated.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((t) => t[0]);

      finalMap.set(sku, {
        sku,
        vmd,
        avgPreco,
        limitPreco,
        topAssoc,
        isHighTurnover: v.volume >= medianVolume,
      });
    }

    return { map: finalMap, medianVolume };
  }, [rawData]);

  // Calcula dados agregados dos lotes por produto
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const lotesAgregados = useMemo(() => {
    const map = new Map<
      string,
      {
        produto: string;
        quantidadeTotal: number;
        loteMaisProximo: Lote | null;
      }
    >();

    for (const lote of lotes) {
      if (!map.has(lote.produto)) {
        map.set(lote.produto, {
          produto: lote.produto,
          quantidadeTotal: 0,
          loteMaisProximo: null,
        });
      }
      const p = map.get(lote.produto)!;
      p.quantidadeTotal += lote.quantidadeAtual;

      const validadeLote = new Date(lote.dataValidade);
      if (
        !p.loteMaisProximo ||
        validadeLote.getTime() <
          new Date(p.loteMaisProximo.dataValidade).getTime()
      ) {
        p.loteMaisProximo = lote;
      }
    }
    return map;
  }, [lotes]);

  const alertasEstoque = useMemo(() => {
    const alertas = [];
    for (const pDB of produtosDB) {
      const loteData = lotesAgregados.get(pDB.produto);
      const qtdLotes = loteData ? loteData.quantidadeTotal : 0;
      if (qtdLotes !== (pDB.quantidadeEstoque || 0)) {
        alertas.push({
          produto: pDB.produto,
          qtdDimProdutos: pDB.quantidadeEstoque || 0,
          qtdLotes,
        });
      }
    }
    return alertas;
  }, [produtosDB, lotesAgregados]);

  const tableData = useMemo(() => {
    const arr = [];
    for (const [produto, loteData] of lotesAgregados.entries()) {
      if (searchSku && !produto.toLowerCase().includes(searchSku.toLowerCase()))
        continue;

      const meta = skuMetrics.map.get(produto) || {
        vmd: 0,
        isHighTurnover: false,
        topAssoc: [],
        avgPreco: 0,
        limitPreco: 0,
      };

      const lote = loteData.loteMaisProximo;
      let dpv = Infinity;
      if (lote) {
        const validadeDate = new Date(lote.dataValidade);
        validadeDate.setHours(0, 0, 0, 0);
        dpv = Math.ceil(
          (validadeDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24),
        );
      }

      const qtdE = lote ? lote.quantidadeAtual : 0;
      const te = meta.vmd > 0 ? qtdE / meta.vmd : Infinity;

      let ir = 0;
      if (dpv <= 0) ir = Infinity;
      else if (qtdE > 0 && dpv > 0) ir = te / dpv;

      let actionRoute = "Normal";
      let isRisk = ir >= 0.75; // Risco (IR >= 0.75) conforme instrução

      if (isRisk) {
        const pN1 = meta.avgPreco * 0.85;
        const passesVal = pN1 >= meta.limitPreco;

        if (passesVal && meta.isHighTurnover) {
          actionRoute = `Corte Preço (-15% = R$ ${pN1.toFixed(2)})`;
        } else {
          actionRoute = `Ancoragem (Combo: ${meta.topAssoc.join(", ") || "Nenhum"})`;
        }
      } else if (qtdE === 0) {
        actionRoute = "-";
      }

      arr.push({
        sku: produto,
        vmd: meta.vmd,
        isHighTurnover: meta.isHighTurnover,
        qty: qtdE,
        date: lote ? lote.dataValidade.split("T")[0] : "-",
        dpv,
        te,
        ir,
        isRisk,
        actionRoute,
      });
    }

    return arr.sort((a, b) => {
      if (a.isRisk && !b.isRisk) return -1;
      if (!a.isRisk && b.isRisk) return 1;
      return b.ir - a.ir;
    });
  }, [lotesAgregados, searchSku, skuMetrics, todayDate]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return (
        <ArrowUpDown className="w-3 h-3 ml-1 inline-block text-slate-400" />
      );
    }
    if (sortConfig.direction === "asc") {
      return (
        <ArrowUp className="w-3 h-3 ml-1 inline-block text-purple-600 dark:text-purple-400" />
      );
    }
    return (
      <ArrowDown className="w-3 h-3 ml-1 inline-block text-purple-600 dark:text-purple-400" />
    );
  };

  const applySort = <T,>(data: T[]): T[] => {
    if (!sortConfig) return data;
    return [...data].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined)
        return sortConfig.direction === "asc" ? 1 : -1;
      if (bVal === null || bVal === undefined)
        return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  return (
    <div className="space-y-6">
      {/* Cadastro de Lote */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Controle de Lotes
            {isLoading && (
              <Activity className="w-4 h-4 animate-spin text-purple-500" />
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cadastre os lotes que chegaram no estoque central para análise
            preditiva.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Lote</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Análise Preditiva de Validade
          </h3>
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              placeholder="Filtrar produto..."
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-950 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("sku")}
                >
                  SKU / Produto {getSortIcon("sku")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("vmd")}
                >
                  VMD {getSortIcon("vmd")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("isHighTurnover")}
                >
                  Giro Alto/Médio {getSortIcon("isHighTurnover")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("qty")}
                >
                  Qtde Mais Próxima a Vencer {getSortIcon("qty")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Data Validade Mais próxima {getSortIcon("date")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("dpv")}
                >
                  DPV {getSortIcon("dpv")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("te")}
                >
                  TE {getSortIcon("te")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("ir")}
                >
                  Risco (IR) {getSortIcon("ir")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort("actionRoute")}
                >
                  Ação Sugerida {getSortIcon("actionRoute")}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nenhum lote cadastrado.
                  </td>
                </tr>
              )}
              {applySort<any>(tableData).map((row: any) => {
                const isInfinity = row.ir === Infinity;
                return (
                  <tr
                    key={row.sku}
                    className={cn(
                      "border-b dark:border-slate-800 transition-colors",
                      row.isRisk
                        ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <td
                      className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate"
                      title={row.sku}
                    >
                      {row.sku}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {row.vmd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {row.isHighTurnover ? (
                        <span className="inline-flex items-center text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Não
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {row.qty}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {row.date}
                    </td>
                    <td className="px-4 py-3">
                      {row.qty > 0 && row.date !== "-"
                        ? row.dpv > 0
                          ? `${row.dpv} d`
                          : "Vencido"
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {row.qty > 0
                        ? row.te === Infinity
                          ? "Sem Giro"
                          : `${row.te.toFixed(1)} d`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {row.qty > 0 && row.date !== "-" ? (
                        <span
                          className={cn(
                            "font-bold font-mono px-2 py-1 rounded inline-flex items-center gap-1",
                            row.isRisk
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                          )}
                        >
                          {isInfinity ? <>∞ CRÍTICO</> : row.ir.toFixed(2)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.qty > 0 && row.isRisk ? (
                        <div
                          className={cn(
                            "border-l-4 pl-3 py-1",
                            row.actionRoute.includes("Corte")
                              ? "border-orange-500 text-orange-700 dark:text-orange-400"
                              : "border-purple-500 text-purple-700 dark:text-purple-400",
                          )}
                        >
                          <p className="font-semibold leading-tight">
                            {row.actionRoute}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas de Divergência de Estoque */}
      {alertasEstoque.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-400 font-bold mb-4">
            <AlertCircle className="w-5 h-5" />
            <h3>Alerta: Divergência entre Lotes e Estoque Total</h3>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            Os seguintes produtos possuem divergência entre o somatório das
            quantidades nos lotes e o saldo em estoque no sistema.
          </p>
          <div className="overflow-x-auto rounded-xl border border-red-200 dark:border-red-800">
            <table className="w-full text-sm text-left text-red-700 dark:text-red-300">
              <thead className="text-xs uppercase bg-red-100 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Qtd em dim_produtos</th>
                  <th className="px-4 py-3">Soma dos Lotes</th>
                  <th className="px-4 py-3">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {alertasEstoque.map((a) => (
                  <tr
                    key={a.produto}
                    className="border-b border-red-100 dark:border-red-900/20 hover:bg-red-100/50 dark:hover:bg-red-900/30"
                  >
                    <td className="px-4 py-3 font-medium">{a.produto}</td>
                    <td className="px-4 py-3 font-mono">{a.qtdDimProdutos}</td>
                    <td className="px-4 py-3 font-mono">{a.qtdLotes}</td>
                    <td className="px-4 py-3 font-mono font-bold text-red-600 dark:text-red-400">
                      {Math.abs(a.qtdLotes - a.qtdDimProdutos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cadastrar Novo Lote
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Produto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalProduto}
                    onChange={(e) => {
                      setModalProduto(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    placeholder="Digite para buscar um produto..."
                  />
                  <button
                    type="button"
                    onClick={() => setIsScanning(!isScanning)}
                    className="p-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex-shrink-0"
                    title="Escanear Código de Barras"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
                {isScanning && (
                  <div className="mt-2 flex flex-col items-center gap-4">
                    <div
                      id="reader"
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center"
                    >
                      <span className="text-slate-400 text-sm">Carregando câmera...</span>
                    </div>
                    <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-3">
                      <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-2">
                        Problemas para ler? Tente tirar uma foto do código de barras:
                      </p>
                      <label className="flex items-center justify-center w-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 font-medium py-2 px-4 rounded-xl cursor-pointer transition-colors shadow-sm">
                        <Camera className="w-4 h-4 mr-2" />
                        Tirar Foto
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              try {
                                const html5QrCode = new Html5Qrcode("reader");
                                const decodedText = await html5QrCode.scanFile(e.target.files[0], true);
                                setIsScanning(false);
                                
                                const res = await fetch(`${API_BASE}/api/barcode/${decodedText}`);
                                if (res.ok) {
                                  const product = await res.json();
                                  setModalProduto(product.produto);
                                  setShowDropdown(false);
                                  setTimeout(() => {
                                    document.getElementById('validade-input')?.focus();
                                  }, 100);
                                } else {
                                  alert("Produto não encontrado para o código: " + decodedText);
                                }
                              } catch (err) {
                                console.error(err);
                                alert("Não foi possível identificar um código de barras na imagem. Tente focar bem no código.");
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {produtosDB.filter((p) =>
                      p.produto
                        .toLowerCase()
                        .includes(modalProduto.toLowerCase()),
                    ).length > 0 ? (
                      produtosDB
                        .filter((p) =>
                          p.produto
                            .toLowerCase()
                            .includes(modalProduto.toLowerCase()),
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur from firing before click
                            onClick={() => {
                              setModalProduto(p.produto);
                              setShowDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            {p.produto}
                          </button>
                        ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-slate-500">
                        Nenhum produto encontrado.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data de Validade
                </label>
                <input
                  type="date"
                  id="validade-input"
                  value={modalDataValidade}
                  onChange={(e) => setModalDataValidade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={modalQuantidade}
                  onChange={(e) => setModalQuantidade(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>

              {riskWarning && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800 dark:text-red-300">
                      <strong>Alto Risco de Vencimento!</strong><br />
                      Velocidade de vendas (VMD): {riskWarning.vmd} un/dia.<br />
                      Total no estoque passará a ser {riskWarning.novoTotal} un.<br />
                      Tempo estimado para vender tudo: <strong>{riskWarning.daysToSell} dias</strong>.<br />
                      O lote vence em <strong>{riskWarning.daysToExpiry} dias</strong>.
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarLote}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm"
              >
                Enviar lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
