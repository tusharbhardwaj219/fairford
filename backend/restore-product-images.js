/* =====================================================================
   restore-product-images.js — re-upload local product images to Cloudinary
   for products ALREADY in the DB whose stored image URL now 404s.

   Context: every product has an image.url pointing at fairford/products/... on
   Cloudinary, but those assets were deleted (all 404). The source images still
   live in ../image. This re-matches each product to a local file (same fuzzy
   matcher as importCatalog.js), uploads it, and updates the product document.

   USAGE (run from main/backend):
     node restore-product-images.js                 # DRY RUN (default) — checks
                                                     # URLs, matches files, writes nothing
     node restore-product-images.js --commit        # upload + update the broken ones
     node restore-product-images.js --commit --all  # process ALL products, even ones
                                                     # whose current URL still works

   Safe: dry run makes no writes/uploads. Idempotent: by default it skips any
   product whose current image URL already returns HTTP 200.
   ===================================================================== */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('./models/Product');

const ARGV   = process.argv.slice(2);
const COMMIT = ARGV.includes('--commit');
const ALL    = ARGV.includes('--all');
const IMAGES_DIR = path.join(__dirname, '..', 'image');

// ───────────────────── fuzzy matcher (ported from importCatalog.js) ─────────
const SKIP_FILES = new Set(['logo', 'map', '1', '2', '3']);
const NOISE = new Set([
  'pack', 'the', 'for', 'with', 'and', 'pc', 'strip', 'box', 'gm',
  'losse', 'loose', 'fairford', 'fariford', 'ff', 'pain', 'relief', 'nano',
  'hair', 'new',
]);
const FORM = new Set([
  'tablet', 'capsule', 'syrup', 'gel', 'cream', 'ointment', 'drop', 'powder',
  'sachet', 'suspension', 'solution', 'tonic', 'spray', 'oil', 'soap',
  'shampoo', 'toothpaste', 'mouthwash', 'roll', 'on', 'inhaler', 'rub', 'kit',
  'device', 'test', 'jar', 'eye', 'ear', 'nasal', 'softgel', 'soft', 'dry',
  'juice', 'drink', 'paste', 'sg',
]);
function canon(t) {
  if (/^(schet|schate|sachte|schat|sachets?)$/.test(t)) return 'sachet';
  if (/^(shot|short)$/.test(t)) return 'shot';
  if (/^drops?$/.test(t)) return 'drop';
  if (/^(vaporixing|vaporizing|vaporising)$/.test(t)) return 'vaporizing';
  if (/^calpsule$/.test(t)) return 'capsule';
  if (/^(table|tbalet|tablt)$/.test(t)) return 'tablet';
  if (/^srup$/.test(t)) return 'syrup';
  if (/^(paediatric|pediatric|paeditatric)$/.test(t)) return 'paediatric';
  return t;
}
function tokensOf(s) {
  return String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/).filter(Boolean).map(canon).filter(t => !NOISE.has(t));
}
function numSet(s) {
  return new Set((String(s).toLowerCase().match(/\d+\s*(?:ml|gm|g|mg|mcg|k)?/g) || [])
    .map(x => x.replace(/\s+/g, '')));
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}
const ratio = (a, b) => (!a && !b) ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length);
function describe(s) {
  const t = tokensOf(s);
  const core = t.filter(x => !FORM.has(x));
  return {
    brand: core[0] || t[0] || '',
    coreOrig: core.join(''),
    coreSorted: [...core].sort().join(''),
    forms: new Set(t.filter(x => FORM.has(x))),
    nums: numSet(s),
  };
}
function buildImageIndex(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  return fs.readdirSync(dir)
    .filter(f => exts.has(path.extname(f).toLowerCase()))
    .map(f => {
      const base = path.basename(f, path.extname(f));
      return { file: f, full: path.join(dir, f), base, ...describe(base) };
    })
    .filter(it => !SKIP_FILES.has(it.base.toLowerCase().trim()));
}
const OVERRIDES = {
  'Calcifair D3 nano Shot ( Butter scotch)': 'Calcifair D3 Short.png',
  'Calcifair D3 nano Shot (Orange)': 'Calcifair D3 Short A.png',
  'Omega - 3-6-9 Loose': 'OMEGA 3-6-9 Losse.png',
  'Omega - 3-6-9 Strip': 'OMEGA 3-6-9 Capsule.png',
  'Multi- Vitamin Syrup': 'Multivitamin Syrup.png',
  'Multi- Vitamin Syrup (Sugar Free)': 'Multivitamin SF Syrup.png',
};
function matchImage(index, name) {
  if (!index) return null;
  const p = describe(name);
  let best = null;
  for (const it of index) {
    const brandR = ratio(p.brand, it.brand);
    const pfx = (a, b) => a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)));
    if (brandR < 0.78 && !pfx(p.coreOrig, it.coreOrig)) continue;
    let coreR = Math.max(ratio(p.coreOrig, it.coreOrig), ratio(p.coreSorted, it.coreSorted));
    if (p.nums.size && it.nums.size && ![...p.nums].some(x => it.nums.has(x))) coreR *= 0.45;
    let formB = 0;
    if (p.forms.size && it.forms.size) formB = [...p.forms].some(x => it.forms.has(x)) ? 1 : -1;
    const sc = Math.max(0, Math.min(1, 0.25 * brandR + 0.72 * coreR + 0.03 * formB));
    if (!best || sc > best.score) best = { ...it, score: +sc.toFixed(3), brandR: +brandR.toFixed(2) };
  }
  if (!best) return null;
  best.how = best.score >= 0.90 ? 'exact' : best.score >= 0.80 ? 'auto' : best.score >= 0.66 ? 'review' : 'weak';
  return best.score >= 0.66 ? best : { ...best, rejected: true, how: 'weak' };
}
function resolveMatch(name, index) {
  if (index && OVERRIDES[name]) {
    const f = index.find(it => it.file === OVERRIDES[name]);
    if (f) return { ...f, score: 1, how: 'override', rejected: false };
  }
  const m = matchImage(index, name);
  return (m && !m.rejected) ? m : null;
}

// HEAD-check a URL; returns true if it responds 200.
async function urlOk(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.status === 200;
  } catch { return false; }
}

(async () => {
  const imgIndex = buildImageIndex(IMAGES_DIR);
  if (!imgIndex) { console.error(`No image folder at ${IMAGES_DIR}`); process.exit(1); }
  console.log(`Image folder: ${IMAGES_DIR}  (${imgIndex.length} usable files)`);
  console.log(`Mode: ${COMMIT ? 'COMMIT (will upload + write)' : 'DRY RUN (no writes)'}${ALL ? '  [--all]' : ''}`);

  await mongoose.connect(process.env.MONGO_URI);
  const cloudinary = COMMIT ? require('./config/cloudinary') : null;

  const products = await Product.find().select('name image images').lean();
  console.log(`Products in DB: ${products.length}`);
  console.log('─'.repeat(60));

  let broken = 0, ok = 0, matched = 0, unmatched = 0, uploaded = 0, updated = 0, failed = 0;
  const noMatch = [];

  for (const p of products) {
    const curUrl = p.image && p.image.url;
    if (!ALL) {
      if (await urlOk(curUrl)) { ok++; continue; }   // still works — leave it
    }
    broken++;

    const m = resolveMatch(p.name, imgIndex);
    if (!m) { unmatched++; noMatch.push(p.name); continue; }
    matched++;

    if (!COMMIT) continue;

    try {
      const up = await cloudinary.uploader.upload(m.full, {
        folder: 'fairford/products',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });
      uploaded++;
      const image = { url: up.secure_url, public_id: up.public_id };
      await Product.updateOne({ _id: p._id }, { $set: { image, images: [image] } });
      updated++;
    } catch (e) {
      failed++;
      console.error(`  ! FAILED ${p.name}: ${(e && (e.message || (e.error && e.error.message))) || e}`);
    }
  }

  console.log('─'.repeat(60));
  console.log(`Already OK (skipped) : ${ok}`);
  console.log(`Broken / to fix      : ${broken}`);
  console.log(`  matched to a file  : ${matched}`);
  console.log(`  NO local match     : ${unmatched}`);
  if (COMMIT) console.log(`Uploaded ${uploaded} | DB updated ${updated} | failed ${failed}`);
  if (noMatch.length) {
    console.log('\nProducts with NO local image match (stay on placeholder):');
    noMatch.forEach(n => console.log(`   • ${n}`));
  }
  if (!COMMIT) console.log('\nDRY RUN complete — nothing written. Re-run with --commit to apply.');

  await mongoose.disconnect();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
