import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = path.join(ROOT, 'src', 'data', 'skinCatalog.generated.ts');
const PRICE_FILE = path.join(ROOT, 'data', 'bloxdb', 'precios-para-rellenar.txt');

const PRICES = [4414, 4225, 4669, 1880, 1691, 2542, 2854, 1831, 3720, 1939, 1878, 1];

function parseSkins(text) {
  const skins = [];
  const re = /\{\s*id:\s*'([^']+)',\s*name:\s*'((?:\\'|[^'])*)',\s*weapon:\s*'([^']+)',\s*rarity:\s*'([^']+)',\s*wear:\s*'([^']+)',\s*price:\s*(-?\d+(?:\.\d+)?),\s*image:\s*'((?:\\'|[^'])*)'\s*\}/g;
  let m;
  while ((m = re.exec(text))) {
    skins.push({
      id: m[1],
      name: m[2].replace(/\\'/g, "'"),
      weapon: m[3],
      rarity: m[4],
      wear: m[5],
      price: Number(m[6]),
      image: m[7].replace(/\\'/g, "'"),
    });
  }
  return skins;
}

function escapeTs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const text = fs.readFileSync(GENERATED, 'utf8');
const skins = parseSkins(text);
const zero = skins.filter(s => !s.price || s.price <= 0);

if (zero.length !== PRICES.length) {
  throw new Error(`Expected ${PRICES.length} zero-price skins, found ${zero.length}`);
}

zero.forEach((s, i) => {
  s.price = PRICES[i];
  console.log(`${i + 1}. ${s.name} => ${PRICES[i]}`);
});

const byId = new Map(skins.map(s => [s.id, s]));
for (const z of zero) byId.get(z.id).price = z.price;

const all = [...byId.values()].sort((a, b) => {
  const byPrice = Number(b.price) - Number(a.price);
  if (byPrice !== 0) return byPrice;
  return a.name.localeCompare(b.name, 'en');
});

const body = `/* AUTO-GENERATED — zero-price skins filled */
export const GENERATED_SKIN_CATALOG = [
${all.map(s =>
    `  { id: '${escapeTs(s.id)}', name: '${escapeTs(s.name)}', weapon: '${escapeTs(s.weapon)}', rarity: '${escapeTs(s.rarity)}', wear: '${escapeTs(s.wear)}', price: ${Number(s.price) || 0}, image: '${escapeTs(s.image)}' },`,
  ).join('\n')}
] as const;
`;
fs.writeFileSync(GENERATED, body, 'utf8');

// Update precios notepad for these names when present / append if missing
if (fs.existsSync(PRICE_FILE)) {
  let priceText = fs.readFileSync(PRICE_FILE, 'utf8');
  for (const s of zero) {
    const lineRe = new RegExp(`^${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*\\d*\\s*$`, 'mi');
    if (lineRe.test(priceText)) {
      priceText = priceText.replace(lineRe, `${s.name} ${s.price}`);
    } else {
      priceText = priceText.replace(/\s*$/, `\n${s.name} ${s.price}\n`);
    }
  }
  fs.writeFileSync(PRICE_FILE, priceText, 'utf8');
}

console.log(`done. stillZero=${all.filter(s => !s.price).length}`);
