const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

code = code.replace(
  /if \(res\.ok\) \{[\s\S]*?\} else \{[\s\S]*?alert\("Erro ao criar teste"\);[\s\S]*?\}/m,
  `if (res.ok) {
        setIsModalOpen(false);
        loadData();
      } else {
        const errorData = await res.json().catch(() => null);
        alert(errorData?.error || "Erro ao criar teste");
      }`
);

// Add handleDeleteTest
const deleteFunc = `
  const handleDeleteTest = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este teste? O preço voltará ao original.")) return;
    try {
      const res = await fetch(\`\${API_BASE}/api/elasticity/\${id}\`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Erro ao excluir teste");
      }
    } catch (e) {
      alert("Erro de rede ao excluir teste");
    }
  };
`;

code = code.replace(
  'const activeTests = tests.filter(t => t.status !== \'finished\').length;',
  deleteFunc + '\n  const activeTests = tests.filter(t => t.status !== \'finished\').length;'
);

// Add Trash2 icon to lucide-react import
if (!code.includes('Trash2')) {
  code = code.replace('RotateCcw', 'RotateCcw, Trash2');
}

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
