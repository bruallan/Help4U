const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const tableBlock = `                    <td className="px-4 py-3 text-right whitespace-nowrap">
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

const newTableBlock = `                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => syncDBToVMPay([a.produto])}
                          title="Atualizar o VMPay com a quantidade do Banco de Dados"
                          className="flex items-center gap-1 p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 rounded-md transition-colors text-xs font-semibold"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>BD → VMPay</span>
                        </button>
                        <button
                          onClick={() => syncVMPayToDB([a.produto])}
                          title="Atualizar o Banco de Dados com a quantidade do VMPay"
                          className="flex items-center gap-1 p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 rounded-md transition-colors text-xs font-semibold"
                        >
                          <DownloadCloud className="w-4 h-4" />
                          <span>VMPay → BD</span>
                        </button>
                        
                        {a.qtdDimProdutos > a.qtdLotes && (
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
                        )}
                      </div>
                    </td>`;

code = code.replace(tableBlock, newTableBlock);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
