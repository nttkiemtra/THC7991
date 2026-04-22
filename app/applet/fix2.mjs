import * as fs from 'node:fs';
const lines = fs.readFileSync('/app/applet/src/App.tsx', 'utf-8').split('\n');
// We want to delete duplicate lines after line 705
lines.splice(705, 13);
fs.writeFileSync('/app/applet/src/App.tsx', lines.join('\n'), 'utf-8');
