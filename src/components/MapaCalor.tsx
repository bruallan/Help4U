import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Settings,
  Eye,
  MousePointer2,
  Plus,
  X,
  Check,
  Save,
  Edit2,
  ListPlus,
} from "lucide-react";
import { MappedRow } from "../types";
import { formatCurrency, cn } from "../utils";

interface Rect {
  id: string;
  nichoId: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage
  height: number; // percentage
  productName: string;
}

interface MarketShelfConfig {
  marketName: string;
  columns: number;
  rowsPerColumn: number;
  rects: Rect[];
}

interface MapaCalorProps {
  rawData: MappedRow[];
  availableUnits: string[];
}

type Mode = "setup" | "edit" | "view" | "manual";

function HSLToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  let rHex = Math.round((r + m) * 255).toString(16);
  let gHex = Math.round((g + m) * 255).toString(16);
  let bHex = Math.round((b + m) * 255).toString(16);

  if (rHex.length === 1) rHex = "0" + rHex;
  if (gHex.length === 1) gHex = "0" + gHex;
  if (bHex.length === 1) bHex = "0" + bHex;

  return "#" + rHex + gHex + bHex;
}

// Low = Blue (240 hue), High = Red (0 hue)
function getHeatmapColor(value: number, min: number, max: number) {
  if (max === min) return "#94a3b8"; // Slate 400 for uniform data

  // Normalize value between 0 and 1
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Hue from 240 (blue) down to 0 (red)
  const hue = 240 - normalized * 240;

  return HSLToHex(hue, 100, 50);
}

export function MapaCalor({ rawData, availableUnits }: MapaCalorProps) {
  const [selectedMarket, setSelectedMarket] = useState<string>(
    availableUnits[0] || "",
  );
  const [configs, setConfigs] = useState<Record<string, MarketShelfConfig>>({});

  const [mode, setMode] = useState<Mode>("setup");
  const [metric, setMetric] = useState<"volume" | "faturamento" | "margem">(
    "volume",
  );

  // Setup state
  const [setupColumns, setSetupColumns] = useState(5);
  const [setupRows, setSetupRows] = useState(5);

  // Manual insertion state
  const [manualProduct, setManualProduct] = useState("");
  const [manualShelf, setManualShelf] = useState(1);
  const [manualNiche, setManualNiche] = useState(1);
  const [manualCols, setManualCols] = useState(1);
  const [manualHPos, setManualHPos] = useState(1); // 1 to manualCols
  const [manualVPos, setManualVPos] = useState<"full" | "top" | "bottom">(
    "full",
  );

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{
    x: number;
    y: number;
    nichoId: string;
  } | null>(null);
  const [currentRect, setCurrentRect] = useState<Partial<Rect> | null>(null);
  const [drawingNichoRef, setDrawingNichoRef] = useState<HTMLElement | null>(
    null,
  );
  const [hoveredRectInfo, setHoveredRectInfo] = useState<{
    rect: Rect;
    x: number;
    y: number;
  } | null>(null);

  // Product selection modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const currentConfig = configs[selectedMarket] || {
    marketName: selectedMarket,
    columns: setupColumns,
    rowsPerColumn: setupRows,
    rects: [],
  };

  const uniqueProducts = useMemo(() => {
    const prods = new Set<string>();
    rawData.forEach((r) => prods.add(r.productName));
    return Array.from(prods).sort();
  }, [rawData]);

  const productStats = useMemo(() => {
    const stats: Record<
      string,
      { volume: number; faturamento: number; margem: number }
    > = {};

    rawData.forEach((row) => {
      if (row.client !== selectedMarket) return;

      if (!stats[row.productName]) {
        stats[row.productName] = { volume: 0, faturamento: 0, margem: 0 };
      }
      stats[row.productName].volume += 1;
      stats[row.productName].faturamento += row.salePrice;
      stats[row.productName].margem += row.salePrice - row.costPrice;
    });

    return stats;
  }, [rawData, selectedMarket]);

  const metricBounds = useMemo(() => {
    const values = Object.values(productStats).map((p) => p[metric]);
    if (values.length === 0) return { min: 0, max: 1 };

    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      if (max === 0) {
        max = 1;
      } else {
        min = 0;
      }
    }

    return { min, max };
  }, [productStats, metric]);

  const handleStartSetup = () => {
    if (!configs[selectedMarket]) {
      setConfigs((prev) => ({
        ...prev,
        [selectedMarket]: {
          marketName: selectedMarket,
          columns: setupColumns,
          rowsPerColumn: setupRows,
          rects: [],
        },
      }));
    }
    setMode("edit");
  };

  const SNAP_THRESHOLD = 5; // percentage

  const handleMouseDown = (e: React.MouseEvent, nichoId: string) => {
    if (mode !== "edit" || showProductModal) return;

    // Don't start drawing if clicking on an existing rect or delete button
    if ((e.target as HTMLElement).closest(".product-rect")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Snapping logic for start
    const existingRects = currentConfig.rects.filter(
      (r) => r.nichoId === nichoId,
    );
    const hSnaps = [
      0,
      100,
      ...existingRects.flatMap((r) => [r.x, r.x + r.width]),
    ];
    const vSnaps = [
      0,
      100,
      ...existingRects.flatMap((r) => [r.y, r.y + r.height]),
    ];

    const snapValue = (val: number, snaps: number[]) => {
      let closest = val;
      let minDiff = SNAP_THRESHOLD;
      for (const snap of snaps) {
        if (Math.abs(val - snap) < minDiff) {
          closest = snap;
          minDiff = Math.abs(val - snap);
        }
      }
      return closest;
    };

    x = snapValue(x, hSnaps);
    y = snapValue(y, vSnaps);

    setIsDrawing(true);
    setDrawStart({ x, y, nichoId });
    setDrawingNichoRef(e.currentTarget as HTMLElement);
    setCurrentRect({
      nichoId,
      x,
      y,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || !currentRect || !drawingNichoRef) return;
    if (drawStart.nichoId !== currentRect.nichoId) return;

    const rect = drawingNichoRef.getBoundingClientRect();
    let currentX = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    let currentY = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
    );

    // Snapping logic for end
    const existingRects = currentConfig.rects.filter(
      (r) => r.nichoId === currentRect.nichoId,
    );
    const hSnaps = [
      0,
      100,
      ...existingRects.flatMap((r) => [r.x, r.x + r.width]),
    ];
    const vSnaps = [
      0,
      100,
      ...existingRects.flatMap((r) => [r.y, r.y + r.height]),
    ];

    const snapValue = (val: number, snaps: number[]) => {
      let closest = val;
      let minDiff = SNAP_THRESHOLD;
      for (const snap of snaps) {
        if (Math.abs(val - snap) < minDiff) {
          closest = snap;
          minDiff = Math.abs(val - snap);
        }
      }
      return closest;
    };

    currentX = snapValue(currentX, hSnaps);
    currentY = snapValue(currentY, vSnaps);

    setCurrentRect({
      ...currentRect,
      x: Math.min(drawStart.x, currentX),
      y: Math.min(drawStart.y, currentY),
      width: Math.abs(currentX - drawStart.x),
      height: Math.abs(currentY - drawStart.y),
    });
  };

  const handleMouseUp = () => {
    if (
      !isDrawing ||
      !currentRect ||
      currentRect.width! < 2 ||
      currentRect.height! < 2
    ) {
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentRect(null);
      return;
    }

    setIsDrawing(false);
    setShowProductModal(true);
  };

  // Attach global mouseup to cancel drawing if released outside
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        handleMouseUp();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDrawing, handleMouseUp]);

  const confirmProductMapping = (productName: string) => {
    if (!currentRect) return;

    const newRect: Rect = {
      id: Math.random().toString(36).substring(2, 9),
      nichoId: currentRect.nichoId!,
      x: currentRect.x!,
      y: currentRect.y!,
      width: currentRect.width!,
      height: currentRect.height!,
      productName,
    };

    setConfigs((prev) => ({
      ...prev,
      [selectedMarket]: {
        ...prev[selectedMarket],
        rects: [...prev[selectedMarket].rects, newRect],
      },
    }));

    setShowProductModal(false);
    setCurrentRect(null);
    setProductSearch("");
  };

  const removeRect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfigs((prev) => ({
      ...prev,
      [selectedMarket]: {
        ...prev[selectedMarket],
        rects: prev[selectedMarket].rects.filter((r) => r.id !== id),
      },
    }));
  };

  const handleManualAdd = () => {
    if (!manualProduct) {
      alert("Selecione um produto.");
      return;
    }

    const nichoId = `col-${manualShelf - 1}-row-${manualNiche - 1}`;
    const width = 100 / manualCols;
    const x = (manualHPos - 1) * width;

    let y = 0;
    let height = 100;
    if (manualVPos === "top") {
      height = 50;
      y = 0;
    } else if (manualVPos === "bottom") {
      height = 50;
      y = 50;
    }

    const newRect: Rect = {
      id: Math.random().toString(36).substring(2, 9),
      nichoId,
      x,
      y,
      width,
      height,
      productName: manualProduct,
    };

    setConfigs((prev) => ({
      ...prev,
      [selectedMarket]: {
        ...prev[selectedMarket],
        rects: [...prev[selectedMarket].rects, newRect],
      },
    }));

    setManualProduct("");
  };

  const renderShelves = () => {
    const cols = Array.from({ length: currentConfig.columns });
    const rows = Array.from({ length: currentConfig.rowsPerColumn });

    return (
      <div
        className="flex gap-4 w-full h-[800px] overflow-x-auto select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setDrawStart(null);
            setCurrentRect(null);
          }
        }}
      >
        {cols.map((_, colIndex) => (
          <div
            key={colIndex}
            className="flex-1 flex flex-col border-4 border-slate-800 dark:border-slate-300 rounded-sm bg-slate-50 dark:bg-slate-900 min-w-[200px]"
          >
            <div className="text-center font-bold py-2 border-b-4 border-slate-800 dark:border-slate-300 text-slate-800 dark:text-slate-200">
              PRATELEIRA {colIndex + 1}
            </div>
            <div className="flex-1 flex flex-col p-2 gap-2">
              {rows.map((_, rowIndex) => {
                const nichoId = `col-${colIndex}-row-${rowIndex}`;
                const rectsForNicho = currentConfig.rects.filter(
                  (r) => r.nichoId === nichoId,
                );

                return (
                  <div
                    key={rowIndex}
                    className="flex-1 border-2 border-slate-600 dark:border-slate-500 bg-white dark:bg-slate-800 relative group cursor-crosshair overflow-hidden"
                    onMouseDown={(e) => handleMouseDown(e, nichoId)}
                  >
                    {/* Render saved rects */}
                    {rectsForNicho.map((rect) => {
                      const stat = productStats[rect.productName];
                      const statVal = stat ? stat[metric] : 0;
                      const heatColor =
                        mode === "view"
                          ? getHeatmapColor(
                              statVal,
                              metricBounds.min,
                              metricBounds.max,
                            )
                          : "#cbd5e1";

                      return (
                        <div
                          key={rect.id}
                          className="product-rect absolute border-2 flex items-center justify-center p-1 overflow-hidden transition-colors cursor-pointer hover:z-10"
                          onMouseEnter={(e) =>
                            setHoveredRectInfo({
                              rect,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                          onMouseMove={(e) =>
                            setHoveredRectInfo({
                              rect,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                          onMouseLeave={() => setHoveredRectInfo(null)}
                          style={{
                            left: `${rect.x}%`,
                            top: `${rect.y}%`,
                            width: `${rect.width}%`,
                            height: `${rect.height}%`,
                            backgroundColor:
                              mode === "view"
                                ? heatColor
                                : "rgba(217, 119, 6, 0.2)",
                            borderColor:
                              mode === "view" ? "#00000033" : "#d97706",
                            color: mode === "view" ? "#fff" : "inherit",
                            textShadow:
                              mode === "view"
                                ? "0px 1px 2px rgba(0,0,0,0.8)"
                                : "none",
                          }}
                        >
                          <span className="text-[10px] sm:text-xs font-bold leading-tight text-center break-words w-full dark:text-slate-900">
                            {rect.productName}
                          </span>

                          {mode === "edit" && (
                            <button
                              onClick={(e) => removeRect(rect.id, e)}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-600 z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Render currently drawing rect */}
                    {isDrawing && currentRect?.nichoId === nichoId && (
                      <div
                        className="absolute border-2 border-dashed border-orange-500 bg-orange-500/20 pointer-events-none"
                        style={{
                          left: `${currentRect.x}%`,
                          top: `${currentRect.y}%`,
                          width: `${currentRect.width}%`,
                          height: `${currentRect.height}%`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 fade-in h-[900px] max-h-[90vh]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Mapa de Calor da Gôndola</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure as prateleiras e visualize as zonas mais "quentes" de
            venda ou lucratividade.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selectedMarket}
            onChange={(e) => {
              setSelectedMarket(e.target.value);
              setMode(configs[e.target.value] ? "view" : "setup");
            }}
            className="px-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {availableUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>

          {configs[selectedMarket] ? (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setMode("edit")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  mode === "edit"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                <Edit2 className="w-4 h-4" /> Visual
              </button>
              <button
                onClick={() => setMode("manual")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  mode === "manual"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                <ListPlus className="w-4 h-4" /> Manual
              </button>
              <button
                onClick={() => setMode("view")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  mode === "view"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                <Eye className="w-4 h-4" /> Visualização
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col relative">
        {mode === "setup" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto w-full text-center">
            <Settings className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Configurar Layout Inicial
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Defina a quantidade de prateleiras (colunas) e quantos nichos
              (linhas) cada prateleira possui neste mercado para iniciar o
              desenho.
            </p>

            <div className="w-full space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Qtd. de Prateleiras (Colunas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={setupColumns}
                  onChange={(e) => setSetupColumns(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Qtd. de Nichos por Prateleira (Linhas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={setupRows}
                  onChange={(e) => setSetupRows(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <button
                onClick={handleStartSetup}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-medium transition"
              >
                <Check className="w-5 h-5" /> Iniciar Desenho
              </button>
            </div>
          </div>
        )}

        {mode === "edit" && configs[selectedMarket] && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-xl border border-blue-200 dark:border-blue-800/50">
              <MousePointer2 className="w-5 h-5 opacity-70" />
              <p className="text-sm font-medium">
                Instruções: Para registrar a posição de um produto, clique num
                nicho em branco abaixo, segure e arraste o mouse para formar o
                retângulo do espaço dele.
              </p>
            </div>

            {renderShelves()}
          </div>
        )}

        {mode === "manual" && configs[selectedMarket] && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden md:flex-row gap-6">
            <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListPlus className="w-5 h-5" /> Inserção Manual
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Produto
                </label>
                <select
                  value={manualProduct}
                  onChange={(e) => setManualProduct(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="">Selecione...</option>
                  {uniqueProducts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Prateleira
                  </label>
                  <select
                    value={manualShelf}
                    onChange={(e) => setManualShelf(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  >
                    {Array.from({ length: currentConfig.columns }).map(
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          Coluna {i + 1}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nicho (Linha)
                  </label>
                  <select
                    value={manualNiche}
                    onChange={(e) => setManualNiche(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  >
                    {Array.from({ length: currentConfig.rowsPerColumn }).map(
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          Linha {i + 1}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Divisões Horizontais (Qtd. Produtos)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={manualCols}
                  onChange={(e) => {
                    const c = Number(e.target.value) || 1;
                    setManualCols(c);
                    if (manualHPos > c) setManualHPos(c);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Posição (esq para dir)
                </label>
                <select
                  value={manualHPos}
                  onChange={(e) => setManualHPos(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                >
                  {Array.from({ length: manualCols }).map((_, i) => (
                    <option key={i} value={i + 1}>
                      Posição {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Empilhamento (Altura)
                </label>
                <select
                  value={manualVPos}
                  onChange={(e) => setManualVPos(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                >
                  <option value="full">Ocupa do Topo à Base (Inteiro)</option>
                  <option value="top">Metade de Cima (Topo)</option>
                  <option value="bottom">Metade de Baixo (Base)</option>
                </select>
              </div>

              <button
                onClick={handleManualAdd}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-medium transition"
              >
                <Plus className="w-5 h-5" /> Adicionar Produto
              </button>
            </div>

            <div className="flex-1 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col p-4 relative">
              <div className="absolute inset-0 pointer-events-none z-10" />
              <div className="flex-1 opacity-75">{renderShelves()}</div>
            </div>
          </div>
        )}

        {mode === "view" && configs[selectedMarket] && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Métrica do Mapa de Calor:
                </span>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg text-sm border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="volume">Volume Físico de Vendas (Qtd)</option>
                  <option value="faturamento">Faturamento (R$)</option>
                  <option value="margem">Margem Líquida ($)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium dark:text-slate-300">
                <span>Frio (Menor)</span>
                <div className="w-24 h-3 rounded bg-gradient-to-r from-blue-600 to-red-600" />
                <span>Quente (Maior)</span>
              </div>
            </div>

            {renderShelves()}
          </div>
        )}

        {/* Floating Tooltip */}
        {hoveredRectInfo && (
          <div
            className="fixed z-[100] bg-slate-900 border border-slate-700 text-white shadow-xl rounded-xl p-3 text-sm pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+16px)]"
            style={{ left: hoveredRectInfo.x, top: hoveredRectInfo.y }}
          >
            <div className="font-bold text-orange-400 mb-2 border-b border-white/20 pb-1">
              {hoveredRectInfo.rect.productName}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
              <span>Volume:</span>
              <span className="font-medium text-white text-right">
                {productStats[hoveredRectInfo.rect.productName]?.volume || 0}{" "}
                unid.
              </span>

              <span>Faturamento:</span>
              <span className="font-medium text-white text-right">
                {formatCurrency(
                  productStats[hoveredRectInfo.rect.productName]?.faturamento ||
                    0,
                )}
              </span>

              <span>Margem:</span>
              <span className="font-medium text-white text-right">
                {formatCurrency(
                  productStats[hoveredRectInfo.rect.productName]?.margem || 0,
                )}
              </span>
            </div>
          </div>
        )}

        {/* Product Assignment Modal */}
        {showProductModal && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Vincular Produto ao Espaço
                </h3>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setCurrentRect(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
                <input
                  type="text"
                  placeholder="Pesquisar produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {uniqueProducts
                    .filter((p) =>
                      p.toLowerCase().includes(productSearch.toLowerCase()),
                    )
                    .slice(0, 100) // limit for performance
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => confirmProductMapping(p)}
                        className="w-full text-left px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
