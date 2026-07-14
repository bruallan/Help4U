const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

// The main tables in ValidadeEstoque
code = code.replace(/<table className="w-full text-sm text-left">/g, 
  '<table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">');

code = code.replace(/<thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800\/50 text-slate-500">/g, 
  '<thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">');

code = code.replace(/dark:text-white"/g, 'dark:text-white [color-scheme:light_dark]"');
code = code.replace(/dark:text-slate-200"/g, 'dark:text-slate-200 [color-scheme:light_dark]"');

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
