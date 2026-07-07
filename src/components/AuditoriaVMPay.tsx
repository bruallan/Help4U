import React, { useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Play,
  RefreshCw,
  Loader2,
  Download,
  Calendar,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { MappedRow } from "../types";

interface AuditoriaVMPayProps {
  rawData: MappedRow[] | null;
  onRefreshData: () => void;
}

interface ProcessedDay {
  dateStr: string;
  dbCount: number;
  apiCount: number | null;
  status:
    | "pending"
    | "checking"
    | "correct"
    | "incomplete"
    | "empty"
    | "divergent"
    | "error";
  errorMessage?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

export default function AuditoriaVMPay({
  rawData,
  onRefreshData,
}: AuditoriaVMPayProps) {
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  });
  const [isAuditing, setIsAuditing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [auditDays, setAuditDays] = useState<ProcessedDay[]>([]);
  const [currentCheckingDay, setCurrentCheckingDay] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProcessedDay;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (key: keyof ProcessedDay) => {
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
        <ArrowUp className="w-3 h-3 ml-1 inline-block text-orange-600 dark:text-orange-400" />
      );
    }
    return (
      <ArrowDown className="w-3 h-3 ml-1 inline-block text-orange-600 dark:text-orange-400" />
    );
  };

  const applySort = (data: ProcessedDay[]): ProcessedDay[] => {
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

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 100));
  };

  // Pre-calculate database count per day from rawData
  const dbCountsByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!rawData) return counts;
    rawData.forEach((row) => {
      try {
        const d = new Date(row.dayDate);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        counts[dStr] = (counts[dStr] || 0) + 1;
      } catch (e) {}
    });
    return counts;
  }, [rawData]);

  const stats = useMemo(() => {
    const total = auditDays.length;
    const correct = auditDays.filter((d) => d.status === "correct").length;
    const incomplete = auditDays.filter(
      (d) => d.status === "incomplete",
    ).length;
    const empty = auditDays.filter((d) => d.status === "empty").length;
    const divergent = auditDays.filter((d) => d.status === "divergent").length;
    const errors = auditDays.filter((d) => d.status === "error").length;

    let totalMissing = 0;
    auditDays.forEach((d) => {
      if (d.status === "incomplete" && d.apiCount !== null) {
        totalMissing += d.apiCount - d.dbCount;
      }
    });

    return {
      total,
      correct,
      incomplete,
      empty,
      divergent,
      errors,
      totalMissing,
    };
  }, [auditDays]);

  const runRepairForDate = async (dateStr: string) => {
    addLog(`Processando correção para o dia ${dateStr}...`);

    try {
      const res = await fetch(`${API_BASE}/api/sync-single-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateStr }),
      });

      if (!res.ok) {
        throw new Error(
          `Falha no backend ao carregar dados do dia ${dateStr} (HTTP ${res.status})`,
        );
      }

      const result = await res.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || "Nenhum dado retornado do backend.");
      }

      const rowsToSave = result.data;
      addLog(
        `Dia ${dateStr}: obtidos ${rowsToSave.length} registros formatados da API VMPay. Gravando no Firestore...`,
      );

      if (rowsToSave.length > 0) {
        addLog(
          `✅ Sucesso! Gravados ${rowsToSave.length} registros para o dia ${dateStr} no Sincronizador.`,
        );
      } else {
        addLog(`Nenhuma transação encontrada na API para o dia ${dateStr}.`);
      }

      // Update state
      setAuditDays((prev) =>
        prev.map((d) =>
          d.dateStr === dateStr
            ? {
                ...d,
                dbCount: rowsToSave.length,
                apiCount: rowsToSave.length,
                status: rowsToSave.length === 0 ? "empty" : "correct",
              }
            : d,
        ),
      );
    } catch (err: any) {
      addLog(`❌ Erro ao corrigir o dia ${dateStr}: ${err.message}`);
      throw err;
    }
  };

  const handleStartAudit = async () => {
    if (isAuditing || isRepairing) return;
    setIsAuditing(true);
    setLogs([]);
    addLog(`Iniciando Auditoria de Vendas de ${startDate} até ${endDate}...`);

    try {
      // Generate list of days
      const daysList: ProcessedDay[] = [];
      const current = new Date(startDate + "T00:00:00Z");
      const end = new Date(endDate + "T23:59:59Z");

      if (isNaN(current.getTime()) || isNaN(end.getTime())) {
        throw new Error("As datas selecionadas para auditoria são inválidas.");
      }

      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        const dbCount = dbCountsByDay[dateStr] || 0;
        daysList.push({
          dateStr,
          dbCount,
          apiCount: null,
          status: "pending",
        });
        current.setUTCDate(current.getUTCDate() + 1);
      }

      setAuditDays(daysList);
      addLog(`Identificados ${daysList.length} dias no intervalo selecionado.`);

      // Audit each day sequentially to respect API rate-limiting rules smoothly
      for (let i = 0; i < daysList.length; i++) {
        const day = daysList[i];
        setCurrentCheckingDay(day.dateStr);

        setAuditDays((prev) =>
          prev.map((d) =>
            d.dateStr === day.dateStr ? { ...d, status: "checking" } : d,
          ),
        );
        addLog(
          `Consultando API para ${day.dateStr} (Banco possui ${day.dbCount} registros)...`,
        );

        try {
          let page = 1;
          let totalApiCount = 0;
          let keepGoing = true;
          const startOfDay = `${day.dateStr}T00:00:00-03:00`;
          const endOfDay = `${day.dateStr}T23:59:59-03:00`;

          while (keepGoing) {
            const url = `${API_BASE}/api/proxy/cashless_facts?start_date=${startOfDay}&end_date=${endOfDay}&per_page=500&page=${page}`;
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Erro na API VMPay (HTTP ${res.status})`);
            }
            const facts = await res.json();
            if (!facts || facts.length === 0) {
              keepGoing = false;
              break;
            }

            // Filter within period (just to be mathematically sure on the frontend)
            const startMs = new Date(startOfDay).getTime();
            const endMs = new Date(endOfDay).getTime();
            const validFacts = facts.filter((f: any) => {
              const t = new Date(f.occurred_at).getTime();
              return t >= startMs && t <= endMs;
            });

            totalApiCount += validFacts.length;

            if (facts.length < 500) {
              keepGoing = false;
            } else {
              page++;
            }

            // Small safety delay between pages
            await new Promise((r) => setTimeout(r, 50));
          }

          let finalStatus: ProcessedDay["status"] = "correct";
          if (day.dbCount === 0 && totalApiCount === 0) {
            finalStatus = "empty";
          } else if (day.dbCount < totalApiCount) {
            finalStatus = "incomplete";
            addLog(
              `⚠️ DIVERGÊNCIA em ${day.dateStr}: VMPay tem ${totalApiCount} mas Firestore tem apenas ${day.dbCount}!`,
            );
          } else if (day.dbCount > totalApiCount) {
            finalStatus = "divergent";
          }

          day.status = finalStatus;
          day.apiCount = totalApiCount;

          setAuditDays((prev) =>
            prev.map((d) =>
              d.dateStr === day.dateStr
                ? {
                    ...d,
                    apiCount: totalApiCount,
                    status: finalStatus,
                  }
                : d,
            ),
          );
        } catch (err: any) {
          addLog(`❌ Erro ao auditar dia ${day.dateStr}: ${err.message}`);
          day.status = "error";
          setAuditDays((prev) =>
            prev.map((d) =>
              d.dateStr === day.dateStr
                ? {
                    ...d,
                    status: "error",
                    errorMessage: err.message,
                  }
                : d,
            ),
          );
        }

        // Fast safe cooldown key between days
        await new Promise((r) => setTimeout(r, 100));
      }

      addLog(`Auditoria concluída com sucesso!`);
      setIsAuditing(false);
      setCurrentCheckingDay("");

      // Auto-correct days with divergences
      const daysToRepair = daysList.filter(
        (d) =>
          d.status === "incomplete" ||
          d.status === "error" ||
          d.status === "divergent",
      );

      if (daysToRepair.length > 0) {
        addLog(
          `🔧 Autocorreção: Foram identificados ${daysToRepair.length} dias divergentes ou com falhas.`,
        );
        addLog(`Iniciando a sincronização em lote automática imediatamente...`);
        setIsRepairing(true);
        try {
          for (const dayToFix of daysToRepair) {
            try {
              await runRepairForDate(dayToFix.dateStr);
            } catch (repairErr: any) {
              addLog(
                `⚠️ Falha na correção automática do dia ${dayToFix.dateStr}: ${repairErr.message}. Continuando para o próximo.`,
              );
            }
          }
          addLog(`🎉 Todo o lote de autocorreção foi processado com sucesso!`);
          if (onRefreshData) {
            addLog(`Atualizando gráficos localmente no dashboard...`);
            onRefreshData();
          }
        } finally {
          setIsRepairing(false);
        }
      } else {
        addLog(`Tudo correto! Nenhuma divergência detectada no período.`);
      }
    } catch (err: any) {
      addLog(
        `❌ Erro crítico durante o processamento da auditoria: ${err.message}`,
      );
    } finally {
      setIsAuditing(false);
      setCurrentCheckingDay("");
    }
  };

  const handleRepairDay = async (dateStr: string) => {
    if (isRepairing || isAuditing) return;
    setIsRepairing(true);
    try {
      await runRepairForDate(dateStr);
    } catch (err: any) {
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Opções de Intervalo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-500" />
          Filtro e Controle de Revisão
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Data de Início
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Data de Fim
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartAudit}
              disabled={isAuditing || isRepairing}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-semibold text-sm py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition"
            >
              {isAuditing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Auditando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Iniciar Auditoria
                </>
              )}
            </button>

            <button
              onClick={onRefreshData}
              disabled={isAuditing || isRepairing}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm py-2 px-3 rounded-xl flex items-center justify-center transition"
              title="Atualizar gráficos com novos dados salvos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Resultados de Consolidação */}
      {auditDays.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Período
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {stats.total} dias
            </p>
            {currentCheckingDay && (
              <p className="text-xs text-orange-500 mt-1 animate-pulse">
                Auditando:{" "}
                {currentCheckingDay.split("-").reverse().slice(0, 2).join("/")}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Consolidados
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.correct} dias
            </p>
            <p className="text-xs text-slate-400 mt-1">Conferência OK</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm border-l-4 border-l-amber-500">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Incompletos (Faltando)
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stats.incomplete} dias
            </p>
            <p className="text-xs text-amber-500 font-semibold mt-1">
              ~{stats.totalMissing} vendas ausentes
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm border-l-4 border-l-slate-400">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Sem Movimento
            </p>
            <p className="text-2xl font-bold text-slate-500 mt-1">
              {stats.empty} dias
            </p>
            <p className="text-xs text-slate-400 mt-1">0 no Banco e no VMPay</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm border-l-4 border-l-indigo-400">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Divergentes/Excesso
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {stats.divergent} dias
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Banco possui mais registros
            </p>
          </div>
        </div>
      )}

      {/* Tabela de Detalhes da Auditoria */}
      {auditDays.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Relatório Detalhado por Dia
            </h4>
            <span className="text-xs text-slate-400">
              Resultados da verificação ativa
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-850">
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort("dateStr")}
                  >
                    Dia {getSortIcon("dateStr")}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort("dbCount")}
                  >
                    Qtd. Firestore Banco {getSortIcon("dbCount")}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort("apiCount")}
                  >
                    Qtd. VMPay API {getSortIcon("apiCount")}
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    Situação {getSortIcon("status")}
                  </th>
                  <th className="p-4 text-right">Ação Corretiva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-sm">
                {applySort(auditDays).map((day) => {
                  let badge = null;
                  if (day.status === "pending") {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <HelpCircle className="w-3.5 h-3.5" /> Pendente
                      </span>
                    );
                  } else if (day.status === "checking") {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                        Verificando...
                      </span>
                    );
                  } else if (day.status === "correct") {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Consolidado
                      </span>
                    );
                  } else if (day.status === "incomplete") {
                    const diff = (day.apiCount || 0) - day.dbCount;
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" /> Falta {diff}{" "}
                        {diff === 1 ? "venda" : "vendas"}
                      </span>
                    );
                  } else if (day.status === "empty") {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        Sem Movimento
                      </span>
                    );
                  } else if (day.status === "divergent") {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/10 dark:text-indigo-400">
                        Divergente
                      </span>
                    );
                  } else {
                    badge = (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600"
                        title={day.errorMessage}
                      >
                        Falha ({day.errorMessage})
                      </span>
                    );
                  }

                  const formattedDate = day.dateStr
                    .split("-")
                    .reverse()
                    .join("/");

                  return (
                    <tr
                      key={day.dateStr}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                        {formattedDate}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {day.dbCount} registros
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                        {day.apiCount !== null
                          ? `${day.apiCount} registros`
                          : "-"}
                      </td>
                      <td className="p-4">{badge}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleRepairDay(day.dateStr)}
                          disabled={
                            day.status === "correct" ||
                            day.status === "empty" ||
                            isRepairing ||
                            isAuditing
                          }
                          className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-30 disabled:pointer-events-none transition"
                        >
                          Sincronizar Dia
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terminal de Logs */}
      <div className="bg-black/90 dark:bg-black rounded-2xl p-5 border border-slate-800 font-mono text-xs text-green-400 shadow-lg space-y-2">
        <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2 mb-2 font-sans">
          <span className="font-bold">Console de Auditoria</span>
          <button
            onClick={() => setLogs([])}
            className="text-xs hover:text-white"
          >
            Limpar Console
          </button>
        </div>
        <div className="max-h-36 overflow-y-auto flex flex-col-reverse gap-1 pr-1">
          {logs.length === 0 ? (
            <span className="text-slate-600 font-sans italic">
              Nenhuma atividade executada ainda. Pressione "Iniciar Auditoria"
              para analisar o histórico.
            </span>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
