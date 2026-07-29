const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

// Replace handleDeleteTest
code = code.replace(
  /const handleDeleteTest = async \(id: string\) => \{[\s\S]*?catch \(e\) \{[\s\S]*?\}[\s\S]*?\};/m,
  `const handleDeleteTest = async (id: string) => {
    // Removed window.confirm due to iframe restrictions
    try {
      const res = await fetch(\`\${API_BASE}/api/elasticity/\${id}\`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        console.error(err?.error || "Erro ao excluir teste");
      }
    } catch (e) {
      console.error("Erro de rede ao excluir teste");
    }
  };`
);

// Replace alert in handleCreateTest
code = code.replace(
  /alert\(errorData\?\.error \|\| "Erro ao criar teste"\);/g,
  'console.error(errorData?.error || "Erro ao criar teste");'
);
code = code.replace(
  /alert\("Erro de rede"\);/g,
  'console.error("Erro de rede");'
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
