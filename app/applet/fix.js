import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');
lines.splice(706, 718 - 706);
fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
