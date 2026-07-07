const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'metadata.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
data.requestFramePermissions = ["camera"];
fs.writeFileSync(p, JSON.stringify(data, null, 2));
