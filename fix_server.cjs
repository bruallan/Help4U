const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('import { exec } from "child_process";', '');
fs.writeFileSync('server.ts', content);
