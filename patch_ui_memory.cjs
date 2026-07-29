const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

const memoryJSX = `
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
`;

code = code.replace(
  '                  )}',
  '                  )}\n' + memoryJSX
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
