const fs = require('fs');
const file = 'app/applet/src/App.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
lines.splice(1356, 27); // Delete lines 1357 - 1383
fs.writeFileSync(file, lines.join('\n'));
console.log('Done cleaning');
