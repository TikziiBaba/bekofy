const fs = require('fs');
const html = fs.readFileSync('src/pages/app.html', 'utf8');

let depth = 0;
const lines = html.split('\n');

for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (depth < 0) {
    console.log(`NEGATIVE DEPTH at line ${idx + 1}: ${line.trim()}`);
  }
}
console.log('Final depth:', depth);