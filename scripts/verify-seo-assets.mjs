import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');

function fail(message) {
  console.error(`[seo] ${message}`);
  process.exit(1);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertValidSitemap(label, text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('<?xml')) {
    fail(`${label}: must start with <?xml`);
  }
  if (/<script[\s>]/i.test(trimmed) || /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    fail(`${label}: looks like HTML (scripts/DOCTYPE), not a sitemap`);
  }
  if (!trimmed.includes('http://www.sitemaps.org/schemas/sitemap/0.9')) {
    fail(`${label}: missing sitemap 0.9 namespace`);
  }
  if (!/<urlset[\s>]/i.test(trimmed) || !/<url[\s>]/i.test(trimmed) || !/<loc[\s>]/i.test(trimmed)) {
    fail(`${label}: missing urlset/url/loc structure`);
  }
  const locs = [...trimmed.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1].trim());
  if (locs.length < 2) {
    fail(`${label}: expected multiple public URLs, found ${locs.length}`);
  }
  for (const loc of locs) {
    if (!loc.startsWith('https://bloxupgrader.com/')) {
      fail(`${label}: non-canonical URL ${loc}`);
    }
  }
  console.log(`[seo] ${label}: ok (${locs.length} urls)`);
}

const publicSitemap = path.join(PUBLIC, 'sitemap.xml');
const distSitemap = path.join(DIST, 'sitemap.xml');
const publicRobots = path.join(PUBLIC, 'robots.txt');
const distRobots = path.join(DIST, 'robots.txt');

if (!fs.existsSync(publicSitemap)) fail('public/sitemap.xml missing');
assertValidSitemap('public/sitemap.xml', readUtf8(publicSitemap));

if (!fs.existsSync(publicRobots)) fail('public/robots.txt missing');
const robots = readUtf8(publicRobots);
if (!/Sitemap:\s*https:\/\/bloxupgrader\.com\/sitemap\.xml/i.test(robots)) {
  fail('public/robots.txt must reference https://bloxupgrader.com/sitemap.xml');
}
if (/Disallow:\s*\/sitemap/i.test(robots)) {
  fail('public/robots.txt must not disallow the sitemap');
}
console.log('[seo] public/robots.txt: ok');

// Keep dist in sync with public so static hosting and express.static never serve a stub.
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(publicSitemap, distSitemap);
fs.copyFileSync(publicRobots, distRobots);
assertValidSitemap('dist/sitemap.xml', readUtf8(distSitemap));
console.log('[seo] copied public SEO assets into dist/');
