const fs = require('fs');
let code = fs.readFileSync('src/components/RecebimentoPendencias.tsx', 'utf8');

const regexBuscar = /const handleBuscarEntradas = async \(\) => \{[\s\S]*?setIsFetchingVMPay\(false\);\n  \};/;

const replacementBuscar = `const handleBuscarEntradas = async () => {
    setIsFetchingVMPay(true);
    try {
      const res = await fetch(\`\${API_BASE}/api/vmpay/entradas\`);
      if (!res.ok) throw new Error("Erro ao buscar no VMPay");
      const data = await res.json();
      
      const entries = Array.isArray(data) ? data : (data.data || []);
      let count = 0;
      for (const entry of entries) {
         if (entry.kind !== "StorableEntry" && entry.originator_type !== "StorableEntry") continue;
         
         const qty = entry.quantity || entry.value || (entry.total_cost_price && entry.cost_price ? Math.round(entry.total_cost_price / entry.cost_price) : 1);
         const prodName = entry.good?.display_name || entry.product_name;
         if (!prodName) continue;
         const fn = entry.provider?.name || null;

         // Check if already exists in aguardando_validade
         // Consider it duplicate if same product, same qty, same provider
         const isDupe = lotesAguardandoValidade.find(l => l.produto === prodName && l.quantidadeAtual === qty && l.fornecedor === fn);
         if (isDupe) continue;

         const pDB = produtos.find(p => p.produto === prodName || p.codigoBarras === entry.good?.barcode);
         
         await fetch(\`\${API_BASE}/api/lotes\`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             produtoId: pDB?.id || null,
             produto: prodName,
             quantidadeAtual: qty,
             dataValidade: null,
             status: "aguardando_validade",
             fornecedor: fn
           })
         });
         count++;
      }
      alert(\`\${count} entradas importadas para Aguardando Validade.\`);
      fetchDados();
    } catch(e) {
      console.error(e);
      alert("Erro ao sincronizar com VMPay.");
    }
    setIsFetchingVMPay(false);
  };`;

if (code.match(regexBuscar)) {
   code = code.replace(regexBuscar, replacementBuscar);
   fs.writeFileSync('src/components/RecebimentoPendencias.tsx', code);
   console.log("Patched UI fetch");
} else {
   console.log("Not found UI fetch");
}
