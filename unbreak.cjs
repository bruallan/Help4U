const fs = require('fs');
let code = fs.readFileSync('src/components/ValidadeEstoque.tsx', 'utf8');

const marker = ' xl:grid-cols-4 gap-4">';
const markerIndex = code.indexOf(marker);

if (markerIndex !== -1) {
  const index80onwards = code.slice(markerIndex + marker.length);
  // We need the first 80 characters from the ORIGINAL file
  // Wait, I can just find the original searchBlockStart inside index80onwards!
  
  // Let's find the original start of the file.
  // Actually, I can just use the index80onwards, and prepend the first 80 chars of the CURRENT file!
  const first80 = code.slice(0, 80);
  const restoredCode = first80 + index80onwards;
  fs.writeFileSync('src/components/ValidadeEstoque.tsx_restored', restoredCode);
  console.log("Restored length:", restoredCode.length);
}
