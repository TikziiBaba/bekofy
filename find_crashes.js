const fs = require('fs');
const path = require('path');

const jsDir = 'src/js';
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    // Check for document.getElementById('...').something without optional chaining or check
    if (line.includes('document.getElementById(') && !line.includes('if (') && !line.includes('?.')) {
      if (line.includes(').childNodes') || line.includes(').textContent') || line.includes(').innerHTML') || line.includes(').style') || line.includes(').classList') || line.includes(').addEventListener')) {
        console.log(`Potential Crash in ${file}:${idx + 1} -> ${line.trim().substring(0, 100)}`);
      }
    }
  });
});
