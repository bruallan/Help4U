import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  DollarSign,
  Crown,
  Search,
  ArrowRight,
  PackageOpen,
  PieChart,
  Tag,
} from "lucide-react";
import { MappedRow } from "../types";
import { formatCurrency, cn } from "../utils";

interface AnaliseCestaProps {
  rawData: MappedRow[];
}

interface ProductBasketStats {
  name: string;
  totalTransactions: number;
  aloneCount: number;
  totalBasketValue: number;
  mostExpensiveCount: number;
  coOccurrences: Record<string, number>;
}

export function AnaliseCesta({ rawData }: AnaliseCestaProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const basketData = useMemo(() => {
    // Group by idCupom
    const txs = new Map<
      string,
      { total: number; products: Map<string, number> }
    >();

    for (const row of rawData) {
      if (!row.idCupom) continue;

      let tx = txs.get(row.idCupom);
      if (!tx) {
        tx = { total: 0, products: new Map() };
        txs.set(row.idCupom, tx);
      }

      tx.total += row.salePrice;
      tx.products.set(
        row.productName,
        (tx.products.get(row.productName) || 0) + row.salePrice,
      );
    }

    const stats = new Map<string, ProductBasketStats>();

    const getStats = (name: string) => {
      let s = stats.get(name);
      if (!s) {
        s = {
          name,
          totalTransactions: 0,
          aloneCount: 0,
          totalBasketValue: 0,
          mostExpensiveCount: 0,
          coOccurrences: {},
        };
        stats.set(name, s);
      }
      return s;
    };

    for (const tx of txs.values()) {
      const uniqueProducts = Array.from(tx.products.keys());
      const isAlone = uniqueProducts.length === 1;

      let maxVal = -1;
      let mostExpensiveProducts: string[] = [];

      for (const [prodName, val] of tx.products.entries()) {
        if (val > maxVal) {
          maxVal = val;
          mostExpensiveProducts = [prodName];
        } else if (val === maxVal) {
          mostExpensiveProducts.push(prodName);
        }
      }

      for (const prod of uniqueProducts) {
        const s = getStats(prod);
        s.totalTransactions += 1;
        s.totalBasketValue += tx.total;

        if (isAlone) s.aloneCount += 1;
        if (mostExpensiveProducts.includes(prod)) s.mostExpensiveCount += 1;

        for (const other of uniqueProducts) {
          if (other !== prod) {
            s.coOccurrences[other] = (s.coOccurrences[other] || 0) + 1;
          }
        }
      }
    }

    return Array.from(stats.values()).sort(
      (a, b) => b.totalTransactions - a.totalTransactions,
    );
  }, [rawData]);

  // First product selected by default if nothing is selected
  const activeProduct = selectedProduct || basketData[0]?.name || "";

  const productNames = useMemo(
    () => basketData.map((p) => p.name),
    [basketData],
  );
  const filteredProducts = productNames.filter((p) =>
    p.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedStats = basketData.find((p) => p.name === activeProduct);

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(val);
  };

  if (!selectedStats || !rawData || rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <PackageOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">
          Dados insuficientes para análise de cesta.
        </p>
      </div>
    );
  }

  const topCombinations = (
    Object.entries(selectedStats.coOccurrences) as [string, number][]
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50); // Show top 50 combinations

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[800px] max-h-[85vh]">
      {/* Sidebar: Product List */}
      <div className="w-full lg:w-1/3 xl:w-1/4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
            Selecione o Produto Base
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <div className="space-y-1">
            {filteredProducts.map((pName) => {
              const isActive = pName === activeProduct;
              return (
                <button
                  key={pName}
                  onClick={() => setSelectedProduct(pName)}
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-xl text-sm transition-all flex items-center justify-between group",
                    isActive
                      ? "bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-semibold ring-1 ring-orange-500/30"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
                  )}
                >
                  <span className="truncate pr-2">{pName}</span>
                  {isActive && (
                    <ArrowRight className="w-4 h-4 opacity-70 shrink-0" />
                  )}
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                Nenhum produto encontrado.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Stats */}
      <div className="w-full lg:w-2/3 xl:w-3/4 flex flex-col gap-6 overflow-y-auto scrollbar-thin">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm shrink-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
            {selectedStats.name}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-sm font-medium">
            <ShoppingBag className="w-4 h-4" />
            Vendido em {selectedStats.totalTransactions} transações
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors hover:border-blue-200 dark:hover:border-blue-800">
              <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                <PieChart className="w-24 h-24 text-blue-600" />
              </div>
              <div className="flex items-center gap-3 mb-3 text-slate-600 dark:text-slate-400">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                  <PieChart className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">Comprado Sozinho</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {formatPercent(
                  selectedStats.aloneCount /
                    (selectedStats.totalTransactions || 1),
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                ({selectedStats.aloneCount} compras sem outros itens)
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors hover:border-emerald-200 dark:hover:border-emerald-800">
              <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                <DollarSign className="w-24 h-24 text-emerald-600" />
              </div>
              <div className="flex items-center gap-3 mb-3 text-slate-600 dark:text-slate-400">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">
                  Ticket Médio da Cesta
                </span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {formatCurrency(
                  selectedStats.totalBasketValue /
                    (selectedStats.totalTransactions || 1),
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
                (Faturamento total destas cestas / Transações)
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors hover:border-amber-200 dark:hover:border-amber-800">
              <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                <Crown className="w-24 h-24 text-amber-600" />
              </div>
              <div className="flex items-center gap-3 mb-3 text-slate-600 dark:text-slate-400">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Crown className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">
                  Top Valor na Cesta
                </span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {formatPercent(
                  selectedStats.mostExpensiveCount /
                    (selectedStats.totalTransactions || 1),
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                (Era o item mais caro da transação)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col shrink-0 min-h-[400px]">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Mais Comprados Junto
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Chance de conversão cruzada (Co-ocorrência em{" "}
                {selectedStats.totalTransactions} vendas)
              </p>
            </div>
            <Tag className="w-5 h-5 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
            {topCombinations.length > 0 ? (
              topCombinations.map(([otherName, count], idx) => {
                const percent = count / selectedStats.totalTransactions;
                return (
                  <div
                    key={otherName}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-slate-900 dark:text-slate-200 truncate"
                        title={otherName}
                      >
                        {otherName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {count} transações em conjunto
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-32">
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {formatPercent(percent)}
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${percent * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-12 h-64 text-slate-500 dark:text-slate-400">
                <ShoppingBag className="w-10 h-10 mb-3 opacity-20" />
                <p>Nenhum outro produto foi comprado junto com este item.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
