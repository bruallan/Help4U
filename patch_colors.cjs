const fs = require('fs');
let code = fs.readFileSync('src/components/RecebimentoPendencias.tsx', 'utf8');

// Thead colors
code = code.replace(/<thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800\/50 text-slate-500">/g, 
  '<thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">');

// Table colors
code = code.replace(/<table className="w-full text-sm text-left">/g, 
  '<table className="w-full text-sm text-left text-slate-900 dark:text-slate-200">');

// Inputs colors (Simulador)
code = code.replace(/className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm dark:bg-slate-950 dark:border-slate-800"/g,
  'className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"');

// Input Date in Table
code = code.replace(/className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800"/g,
  'className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 dark:text-white [color-scheme:light_dark]"');

// Input Number in Table
code = code.replace(/className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 font-mono"/g,
  'className="bg-slate-50 border border-slate-200 p-1.5 rounded text-sm w-full dark:bg-slate-950 dark:border-slate-800 dark:text-white font-mono [color-scheme:light_dark]"');

fs.writeFileSync('src/components/RecebimentoPendencias.tsx', code);
