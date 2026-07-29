const fs = require('fs');
let code = fs.readFileSync('src/components/ElasticidadePrecos.tsx', 'utf-8');

code = code.replace(
  'const [priceB, setPriceB] = useState("");',
  'const [priceB, setPriceB] = useState("");\n  const [errorMsg, setErrorMsg] = useState("");'
);

code = code.replace(
  'const handleCreateTest = async () => {',
  'const handleCreateTest = async () => {\n    setErrorMsg("");'
);

code = code.replace(
  /console\.error\(errorData\?\.error \|\| "Erro ao criar teste"\);/g,
  'setErrorMsg(errorData?.error || "Erro ao criar teste");'
);

code = code.replace(
  /console\.error\("Erro de rede"\);/g,
  'setErrorMsg("Erro de rede");'
);

code = code.replace(
  '<div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">',
  `{errorMsg && <div className="px-6 pb-2 text-red-500 text-sm font-medium">{errorMsg}</div>}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">`
);

// clear error when opening modal
code = code.replace(
  '<button onClick={() => setIsModalOpen(true)}',
  '<button onClick={() => { setIsModalOpen(true); setErrorMsg(""); }}'
);

fs.writeFileSync('src/components/ElasticidadePrecos.tsx', code);
