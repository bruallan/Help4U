const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

code = code.replace(
  /const loadData = async \(\) => \{[\s\S]*?setLoading\(false\);\n  \};/m,
  `const loadData = async () => {
    setLoading(true);
    
    // Fetch tests first (fast)
    fetch(\`\${API_BASE}/api/elasticity\`)
      .then(res => res.json())
      .then(data => {
         setTests(data);
      })
      .catch(e => console.error("Tests fetch error:", e));

    // Fetch products in parallel but handle independently (slow)
    fetch(\`\${API_BASE}/api/vmpay/products?tag=impulso\`)
      .then(res => res.json())
      .then(data => {
         setProducts(data);
         setLoading(false);
      })
      .catch(e => {
         console.error("Products fetch error:", e);
         setLoading(false);
      });
  };`
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
