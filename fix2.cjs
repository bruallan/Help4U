const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const riskStr = "\\n  const riskWarning = useMemo(() => {\\n    if (!modalProduto || !modalDataValidade || !modalQuantidade) return null;\\n    \\n    const metric = skuMetrics.map.get(modalProduto);\\n    if (!metric) return null;\\n    \\n    let globalMin = new Date(8640000000000000);\\n    let globalMax = new Date(-8640000000000000);\\n    for (const row of rawData) {\\n      if (row.dayDate < globalMin) globalMin = row.dayDate;\\n      if (row.dayDate > globalMax) globalMax = row.dayDate;\\n    }\\n    const maxDays = Math.max(1, (globalMax.getTime() - globalMin.getTime()) / 86400000);\\n    const vmd = metric.volume / maxDays;\\n    \\n    if (vmd === 0) return null;\\n    \\n    const prodDb = produtosDB.find((p) => p.produto === modalProduto);\\n    const totalEstoque = prodDb?.quantidadeEstoque || 0;\\n    \\n    const novoTotal = totalEstoque + Number(modalQuantidade);\\n    const daysToSell = novoTotal / vmd;\\n    \\n    const expiryDate = new Date(modalDataValidade);\\n    const today = new Date();\\n    const daysToExpiry = (expiryDate.getTime() - today.getTime()) / 86400000;\\n    \\n    if (daysToSell > daysToExpiry * 0.9) {\\n      return {\\n        vmd: vmd.toFixed(2),\\n        daysToSell: Math.ceil(daysToSell),\\n        daysToExpiry: Math.ceil(daysToExpiry),\\n        novoTotal\\n      };\\n    }\\n    \\n    return null;\\n  }, [modalProduto, modalDataValidade, modalQuantidade, skuMetrics, produtosDB, rawData]);\\n\\n  ";

code = code.replace(riskStr, "");

// put it before `  return (\n    <div className="space-y-6">`
const target = '  return (\n    <div className="space-y-6">';
code = code.replace(target, riskStr.replace(/\\n/g, '\n') + target);

fs.writeFileSync('src/components/ValidadeEstoque.tsx', code);
