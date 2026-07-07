const fs = require('fs');
let code = fs.readFileSync('scripts/daily_routines.ts', 'utf8');

code = code.replace(
  `    await db.update(dimPlanogramas)\n      .set({ velocidadeMedia7d })\n      .where(eq(dimPlanogramas.planItemId, p.planItemId));`,
  `    // Batch update below`
);

code = code.replace(
  `const now = new Date();`,
  `const now = new Date();\n  const updatePromises = [];`
);

code = code.replace(
  `    // Batch update below`,
  `    updatePromises.push(
      db.update(dimPlanogramas)
        .set({ velocidadeMedia7d })
        .where(eq(dimPlanogramas.planItemId, p.planItemId))
    );
    
    // Process in chunks to avoid memory issues
    if (updatePromises.length >= 100) {
      await Promise.all(updatePromises);
      updatePromises.length = 0;
    }`
);

code = code.replace(
  `  if (anamnesisEmailContent.trim() !== "") {`,
  `  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  if (anamnesisEmailContent.trim() !== "") {`
);

fs.writeFileSync('scripts/daily_routines.ts', code);
