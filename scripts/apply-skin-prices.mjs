/**
 * Phase 2 — apply your custom prices to the local catalog.
 *
 * Do NOT run this until you provide a price list. This script never reads BloxDB prices.
 *
 * Expected input (JSON array or CSV with headers name,price):
 *   data/bloxdb/prices.json
 *   [{ "name": "Karambit | Fade", "price": 20300 }, ...]
 *
 * Usage (later):
 *   node scripts/apply-skin-prices.mjs --dry-run
 *   node scripts/apply-skin-prices.mjs --file data/bloxdb/prices.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FILE = path.join(ROOT, 'data', 'bloxdb', 'prices.json');
const GENERATED_TS = path.join(ROOT, 'src', 'data', 'skinCatalog.generated.ts');
const META_JSON = path.join(ROOT, 'data', 'bloxdb', 'skins-meta.json');

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[|_/\\]+/g, ' ')
    .replace(/\bknife\b/g, ' ')
    .replace(/\bm9\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs(argv) {
  const out = { dryRun: false, file: DEFAULT_FILE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    if (argv[i] === '--file') out.file = path.resolve(argv[++i]);
  }
  return out;
}

function loadPriceRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Price file not found: ${filePath}\nProvide your list first (see data/bloxdb/prices.example.json).`);
  }
  if (filePath.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) throw new Error('prices JSON must be an array');
    return data.map(row => ({
      name: String(row.name || row.skin || ''),
      price: Number(row.price),
      id: row.id ? String(row.id) : null,
    }));
  }
  if (filePath.endsWith('.csv')) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
    const header = lines.shift().split(',').map(s => s.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const priceIdx = header.indexOf('price');
    const idIdx = header.indexOf('id');
    if (nameIdx < 0 || priceIdx < 0) throw new Error('CSV needs name,price columns');
    return lines.map(line => {
      const cols = line.split(',');
      return {
        name: cols[nameIdx]?.trim() || '',
        price: Number(cols[priceIdx]),
        id: idIdx >= 0 ? cols[idIdx]?.trim() || null : null,
      };
    });
  }
  throw new Error('Unsupported file type (use .json or .csv)');
}

function parseGenerated(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const skins = [];
  const re = /\{\s*id:\s*'([^']+)',\s*name:\s*'((?:\\'|[^'])*)',\s*weapon:\s*'([^']+)',\s*rarity:\s*'([^']+)',\s*wear:\s*'([^']+)',\s*price:\s*(-?\d+(?:\.\d+)?),\s*image:\s*'((?:\\'|[^'])*)'\s*\}/g;
  let match;
  while ((match = re.exec(text))) {
    skins.push({
      id: match[1],
      name: match[2].replace(/\\'/g, "'"),
      weapon: match[3],
      rarity: match[4],
      wear: match[5],
      price: Number(match[6]),
      image: match[7].replace(/\\'/g, "'"),
    });
  }
  return skins;
}

function escapeTsString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(GENERATED_TS)) {
    throw new Error('Missing skinCatalog.generated.ts — run import-bloxdb-skins.mjs first');
  }

  const rows = loadPriceRows(opts.file);
  const skins = parseGenerated(GENERATED_TS);
  const byId = new Map(skins.map(s => [s.id, s]));
  const byNorm = new Map(skins.map(s => [normalizeName(s.name), s]));

  let metaById = {};
  if (fs.existsSync(META_JSON)) {
    metaById = JSON.parse(fs.readFileSync(META_JSON, 'utf8')).byId || {};
  }

  const unmatched = [];
  const ambiguous = [];
  let updated = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.price) || row.price < 0) {
      unmatched.push({ ...row, reason: 'invalid_price' });
      continue;
    }
    let target = row.id ? byId.get(row.id) : null;
    if (!target) {
      const norm = normalizeName(row.name);
      const hits = skins.filter(s => normalizeName(s.name) === norm);
      if (hits.length === 1) target = hits[0];
      else if (hits.length > 1) {
        ambiguous.push({ name: row.name, ids: hits.map(h => h.id) });
        continue;
      } else {
        // try meta sourceName
        const metaHit = Object.values(metaById).filter(m => normalizeName(m.sourceName) === norm || normalizeName(m.displayName) === norm);
        if (metaHit.length === 1) target = byId.get(metaHit[0].id);
      }
    }
    if (!target) {
      unmatched.push({ ...row, reason: 'not_found' });
      continue;
    }
    if (target.price !== row.price) {
      target.price = row.price;
      updated += 1;
    }
  }

  skins.sort((a, b) => {
    const byPrice = Number(b.price) - Number(a.price);
    if (byPrice !== 0) return byPrice;
    return a.name.localeCompare(b.name, 'en');
  });

  console.log(JSON.stringify({
    dryRun: opts.dryRun,
    file: opts.file,
    inputRows: rows.length,
    updated,
    unmatched: unmatched.length,
    ambiguous: ambiguous.length,
    unmatchedSample: unmatched.slice(0, 20),
    ambiguousSample: ambiguous.slice(0, 20),
  }, null, 2));

  if (opts.dryRun) return;

  const body = `/* AUTO-GENERATED by scripts/import-bloxdb-skins.mjs — prices updated by apply-skin-prices.mjs */
export const GENERATED_SKIN_CATALOG = [
${skins.map(s =>
    `  { id: '${escapeTsString(s.id)}', name: '${escapeTsString(s.name)}', weapon: '${escapeTsString(s.weapon)}', rarity: '${escapeTsString(s.rarity)}', wear: '${escapeTsString(s.wear)}', price: ${Number(s.price) || 0}, image: '${escapeTsString(s.image)}' },`,
  ).join('\n')}
] as const;
`;
  fs.writeFileSync(GENERATED_TS, body, 'utf8');
  console.log('[prices] catalog updated');
}

main();
