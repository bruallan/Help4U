import React, { useState, useEffect } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Scatter, ScatterChart, ZAxis, ComposedChart
} from "recharts";
import { Play, CheckCircle, RotateCcw, Trash2, AlertTriangle, TrendingUp, Search } from "lucide-react";
import { formatCurrency } from "../utils";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

export default function ElasticidadePrecos() {
  const [tests, setTests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [priceB, setPriceB] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [daysB, setDaysB] = useState("7");

  const loadData = async () => {
    setLoading(true);
    
    // Fetch tests first (fast)
    fetch(`${API_BASE}/api/elasticity`)
      .then(res => res.json())
      .then(data => {
         setTests(data);
      })
      .catch(e => console.error("Tests fetch error:", e));

    // Fetch products in parallel but handle independently (slow)
    fetch(`${API_BASE}/api/vmpay/products?tag=impulso`)
      .then(res => res.json())
      .then(data => {
         setProducts(data);
         setLoading(false);
      })
      .catch(e => {
         console.error("Products fetch error:", e);
         setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTest = async () => {
    setErrorMsg("");
    if (!selectedProduct || !priceB) return;
    try {
      const res = await fetch(`${API_BASE}/api/elasticity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          price_b: parseFloat(priceB),
          days: parseInt(daysB)
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        loadData();
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMsg(errorData?.error || "Erro ao criar teste");
      }
    } catch (e) {
      setErrorMsg("Erro de rede");
    }
  };

  
  const handleDeleteTest = async (id: string) => {
    // Removed window.confirm due to iframe restrictions
    try {
      const res = await fetch(`${API_BASE}/api/elasticity/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        console.error(err?.error || "Erro ao excluir teste");
      }
    } catch (e) {
      console.error("Erro de rede ao excluir teste");
    }
  };

  const activeTests = tests.filter(t => t.status !== 'finished').length;
  const validatingTests = tests.filter(t => t.status === 'validating_opt').length;
  
  const finishedTests = tests.filter(t => t.status === 'finished' || t.status === 'validating_opt' || t.status === 'recalculating');
  
  const eligibleProducts = products;
  const getProductName = (id: string) => {
    const p = products.find(p => p.id.toString() === id.toString());
    return p ? p.name : id;
  };
  const avgError = finishedTests.reduce((acc, t) => acc + (t.errorPercentage || 0), 0) / (finishedTests.length || 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Testes Ativos</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeTests}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Em Validação</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{validatingTests}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Produtos IMPULSO</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{eligibleProducts.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-1">Erro Médio Global</h3>
          <p className={`text-3xl font-bold ${avgError < 10 ? 'text-emerald-500' : avgError <= 20 ? 'text-amber-500' : 'text-red-500'}`}>
            {avgError.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gerenciamento de Testes</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          Novo Teste
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm">
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">Produto</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">Status</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">Fase Atual</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">P_A</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">P_B</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800">P_Opt</th>
              <th className="p-4 font-medium border-b border-slate-200 dark:border-slate-800 w-16">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {tests.map(t => (
              <tr key={t.id} className="text-sm text-slate-700 dark:text-slate-300">
                <td className="p-4">{getProductName(t.productId)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    t.status === 'running_B' ? 'bg-blue-100 text-blue-700' :
                    t.status === 'validating_opt' ? 'bg-amber-100 text-amber-700' :
                    t.status === 'finished' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-4">
                  {t.status === 'running_B' && t.dateBEnd ? `Fim B: ${new Date(t.dateBEnd).toLocaleDateString()}` : '-'}
                </td>
                <td className="p-4">{t.priceA ? formatCurrency(t.priceA) : '-'}</td>
                <td className="p-4">{t.priceB ? formatCurrency(t.priceB) : '-'}</td>
                <td className="p-4">{t.priceOpt ? formatCurrency(t.priceOpt) : '-'}</td>
                <td className="p-4">
                  <button 
                    onClick={() => handleDeleteTest(t.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir Teste"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum teste encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {finishedTests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8">Cards de Validação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {finishedTests.map(t => {
              // Calculate points for the parabola
              const pA = t.priceA || 0;
              const pB = t.priceB || 0;
              const pOpt = t.priceOpt || 0;
              const mA = t.marginA || 0;
              const mB = t.marginB || 0;
              const mOptProj = t.expectedMarginOpt || 0;
              const mOptReal = t.actualMarginOpt || 0;
              
              // Simplistic parabola generation for visualization
              const a = mOptProj;
              const h = pOpt;
              // y = k(x - h)^2 + a => k = (mA - a) / (pA - h)^2
              const k = pA !== h ? (mA - a) / Math.pow(pA - h, 2) : -10;
              
              const curveData = [];
              const minP = Math.min(pA, pB) * 0.8;
              const maxP = Math.max(pA, pB, pOpt) * 1.2;
              for (let x = minP; x <= maxP; x += (maxP - minP)/20) {
                curveData.push({ price: x, margin: k * Math.pow(x - h, 2) + a });
              }

              return (
                <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{getProductName(t.productId)}</h3>
                      <p className="text-sm text-slate-500">Teste de Elasticidade</p>
                    </div>
                    {t.errorPercentage !== null && (
                      <div className={`px-3 py-1 rounded-xl text-sm font-bold ${
                        t.errorPercentage < 10 ? 'bg-emerald-100 text-emerald-700' :
                        t.errorPercentage <= 20 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        Erro: {t.errorPercentage.toFixed(1)}%
                      </div>
                    )}

                  <details className="mt-4 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                    <summary className="font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                      Memória de Cálculo (Fórmula da Planilha)
                    </summary>
                    <div className="mt-2 space-y-1">
                      <p>O preço ótimo projetado utiliza a função de demanda linear e maximização do lucro com base na elasticidade calculada.</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li><strong>V_A (Volume Antigo):</strong> {t.volA || 0}</li>
                        <li><strong>P_A (Preço Antigo):</strong> {formatCurrency(pA)}</li>
                        <li><strong>V_B (Volume Teste):</strong> {t.volB || 0}</li>
                        <li><strong>P_B (Preço Teste):</strong> {formatCurrency(pB)}</li>
                        <li><strong>Custo Unit. (C):</strong> {formatCurrency(pA - (mA / (t.volA || 1)))} (Deduzido da Margem A)</li>
                        <li><strong>Overhead:</strong> 0%</li>
                        <li><strong>Elasticidade (E):</strong> {t.elasticityCoef ? t.elasticityCoef.toFixed(4) : ((((t.volB || 0) - (t.volA || 0)) / (t.volA || 1)) / ((pB - pA) / pA)).toFixed(4)}</li>
                      </ul>
                      <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                        <code className="text-[10px]">
                          E = ((V_B - V_A) / V_A) / ((P_B - P_A) / P_A)<br/>
                          P_Opt = (P_A * (E - 1) * (1 - Overhead) + E * C) / (2 * E * (1 - Overhead))
                        </code>
                      </div>
                    </div>
                  </details>

                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="price" type="number" domain={['dataMin', 'dataMax']} name="Preço" unit="R$" />
                        <YAxis dataKey="margin" type="number" name="Margem" unit="R$" />
                        <RechartsTooltip cursor={{strokeDasharray: '3 3'}} />
                        
                        <Line data={curveData} dataKey="margin" stroke="#94a3b8" strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
                        
                        <Scatter name="A" data={[{ price: pA, margin: mA, name: 'A (Baseline)' }]} fill="#64748b" />
                        <Scatter name="B" data={[{ price: pB, margin: mB, name: 'B (Intervenção)' }]} fill="#3b82f6" />
                        <Scatter name="O" data={[{ price: pOpt, margin: mOptProj, name: 'O (Projetado)' }]} fill="#f59e0b" shape="star" />
                        {t.status !== 'running_B' && mOptReal > 0 && (
                          <Scatter name="Ov" data={[{ price: pOpt, margin: mOptReal, name: 'Ov (Real)' }]} fill="#10b981" />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {t.errorPercentage > 15 && t.status !== 'recalculating' && (
                    <button 
                      onClick={() => {
                         fetch(`${API_BASE}/api/elasticity/${t.id}/recalculate`, { method: 'POST' }).then(() => loadData());
                      }}
                      className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Recalcular Preço Ótimo</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Novo Teste de Elasticidade</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Produto (Tag IMPULSO)</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  value={selectedProduct?.id || ""}
                  onChange={e => setSelectedProduct(products.find(p => p.id.toString() === e.target.value))}
                >
                  <option value="">Selecione um produto...</option>
                  {eligibleProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (R$ {p.default_price})</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
                  O sistema extrairá o volume dos últimos 30 dias automaticamente como Teste A.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preço B (Intervenção)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  value={priceB}
                  onChange={e => setPriceB(e.target.value)}
                  placeholder="Ex: 5.99"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prazo Teste B</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  value={daysB}
                  onChange={e => setDaysB(e.target.value)}
                >
                  <option value="7">7 Dias</option>
                  <option value="14">14 Dias</option>
                  <option value="30">30 Dias</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateTest}
                disabled={!selectedProduct || !priceB}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                Iniciar Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
