const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const importStr = `import RecebimentoPendencias from "./RecebimentoPendencias";`;
code = code.replace('import { Html5Qrcode', importStr + '\\nimport { Html5Qrcode');

const stateStr = `  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"geral" | "recebimento">("geral");`;

code = code.replace('const [isSyncing, setIsSyncing] = useState(false);', stateStr);

const tabsHtml = `
      {/* TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("geral")}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-colors border-b-2",
            activeTab === "geral"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Estoque Consolidado
        </button>
        <button
          onClick={() => setActiveTab("recebimento")}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-colors border-b-2",
            activeTab === "recebimento"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Recebimento / Pendências
        </button>
      </div>

      {activeTab === "recebimento" ? (
        <RecebimentoPendencias produtos={produtosDB} lotes={lotes} fetchDados={fetchDados} />
      ) : (
        <>
`;

const retStr = `return (
    <div className="space-y-6">`;

code = code.replace(retStr, retStr + tabsHtml);

const theEnd = `
        </>
      )}
    </div>
  );
}
`;

// It's tricky to find the end of the return statement.
// Let's replace the last 15 lines.
// Actually, it's safer to just inject `</>` just before the closing `</div>` of `return ( ... );`.
// Let's do a regex to replace the last `</div>` before `);`
code = code.replace(/<\/div>\s*\)\s*;\s*}\s*$/g, "        </>\n      )}\n    </div>\n  );\n}\n");

// Also, filter the main table to only show lotes consolidados!
code = code.replace(
  'const [lotes, setLotes] = useState<Lote[]>([]);',
  'const [lotes, setLotes] = useState<Lote[]>([]);\n  const lotesConsolidados = useMemo(() => lotes.filter((l: any) => l.status === "consolidado" || !l.status), [lotes]);'
);

// We need to change where `lotes` is used for math in ValidadeEstoque.
code = code.replace(/lotes\.reduce/g, 'lotesConsolidados.reduce');
code = code.replace(/lotes\.filter/g, 'lotesConsolidados.filter');
// But `lotes.filter` might be used for something else. Wait, let's just make `lotesConsolidados` and use it for `alertasEstoque` and `tableData`.

code = code.replace(/const totalNoSistema = lotes/g, 'const totalNoSistema = lotesConsolidados');

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
