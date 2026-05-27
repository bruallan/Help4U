import fs from 'fs';
const files = ['src/App.tsx', 'src/components/Dropdowns.tsx', 'src/components/Tooltips.tsx'];
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/blue-/g, 'orange-');
  fs.writeFileSync(file, text);
}
console.log('done replacing colors');
