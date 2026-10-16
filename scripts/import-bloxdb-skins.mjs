/**
 * Import BloxDB skin catalog into the local BloxUpgrader catalog.
 *
 * Source (verified): GET https://www.bloxdb.net/api/skins.php  → JSON array
 * Images:           https://www.bloxdb.net/{skin.image}
 *
 * Usage:
 *   node scripts/import-bloxdb-skins.mjs --dry-run
 *   node scripts/import-bloxdb-skins.mjs
 *   node scripts/import-bloxdb-skins.mjs --skip-images
 *
 * Rules:
 * - Localhost / repo only (does not deploy).
 * - Never imports BloxDB prices (`value` is ignored).
 * - New skins get price 0 until you run apply-skin-prices later.
 * - Existing local skins matched by normalized name keep id + price.
 * - Never deletes skins missing from a run.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BLOXDB_API = 'https://www.bloxdb.net/api/skins.php';
const BLOXDB_ORIGIN = 'https://www.bloxdb.net';
const USER_AGENT = 'BloxUpgraderLocalImporter/1.0 (+localhost; catalog sync; no production)';

const OUT_DIR = path.join(ROOT, 'data', 'bloxdb');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'skins');
const GENERATED_TS = path.join(ROOT, 'src', 'data', 'skinCatalog.generated.ts');
const META_JSON = path.join(OUT_DIR, 'skins-meta.json');
const RAW_JSON = path.join(OUT_DIR, 'skins-raw.json');
const REPORT_JSON = path.join(OUT_DIR, 'last-import-report.json');
const LEGACY_SKINS_TS = path.join(ROOT, 'src', 'data', 'skins.ts');
const LEGACY_SKINS_BAK = path.join(OUT_DIR, 'legacy-skins.ts.bak');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_IMAGES = args.has('--skip-images');
const CONCURRENCY = 6;

const RARITY_MAP = {
  Forbidden: 'extraordinary',
  Special: 'extraordinary',
  Red: 'covert',
  Pink: 'classified',
  Purple: 'restricted',
  Blue: 'milspec',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: options.accept || '*/*',
          ...(options.headers || {}),
        },
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(500 * (i + 1) ** 2);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (error) {
      lastError = error;
      await sleep(400 * (i + 1));
    }
  }
  throw lastError;
}

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

function shortWeaponLabel(weaponName, type) {
  let label = String(weaponName || '').trim();
  if (String(type || '').toLowerCase() === 'knife') {
    label = label.replace(/\s*knife$/i, '').replace(/^m9\s+/i, '').trim();
  }
  return label;
}

function formatDisplayName(weaponName, finish, type) {
  const label = shortWeaponLabel(weaponName, type);
  const finishName = String(finish || '').trim();
  if (!label) return finishName || 'Unknown';
  if (!finishName) return label;
  return `${label} | ${finishName}`;
}

function mapWeaponCategory(type, weaponName) {
  const t = String(type || '').toLowerCase();
  const w = String(weaponName || '').toLowerCase();
  if (t === 'knife') return 'Knife';
  if (t === 'gloves') return 'Gloves';
  if (w === 'awp') return 'AWP';
  if (t === 'pistol') return 'Pistol';
  if (t === 'smg') return 'SMG';
  if (t.includes('sniper')) return 'Rifle';
  if (t === 'rifle' || t === 'shotgun' || t === 'machine gun' || t === 'heavy' || t === 'equipment') {
    return 'Rifle';
  }
  return 'Rifle';
}

function mapRarity(bloxRarity) {
  return RARITY_MAP[bloxRarity] || 'milspec';
}

function slugifyIdPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function parseExistingSkinsFromTs(filePath) {
  if (!fs.existsSync(filePath)) return [];
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

function parseGeneratedSkins(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return parseExistingSkinsFromTs(filePath);
}

function loadLocalCatalog() {
  const generated = parseGeneratedSkins(GENERATED_TS);
  if (generated.length) return generated;
  const fromTs = parseExistingSkinsFromTs(LEGACY_SKINS_TS);
  if (fromTs.length) return fromTs;
  return parseExistingSkinsFromTs(LEGACY_SKINS_BAK);
}

function escapeTsString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function isValidImageBuffer(buf) {
  if (!buf || buf.length < 24) return false;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // WebP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  return false;
}

async function downloadImage(sourceUrl, destPath) {
  if (fs.existsSync(destPath)) {
    const existing = fs.readFileSync(destPath);
    if (isValidImageBuffer(existing)) {
      return { status: 'skipped', bytes: existing.length };
    }
  }
  const res = await fetchWithRetry(sourceUrl, { accept: 'image/*' });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidImageBuffer(buf)) {
    throw new Error(`invalid image bytes from ${sourceUrl}`);
  }
  if (!DRY_RUN) {
    ensureDir(path.dirname(destPath));
    fs.writeFileSync(destPath, buf);
  }
  return { status: 'downloaded', bytes: buf.length };
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function writeGeneratedTs(skins) {
  const lines = skins.map(s =>
    `  { id: '${escapeTsString(s.id)}', name: '${escapeTsString(s.name)}', weapon: '${escapeTsString(s.weapon)}', rarity: '${escapeTsString(s.rarity)}', wear: '${escapeTsString(s.wear)}', price: ${Number(s.price) || 0}, image: '${escapeTsString(s.image)}' },`,
  );
  const body = `/* AUTO-GENERATED by scripts/import-bloxdb-skins.mjs — do not edit by hand */
export const GENERATED_SKIN_CATALOG = [
${lines.join('\n')}
] as const;
`;
  if (!DRY_RUN) {
    ensureDir(path.dirname(GENERATED_TS));
    fs.writeFileSync(GENERATED_TS, body, 'utf8');
  }
}

async function main() {
  console.log(`[bloxdb-import] dryRun=${DRY_RUN} skipImages=${SKIP_IMAGES}`);
  ensureDir(OUT_DIR);
  ensureDir(IMG_DIR);

  const localSkins = loadLocalCatalog();
  console.log(`[bloxdb-import] local catalog loaded: ${localSkins.length}`);

  const byNorm = new Map();
  for (const skin of localSkins) {
    byNorm.set(normalizeName(skin.name), skin);
  }

  console.log(`[bloxdb-import] fetching ${BLOXDB_API}`);
  const apiRes = await fetchWithRetry(BLOXDB_API, { accept: 'application/json' });
  const raw = await apiRes.json();
  if (!Array.isArray(raw)) throw new Error('BloxDB API did not return an array');

  if (!DRY_RUN) {
    fs.writeFileSync(RAW_JSON, JSON.stringify(raw, null, 2), 'utf8');
  }

  const skinRows = raw.filter(row => String(row?.information?.category || '') === 'Skin');
  const skippedOther = raw.length - skinRows.length;
  console.log(`[bloxdb-import] api rows=${raw.length} skins=${skinRows.length} skippedOther=${skippedOther}`);

  const report = {
    fetchedAt: new Date().toISOString(),
    source: BLOXDB_API,
    dryRun: DRY_RUN,
    apiTotal: raw.length,
    skinsConsidered: skinRows.length,
    skippedNonSkin: skippedOther,
    matchedExisting: 0,
    insertedNew: 0,
    imagesDownloaded: 0,
    imagesSkippedExisting: 0,
    imageErrors: [],
    keptLocalOnly: 0,
    catalogSize: 0,
  };

  const metaById = {};
  const imported = [];
  const imageJobs = [];

  for (const row of skinRows) {
    const type = row.information?.type || '';
    const weaponName = row.information?.weapon || row.weapon_data?.name || '';
    const finish = row.finish || '';
    const displayName = formatDisplayName(weaponName, finish, type);
    const norm = normalizeName(displayName);
    const existing = byNorm.get(norm);
    const rarity = mapRarity(row.rarity);
    const weapon = mapWeaponCategory(type, weaponName);
    const sourceImagePath = String(row.image || '').replace(/^\/+/, '');
    const sourceImageUrl = sourceImagePath
      ? `${BLOXDB_ORIGIN}/${sourceImagePath}`
      : '';
    const slug = row.slug || slugifyIdPart(displayName);
    const localImageRel = `/images/skins/${slug}.png`;
    const localImageAbs = path.join(IMG_DIR, `${slug}.png`);

    const id = existing?.id || `skin_bloxdb_${String(row.id).padStart(3, '0')}_${slugifyIdPart(slug)}`;
    // Never import BloxDB economic value.
    const price = existing ? Number(existing.price) || 0 : 0;

    if (existing) report.matchedExisting += 1;
    else report.insertedNew += 1;

    if (!SKIP_IMAGES && sourceImageUrl) {
      imageJobs.push({ slug, sourceImageUrl, localImageAbs });
    }

    const image = fs.existsSync(localImageAbs)
      ? localImageRel
      : (existing?.image?.startsWith('/images/skins/')
        ? existing.image
        : localImageRel);

    const skin = {
      id,
      name: displayName,
      weapon,
      rarity,
      wear: existing?.wear || 'Field-Tested',
      price,
      image,
    };
    imported.push(skin);

    metaById[id] = {
      id,
      sourceId: String(row.id),
      sourceSlug: slug,
      sourceName: row.name,
      normalizedName: norm,
      displayName,
      sourceImageUrl,
      localImage: localImageRel,
      raritySource: row.rarity,
      weaponSource: weaponName,
      typeSource: type,
      case: row.case || null,
      collection: row.collection || null,
    };

    byNorm.set(norm, skin);
  }

  if (DRY_RUN && !args.has('--with-images')) {
    console.log(`[bloxdb-import] dry-run: skipping image downloads (${imageJobs.length} would be fetched). Use --with-images to test downloads.`);
  } else if (!SKIP_IMAGES && imageJobs.length) {
    console.log(`[bloxdb-import] downloading up to ${imageJobs.length} images (concurrency=${CONCURRENCY})`);
    let done = 0;
    await mapPool(imageJobs, CONCURRENCY, async (job) => {
      try {
        const result = await downloadImage(job.sourceImageUrl, job.localImageAbs);
        if (result.status === 'downloaded') report.imagesDownloaded += 1;
        else report.imagesSkippedExisting += 1;
      } catch (error) {
        report.imageErrors.push({
          slug: job.slug,
          sourceImageUrl: job.sourceImageUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        console.warn(`[bloxdb-import] image failed ${job.slug}: ${error instanceof Error ? error.message : error}`);
      } finally {
        done += 1;
        if (done % 25 === 0 || done === imageJobs.length) {
          console.log(`[bloxdb-import] images progress ${done}/${imageJobs.length}`);
        }
      }
    });

    // Point every imported BloxDB skin at local file when present.
    for (const skin of imported) {
      const meta = metaById[skin.id];
      if (!meta) continue;
      const abs = path.join(ROOT, 'public', meta.localImage.replace(/^\//, ''));
      if (fs.existsSync(abs) || DRY_RUN) {
        skin.image = meta.localImage;
      }
    }
  }

  // Keep local-only skins (packages/cases/legacy) that BloxDB did not include.
  const importedIds = new Set(imported.map(s => s.id));
  for (const local of localSkins) {
    if (importedIds.has(local.id)) continue;
    const alreadyByName = imported.some(s => normalizeName(s.name) === normalizeName(local.name));
    if (alreadyByName) continue;
    imported.push(local);
    report.keptLocalOnly += 1;
  }

  imported.sort((a, b) => {
    const byPrice = Number(b.price) - Number(a.price);
    if (byPrice !== 0) return byPrice;
    return a.name.localeCompare(b.name, 'en');
  });

  report.catalogSize = imported.length;

  // Sequential image downloads already done above; if we want concurrency, refactor later.
  // (Kept sequential for clearer progress / fewer rate limits.)

  console.log(`[bloxdb-import] matched=${report.matchedExisting} new=${report.insertedNew} keptLocal=${report.keptLocalOnly}`);
  console.log(`[bloxdb-import] images downloaded=${report.imagesDownloaded} reused=${report.imagesSkippedExisting} errors=${report.imageErrors.length}`);
  console.log(`[bloxdb-import] catalog size=${report.catalogSize}`);

  if (DRY_RUN) {
    console.log('[bloxdb-import] dry-run complete — no files written');
    console.log(JSON.stringify({
      sample: imported.slice(0, 5),
      pricesNonZero: imported.filter(s => s.price > 0).length,
      pricesZero: imported.filter(s => s.price === 0).length,
      imagePathSample: imported.slice(0, 3).map(s => s.image),
    }, null, 2));
    return;
  }

  writeGeneratedTs(imported);
  fs.writeFileSync(META_JSON, JSON.stringify({
    updatedAt: report.fetchedAt,
    source: BLOXDB_API,
    count: Object.keys(metaById).length,
    byId: metaById,
  }, null, 2), 'utf8');
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[bloxdb-import] wrote ${path.relative(ROOT, GENERATED_TS)}`);
  console.log(`[bloxdb-import] wrote ${path.relative(ROOT, META_JSON)}`);
  console.log(`[bloxdb-import] wrote ${path.relative(ROOT, REPORT_JSON)}`);
}

main().catch(error => {
  console.error('[bloxdb-import] FAILED', error);
  process.exit(1);
});
