const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

// 1. Add Calendar icon import
code = code.replace('Save,\n} from "lucide-react";', 'Save,\n  Calendar,\n  Trash2,\n} from "lucide-react";');

// 2. Add new states
code = code.replace(
  'const [editLoteDate, setEditLoteDate] = useState("");',
  `const [editLoteDate, setEditLoteDate] = useState("");
  const [inboundData, setInboundData] = useState<{produto: string, produtoId: number, qty: number} | null>(null);
  const [inboundDate, setInboundDate] = useState("");`
);

// 3. Add produtoId to alertasEstoque
code = code.replace(
  'produto: pDB.produto,\n          qtdDimProdutos: pDB.quantidadeEstoque || 0,',
  'produto: pDB.produto,\n          produtoId: pDB.id,\n          qtdDimProdutos: pDB.quantidadeEstoque || 0,'
);

// 4. Create the function to save inbound lot
const inboundFunc = `
  const handleSaveInbound = async () => {
    if (!inboundData || !inboundDate) {
      alert("Selecione a data de validade.");
      return;
    }
    try {
      const res = await fetch(\`\${API_BASE}/api/lotes\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: inboundData.produtoId,
          produto: inboundData.produto,
          dataValidade: inboundDate,
          quantidadeAtual: inboundData.qty,
        }),
      });
      if (res.ok) {
        setInboundData(null);
        setInboundDate("");
        await fetchDados();
      } else {
        alert("Erro ao salvar lote.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar lote.");
    }
  };
`;
code = code.replace('const syncVMPayToDB = async', inboundFunc + '\n  const syncVMPayToDB = async');

// 5. Replace Ações Individuais in the table
const actionColOld = `<td className="px-4 py-3 text-right whitespace-nowrap">
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
                    </td>`;

const actionColNew = `<td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        {a.qtdDimProdutos > a.qtdLotes ? (
                          <button
                            onClick={() => {
                               setInboundData({ produto: a.produto, produtoId: a.produtoId, qty: a.qtdDimProdutos - a.qtdLotes });
                               setInboundDate("");
                            }}
                            title="Informar validade para os novos itens"
                            className="flex items-center gap-1 p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors text-xs font-semibold"
                          >
                            <Calendar className="w-4 h-4" />
                            <span>Informar Validade</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => syncVMPayToDB([a.produto])}
                            title="Remover excedente dos lotes mais antigos"
                            className="flex items-center gap-1 p-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors text-xs font-semibold"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Ajustar Saída</span>
                          </button>
                        )}
                      </div>
                    </td>`;

code = code.replace(actionColOld, actionColNew);

// 6. Add Inbound Modal UI at the bottom
const inboundModalCode = `
      {inboundData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-green-50 dark:bg-green-900/20">
              <h3 className="font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Nova Entrada
              </h3>
              <button
                onClick={() => setInboundData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Produto</p>
                <p className="font-medium text-slate-900 dark:text-white">{inboundData.produto}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade Recebida (Diferença)
                </label>
                <input
                  type="number"
                  value={inboundData.qty}
                  onChange={(e) => setInboundData({...inboundData, qty: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data de Validade
                </label>
                <input
                  type="date"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-2.5 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
              <button
                onClick={() => setInboundData(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInbound}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
              >
                Salvar Lote
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  '{editingLoteProduto && (',
  inboundModalCode + '\n      {editingLoteProduto && ('
);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
