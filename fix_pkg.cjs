const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts['db:fill-planograms']) {
  pkg.scripts['db:fill-planograms'] = 'tsx scripts/fill_planograms.ts';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
}
