import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, Download, Search, CheckSquare, Square, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '../utils';

interface Product {
  codigo: string;
  nome: string;
  precoCusto: number;
}

interface Market {
  name: string;
  productCodes: Set<string>;
}

interface MappingInfo {
  prodHeaderRow: number;
  prodNomeCol: string;
  prodCodCol: string;
  prodCustoCol: string;
  planHeaderRow: number;
  planCodCol: string;
}

const getColLetter = (index: number) => {
  if (index < 0) return 'N/A';
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

interface MissingProductRow {
  mercado: string;
  codigo: string;
  produto: string;
  precoCusto: number;
  precoSugerido: number;
  margem20: number;
  margem27: number;
}

export function PosEstocagem() {
  const [produtosFile, setProdutosFile] = useState<File | null>(null);
  const [planogramasFile, setPlanogramasFile] = useState<File | null>(null);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [marketsList, setMarketsList] = useState<Market[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mappingInfo, setMappingInfo] = useState<MappingInfo | null>(null);
  const [ignoredItems, setIgnoredItems] = useState<Set<string>>(new Set());

  const handleProdutosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProdutosFile(e.target.files[0]);
    }
  };

  const handlePlanogramasUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPlanogramasFile(e.target.files[0]);
    }
  };

  const parseExcelFiles = async () => {
    if (!produtosFile || !planogramasFile) return;

    setIsProcessing(true);
    try {
      // Parse Produtos
      const prodData = await produtosFile.arrayBuffer();
      const prodWorkbook = XLSX.read(prodData, { type: 'array' });
      const prodSheet = prodWorkbook.Sheets[prodWorkbook.SheetNames[0]];
      const prodJson: any[][] = XLSX.utils.sheet_to_json(prodSheet, { header: 1 });

      let pHeaderRow = -1;
      let pCodCol = -1;
      let pNomeCol = -1;
      let pCustoCol = -1;

      for (let i = 0; i < Math.min(prodJson.length, 50); i++) {
        const row = prodJson[i];
        if (!row) continue;
        const rowStr = row.map(c => String(c).toLowerCase()).join('|');
        if (rowStr.includes('código') && rowStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('custo')) {
          pHeaderRow = i;
          pCodCol = row.findIndex(c => c && String(c).toLowerCase().trim() === 'código');
          pNomeCol = row.findIndex(c => c && String(c).toLowerCase().trim() === 'nome');
          pCustoCol = row.findIndex(c => c && String(c).toLowerCase().includes('custo atual'));
          if (pCustoCol === -1) {
            pCustoCol = row.findIndex(c => c && String(c).toLowerCase().includes('preço de custo'));
          }
          if (pCustoCol === -1) {
            pCustoCol = row.findIndex(c => c && String(c).toLowerCase().includes('custo'));
          }
          break;
        }
      }

      const products: Product[] = [];
      if (pHeaderRow !== -1) {
        for (let i = pHeaderRow + 1; i < prodJson.length; i++) {
          const row = prodJson[i];
          if (!row || row.length === 0) continue;

          const codigo = String(row[pCodCol] ?? '').trim();
          const nome = String(row[pNomeCol] ?? '').trim();
          let custoRaw = row[pCustoCol];

          if (codigo && nome) {
            let precoCusto = 0;
            if (typeof custoRaw === 'number') {
              precoCusto = custoRaw;
            } else if (typeof custoRaw === 'string') {
              let clean = custoRaw.replace('R$', '').trim();
              if (clean.includes(',') && clean.includes('.')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
              } else if (clean.includes(',')) {
                clean = clean.replace(',', '.');
              }
              precoCusto = parseFloat(clean) || 0;
            }
            products.push({ codigo, nome, precoCusto });
          }
        }
      }

      // Parse Planogramas
      const planData = await planogramasFile.arrayBuffer();
      const planWorkbook = XLSX.read(planData, { type: 'array' });
      const markets: Market[] = [];
      let globalPlanHeader = -1;
      let globalPlanCod = -1;

      for (const sheetName of planWorkbook.SheetNames) {
        if (sheetName.toLowerCase() === 'resumo') continue;

        const sheet = planWorkbook.Sheets[sheetName];
        const planJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let planHeaderRow = -1;
        let planCodCol = -1;

        for (let i = 0; i < Math.min(planJson.length, 30); i++) {
          const row = planJson[i];
          if (!row) continue;
          
          const rowTitles = row.map(c => String(c).toLowerCase().trim());
          planCodCol = rowTitles.findIndex(c => c === 'código');
          if (planCodCol !== -1) {
            planHeaderRow = i;
            if (globalPlanHeader === -1) {
              globalPlanHeader = i;
              globalPlanCod = planCodCol;
            }
            break;
          }
        }

        const codes = new Set<string>();
        if (planHeaderRow !== -1) {
          for (let i = planHeaderRow + 1; i < planJson.length; i++) {
            const row = planJson[i];
            const rawCodigo = row?.[planCodCol];
            if (rawCodigo !== undefined && rawCodigo !== null && String(rawCodigo).trim() !== '') {
              // Extract the base code (sometimes formats might differ)
              codes.add(String(rawCodigo).trim());
            }
          }
        }

        markets.push({ name: sheetName, productCodes: codes });
      }

      setProductsList(products);
      setMarketsList(markets);
      setSelectedMarkets(new Set(markets.map(m => m.name)));

      setMappingInfo({
        prodHeaderRow: pHeaderRow + 1,
        prodNomeCol: getColLetter(pNomeCol),
        prodCodCol: getColLetter(pCodCol),
        prodCustoCol: getColLetter(pCustoCol),
        planHeaderRow: globalPlanHeader + 1,
        planCodCol: getColLetter(globalPlanCod)
      });

    } catch (error) {
      console.error("Erro ao processar as planilhas:", error);
      alert("Houve um erro ao processar as planilhas. Verifique se o formato está correto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const missingProductsData: MissingProductRow[] = useMemo(() => {
    const data: MissingProductRow[] = [];
    
    // Sort selected markets conceptually or iteration is fine
    const activeMarkets = marketsList.filter(m => selectedMarkets.has(m.name));

    for (const market of activeMarkets) {
      for (const prod of productsList) {
        if (!market.productCodes.has(prod.codigo)) {
          
          const cost = prod.precoCusto;
          const exactSuggestedPrice = cost / 0.58;
          // Arredondar para o número que termine em 9 seguinte
          // Math.ceil(exactSuggestedPrice * 10) / 10 - 0.01
          const suggestedPrice = Math.max(0, parseFloat((Math.ceil(exactSuggestedPrice * 10) / 10 - 0.01).toFixed(2)));

          let margem20 = 0;
          let margem27 = 0;

          if (suggestedPrice > 0) {
            margem20 = 1 - (cost / suggestedPrice) - 0.20;
            margem27 = 1 - (cost / suggestedPrice) - 0.27;
          }

          data.push({
            mercado: market.name,
            codigo: prod.codigo,
            produto: prod.nome,
            precoCusto: cost,
            precoSugerido: suggestedPrice,
            margem20: margem20,
            margem27: margem27
          });
        }
      }
    }

    return data;
  }, [marketsList, productsList, selectedMarkets]);

  const visibleProducts = useMemo(() => {
    return missingProductsData.filter(row => !ignoredItems.has(`${row.mercado}|${row.codigo}`));
  }, [missingProductsData, ignoredItems]);

  const toggleIgnore = (mercado: string, codigo: string) => {
    const key = `${mercado}|${codigo}`;
    const next = new Set(ignoredItems);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setIgnoredItems(next);
  };

  const clearIgnored = () => setIgnoredItems(new Set());

  const toggleMarket = (marketName: string) => {
    const next = new Set(selectedMarkets);
    if (next.has(marketName)) {
      next.delete(marketName);
    } else {
      next.add(marketName);
    }
    setSelectedMarkets(next);
  };

  const toggleAllMarkets = () => {
    if (selectedMarkets.size === marketsList.length) {
      setSelectedMarkets(new Set());
    } else {
      setSelectedMarkets(new Set(marketsList.map(m => m.name)));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
  };

  const exportToExcel = () => {
    if (visibleProducts.length === 0) return;

    const exportData = visibleProducts.map(row => ({
      'Mercado': row.mercado,
      'Código': row.codigo,
      'Produto': row.produto,
      'Preço de Custo': row.precoCusto,
      'Preço Sugerido (R$)': row.precoSugerido,
      'Margem c/ 20% Custo Op': row.margem20,
      'Margem c/ 27% Custo Op': row.margem27,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Faltantes");

    XLSX.writeFile(workbook, "produtos_faltantes.xlsx");
  };

  const isAllMarketsSelected = selectedMarkets.size === marketsList.length && marketsList.length > 0;

  return (
    <div className="flex-1 grid grid-cols-1 gap-8 fade-in">
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <UploadCloud className="text-orange-500 w-5 h-5" /> Importar Planilhas de Análise
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-slate-700 dark:text-slate-300">Planilha de Planogramas</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  onChange={handlePlanogramasUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className={cn("p-4 border-2 border-dashed rounded-xl flex items-center gap-3 transition-colors", planogramasFile ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-slate-300 dark:border-slate-700 group-hover:border-orange-500 bg-slate-50 dark:bg-slate-800/50')}>
                  <FileSpreadsheet className={planogramasFile ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'} size={24} />
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {planogramasFile ? planogramasFile.name : "Clique ou arraste Planogramas.xls"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-slate-700 dark:text-slate-300">Planilha de Produtos</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  onChange={handleProdutosUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className={cn("p-4 border-2 border-dashed rounded-xl flex items-center gap-3 transition-colors", produtosFile ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-slate-300 dark:border-slate-700 group-hover:border-orange-500 bg-slate-50 dark:bg-slate-800/50')}>
                  <FileSpreadsheet className={produtosFile ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'} size={24} />
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {produtosFile ? produtosFile.name : "Clique ou arraste Produtos.xlsx"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={parseExcelFiles}
              disabled={!produtosFile || !planogramasFile || isProcessing}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center gap-2"
            >
              {isProcessing ? (
                <>Processando...</>
              ) : (
                <>
                  <Search size={18} />
                  Analisar Faltantes
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Section */}
        {marketsList.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[700px]">
            {mappingInfo && (
              <div className="mx-6 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-800/50 rounded-xl text-sm flex gap-2 flex-col">
                <h3 className="font-semibold text-slate-900 dark:text-white border-b border-blue-200 dark:border-blue-800/50 pb-2 mb-1 flex items-center gap-2">
                  <Search size={16} className="text-blue-600 dark:text-blue-400" /> Diagnóstico de Leitura (Como Busquei os Dados)
                </h3>
                <p className="text-slate-600 dark:text-slate-400">Caso algum valor não bata, verifique se a coluna identificada está correta:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                  <div>
                    <strong className="text-blue-700 dark:text-blue-400">Planilha: Produtos</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>Cabeçalho: <strong>Linha {mappingInfo.prodHeaderRow}</strong></li>
                      <li>Código: <strong>Coluna {mappingInfo.prodCodCol}</strong></li>
                      <li>Nome: <strong>Coluna {mappingInfo.prodNomeCol}</strong></li>
                      <li>Preço de Custo: <strong>Coluna {mappingInfo.prodCustoCol}</strong></li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-blue-700 dark:text-blue-400">Planilha: Planogramas</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>Cabeçalho: <strong>Linha {mappingInfo.planHeaderRow}</strong></li>
                      <li>Código: <strong>Coluna {mappingInfo.planCodCol}</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Resultados ({visibleProducts.length})
                </h2>
                
                {ignoredItems.size > 0 && (
                  <button 
                    onClick={clearIgnored}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-orange-400 px-3 py-1.5 rounded-full transition-colors font-medium border border-slate-200 dark:border-slate-700"
                  >
                    <RotateCcw size={14} />
                    Restaurar {ignoredItems.size} ocultados
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <button 
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex justify-between items-center gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-[200px] text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span>
                      {isAllMarketsSelected ? 'Todos os mercados' : `${selectedMarkets.size} mercado(s) selecionado(s)`}
                    </span>
                    <span className="text-xs text-slate-400">▼</span>
                  </button>

                  {dropdownOpen && (
                     <>
                      <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-30 max-h-[400px] overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                          <button 
                            onClick={toggleAllMarkets}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-800 transition w-full"
                          >
                            {isAllMarketsSelected ? (
                              <CheckSquare className="text-orange-600 dark:text-orange-400" size={18} />
                            ) : (
                              <Square className="text-slate-400 dark:text-slate-500" size={18} />
                            )}
                            Selecionar Todos
                          </button>
                        </div>
                        <div className="overflow-y-auto p-2 flex-col gap-1">
                          {marketsList.map(market => (
                            <button
                               key={market.name}
                               onClick={() => toggleMarket(market.name)}
                               className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 p-2 w-full text-left rounded-lg transition"
                            >
                              {selectedMarkets.has(market.name) ? (
                                <CheckSquare className="text-orange-600 dark:text-orange-400" size={18} />
                              ) : (
                                <Square className="text-slate-400 dark:text-slate-500" size={18} />
                              )}
                              <span className="truncate">{market.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm"
                >
                  <Download size={18} />
                  Exportar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mercado</th>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold w-1/4">Produto</th>
                    <th className="px-4 py-3 font-semibold text-right">Preço Custo</th>
                    <th className="px-4 py-3 font-semibold text-right text-slate-900 dark:text-white bg-slate-200/50 dark:bg-slate-700/50">Preço Sugerido</th>
                    <th className="px-4 py-3 font-semibold text-right">Mgm (20%)</th>
                    <th className="px-4 py-3 font-semibold text-right">Mgm (27%)</th>
                    <th className="px-4 py-3 font-semibold text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                        Nenhum produto faltante encontrado para a seleção atual.
                      </td>
                    </tr>
                  ) : (
                    visibleProducts.map((row, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 border-x border-slate-100 dark:border-slate-800">{row.mercado}</td>
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs border-r border-slate-100 dark:border-slate-800">{row.codigo}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate border-r border-slate-100 dark:border-slate-800" title={row.produto}>{row.produto}</td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">{formatCurrency(row.precoCusto)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-orange-600 dark:text-orange-400 bg-slate-50 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800">{formatCurrency(row.precoSugerido)}</td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                          {row.precoSugerido > 0 ? (
                            <span className={row.margem20 < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {formatPercent(row.margem20)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                          {row.precoSugerido > 0 ? (
                            <span className={row.margem27 < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {formatPercent(row.margem27)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button 
                            onClick={() => toggleIgnore(row.mercado, row.codigo)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Ocultar produto"
                          >
                            <EyeOff size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between bg-white dark:bg-slate-900 text-center rounded-b-xl">
              <span>* <strong>Preço Sugerido</strong> = Custo / (1 - (27% + 15%)) arredondado para próximo .x9</span>
              <span><strong>Margem</strong> = 1 - (Custo / Sugerido) - % Op</span>
            </div>
          </section>
        )}
    </div>
  );
}
