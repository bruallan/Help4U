const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add import
if (!code.includes('import ElasticidadePrecos')) {
  code = code.replace(
    'import ValidadeEstoque from "./components/ValidadeEstoque";',
    'import ValidadeEstoque from "./components/ValidadeEstoque";\nimport ElasticidadePrecos from "./components/ElasticidadePrecos";'
  );
}

// Add to sidebar
if (!code.includes('setActiveTab("elasticidade_precos")')) {
  const sidebarItem = `
          <button
            onClick={() => {
              setActiveTab("elasticidade_precos");
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              activeTab === "elasticidade_precos"
                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
            )}
          >
            <LineChart className="w-5 h-5 text-amber-500" />
            <span>Elasticidade de Preços</span>
          </button>
`;
  code = code.replace(
    /<\/nav>/,
    sidebarItem + '        </nav>'
  );
}

// Add to title
code = code.replace(
  /: "Indicadores de Risco"}/,
  ': activeTab === "elasticidade_precos"\n ? "Elasticidade de Preços"\n : "Indicadores de Risco"}'
);

// Add to description
code = code.replace(
  /: "Veja alertas de risco para seus produtos."}/,
  ': activeTab === "elasticidade_precos"\n ? "Teste A/B e validação do preço ótimo de produtos."\n : "Veja alertas de risco para seus produtos."}'
);

// Add to render
code = code.replace(
  /\{activeTab === "validade_estoque" && rawData && \([\s\S]*?\}\)/,
  '$&\n            {activeTab === "elasticidade_precos" && <ElasticidadePrecos />}'
);

fs.writeFileSync('src/App.tsx', code);
