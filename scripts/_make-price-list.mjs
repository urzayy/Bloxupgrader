import fs from 'fs';

const text = fs.readFileSync('src/data/skinCatalog.generated.ts', 'utf8');
const names = [...text.matchAll(/name: '([^']+)'/g)].map(m => m[1].replace(/\\'/g, "'"));
const unique = [...new Set(names)];
const body = ['Skin | precio', ...unique].join('\n') + '\n';
const out = 'data/bloxdb/precios-para-rellenar.txt';
fs.writeFileSync(out, body, 'utf8');
console.log(`Wrote ${unique.length} skins to ${out}`);
