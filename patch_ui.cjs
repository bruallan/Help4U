const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const buttonStr = `        </button>
      </div>`;

const newButtonStr = `        </button>
        </div>
        <button
          onClick={async () => {
            setIsSyncing(true);
            try {
              const res = await fetch(\`\${API_BASE}/api/vmpay/refresh-stock\`, { method: "POST" });
              if (res.ok) {
                await fetchDados();
                alert("Tabela dim_produtos atualizada com VMPay!");
              } else {
                alert("Erro ao atualizar estoques do VMPay");
              }
            } catch (e) {
              console.error(e);
              alert("Erro ao atualizar estoques do VMPay");
            } finally {
              setIsSyncing(false);
            }
          }}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 rounded-lg transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
          Atualizar Produtos (VMPay)
        </button>
      </div>`;

code = code.replace(`      {/* TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">`, `      {/* TABS */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 mb-6 pb-2">
        <div className="flex">`);

code = code.replace(buttonStr, newButtonStr);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
