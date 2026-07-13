const fs = require('fs');

let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

// Update imports
code = code.replace(
  '  Camera,\n} from "lucide-react";',
  '  Camera,\n  RefreshCw,\n  UploadCloud,\n  DownloadCloud,\n  Edit2,\n  Save,\n} from "lucide-react";'
);

// Add states
code = code.replace(
  '  const [isScanning, setIsScanning] = useState(false);',
  `  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingLoteProduto, setEditingLoteProduto] = useState<string | null>(null);
  
  // States for inline edit
  const [editLoteId, setEditLoteId] = useState<number | null>(null);
  const [editLoteQty, setEditLoteQty] = useState("");
  const [editLoteDate, setEditLoteDate] = useState("");
`
);

// Add functions
const newFuncs = `
  const syncVMPayToDB = async (produtoIds: string[]) => {
    setIsSyncing(true);
    try {
      const res = await fetch(\`\${API_BASE}/api/sync/vmpay-to-db\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoIds }),
      });
      if (res.ok) {
        await fetchDados();
        alert("Sincronização VM Pay -> Banco de Dados concluída com sucesso.");
      } else {
        alert("Erro ao sincronizar");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncDBToVMPay = async (produtoIds: string[]) => {
    setIsSyncing(true);
    try {
      const res = await fetch(\`\${API_BASE}/api/sync/db-to-vmpay\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoIds }),
      });
      if (res.ok) {
        await fetchDados();
        alert("Ajuste Banco de Dados -> VM Pay enviado com sucesso (Mock).");
      } else {
        alert("Erro ao sincronizar");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  const saveLoteEdit = async (idLote: number) => {
    try {
      const res = await fetch(\`\${API_BASE}/api/lotes/\${idLote}\`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidadeAtual: editLoteQty,
          dataValidade: editLoteDate,
        }),
      });
      if (res.ok) {
        setEditLoteId(null);
        await fetchDados();
      } else {
        alert("Erro ao salvar lote");
      }
    } catch (e) {
      alert("Erro ao salvar lote");
    }
  };
`;

code = code.replace(
  '  const fetchDados = async () => {',
  newFuncs + '\n  const fetchDados = async () => {'
);


// Replace header of Alertas de Divergência to include global buttons
const alertHeaderOld = `<div className="flex items-center space-x-2 text-red-700 dark:text-red-400 font-bold mb-4">
            <AlertCircle className="w-5 h-5" />
            <h3>Alerta: Divergência entre Lotes e Estoque Total</h3>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            Os seguintes produtos possuem divergência entre o somatório das
            quantidades nos lotes e o saldo em estoque no sistema.
          </p>`;

const alertHeaderNew = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center space-x-2 text-red-700 dark:text-red-400 font-bold mb-2">
                <AlertCircle className="w-5 h-5" />
                <h3>Alerta: Divergência entre Lotes e Estoque Total</h3>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300">
                Os seguintes produtos possuem divergência entre o somatório das
                quantidades nos lotes e o saldo em estoque no sistema (VMPay).
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => syncDBToVMPay(alertasEstoque.map(a => a.produto))}
                disabled={isSyncing}
                className="flex items-center justify-center space-x-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Todos: BD &rarr; VMPay</span>
              </button>
              <button
                onClick={() => syncVMPayToDB(alertasEstoque.map(a => a.produto))}
                disabled={isSyncing}
                className="flex items-center justify-center space-x-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Todos: VMPay &rarr; BD</span>
              </button>
            </div>
          </div>`;
code = code.replace(alertHeaderOld, alertHeaderNew);


// Replace alert table
const alertTableOld = `<th className="px-4 py-3">Diferença</th>
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
              </tbody>`;

const alertTableNew = `<th className="px-4 py-3">Diferença</th>
                  <th className="px-4 py-3 text-right">Ações Individuais</th>
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => syncDBToVMPay([a.produto])}
                          title="Enviar Quantidade dos Lotes para VMPay"
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                        >
                          <UploadCloud className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => syncVMPayToDB([a.produto])}
                          title="Atualizar Lotes baseado no VMPay"
                          className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md transition-colors"
                        >
                          <DownloadCloud className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>`;
code = code.replace(alertTableOld, alertTableNew);


// Add a modal to edit lots. Add a button in the main table to open it.
const mainTableColOld = `<th
                      className="px-4 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("actionRoute")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Ação (Rota)</span>
                        <ArrowUpDown className="w-4 h-4 opacity-50" />
                      </div>
                    </th>
                  </tr>`;
const mainTableColNew = `<th
                      className="px-4 py-3 font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("actionRoute")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Ação (Rota)</span>
                        <ArrowUpDown className="w-4 h-4 opacity-50" />
                      </div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-right">
                      Editar
                    </th>
                  </tr>`;
code = code.replace(mainTableColOld, mainTableColNew);

const mainTableRowOld = `<p className="font-semibold leading-tight">
                            {row.actionRoute}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>`;
const mainTableRowNew = `<p className="font-semibold leading-tight">
                            {row.actionRoute}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                       <button
                         onClick={() => setEditingLoteProduto(row.sku)}
                         className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors inline-block"
                         title="Editar Lotes Específicos"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>`;
code = code.replace(mainTableRowOld, mainTableRowNew);


const editModalCode = `
      {editingLoteProduto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-600" />
                Editar Lotes: {editingLoteProduto}
              </h3>
              <button
                onClick={() => { setEditingLoteProduto(null); setEditLoteId(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID Lote</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Qtd Atual</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.filter(l => l.produto === editingLoteProduto).map(lote => (
                    <tr key={lote.idLote} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3">#{lote.idLote} {lote.instalacaoId ? '(Mercado)' : '(Depósito)'}</td>
                      <td className="px-4 py-3">
                        {editLoteId === lote.idLote ? (
                           <input type="date" value={editLoteDate} onChange={e => setEditLoteDate(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-md p-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                        ) : (
                           new Date(lote.dataValidade).toLocaleDateString('pt-BR')
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editLoteId === lote.idLote ? (
                           <input type="number" min="0" value={editLoteQty} onChange={e => setEditLoteQty(e.target.value)} className="w-20 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-md p-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                        ) : (
                           lote.quantidadeAtual
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editLoteId === lote.idLote ? (
                          <div className="flex justify-end gap-2">
                             <button onClick={() => saveLoteEdit(lote.idLote)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save className="w-4 h-4"/></button>
                             <button onClick={() => setEditLoteId(null)} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"><X className="w-4 h-4"/></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditLoteId(lote.idLote); setEditLoteQty(lote.quantidadeAtual.toString()); setEditLoteDate(lote.dataValidade.split('T')[0]); }} className="p-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                             <Edit2 className="w-4 h-4"/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {lotes.filter(l => l.produto === editingLoteProduto).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center">Nenhum lote individual encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  '{/* Alertas de Divergência de Estoque */}',
  editModalCode + '\n      {/* Alertas de Divergência de Estoque */}'
);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
