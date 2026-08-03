const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf-8');

const debounceHook = `
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(async () => {
       if (/^\\d{8,}$/.test(searchSku)) {
          try {
             const res = await fetch(\`\${API_BASE}/api/barcode/\${searchSku}\`);
             if (res.ok) {
                 const data = await res.json();
                 setDebouncedSearch(data.produto);
                 return;
             }
          } catch(e) {}
       }
       setDebouncedSearch(searchSku);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchSku]);
`;

code = code.replace(
  '  const [searchSku, setSearchSku] = useState("");',
  '  const [searchSku, setSearchSku] = useState("");' + debounceHook
);

code = code.replace(
  '      let matches = false;\n      if (!searchSku) {\n        matches = true;\n      } else {\n        if (produto.toLowerCase().includes(searchSku.toLowerCase())) {',
  '      let matches = false;\n      if (!debouncedSearch) {\n        matches = true;\n      } else {\n        if (produto.toLowerCase().includes(debouncedSearch.toLowerCase())) {'
);

code = code.replace(
  '          if (pDB && pDB.codigoBarras && pDB.codigoBarras.includes(searchSku)) {',
  '          if (pDB && pDB.codigoBarras && pDB.codigoBarras.includes(debouncedSearch)) {'
);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
