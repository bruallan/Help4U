const fs = require('fs');
let code = fs.readFileSync('src/components/RecebimentoPendencias.tsx', 'utf8');

code = code.replace('import { API_BASE } from "../config";', 'const API_BASE = (import.meta as any).env?.VITE_API_URL || "";');

fs.writeFileSync('src/components/RecebimentoPendencias.tsx', code);

// Also let's fix lotesAgregados to use lotesConsolidados
let valCode = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');
valCode = valCode.replace('for (const lote of lotes) {', 'for (const lote of lotesConsolidados) {');
fs.writeFileSync('src/components/ValidadeEstoque.tsx', valCode);
