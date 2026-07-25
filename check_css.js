const fs = require('fs');
const css = fs.readFileSync('src/css/app.css', 'utf8');

const rules = css.match(/[^}]*(\{)[^}]*\}/g) || [];

rules.forEach((r, i) => {
  if (r.includes('page') || r.includes('main-content')) {
    console.log(`Rule ${i}:`, r.trim().replace(/\s+/g, ' '));
  }
});
