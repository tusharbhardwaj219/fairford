/* =====================================================================
   importCatalog.js — one-shot bulk import of price-list products
   (Fair Ford OTS.xlsx -> products_new.json), with optional image
   matching + Cloudinary upload from a local folder.

   USAGE (run from main/backend):
     node importCatalog.js <products_new.json> [imagesDir] [--commit]

   Default is DRY RUN (no DB writes, no uploads): prints exactly what it
   WOULD create, the category breakdown, image matches, and any product
   that has no image. Add --commit to actually write + upload.

   Safety:
     - Idempotent: skips any product whose normalized name already exists
       in the DB (so re-running won't duplicate).
     - Every created product is tagged 'catalog-2026-27' so the whole
       batch can be found/undone in one query.
   ===================================================================== */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Category = require('./models/Category');

const [, , PRODUCTS_JSON, ARG2, ARG3] = process.argv;
const FLAGS = [ARG2, ARG3].filter(a => a && a.startsWith('--'));
const IMAGES_DIR = [ARG2, ARG3].find(a => a && !a.startsWith('--')) || null;
const COMMIT = FLAGS.includes('--commit');

if (!PRODUCTS_JSON) {
  console.error('Usage: node importCatalog.js <products_new.json> [imagesDir] [--commit]');
  process.exit(1);
}

// ───────────────────────── helpers ─────────────────────────
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(tablets?|capsules?|caps?|calpsule|syrups?)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

// Category from product name (final, storefront-facing names). Order matters:
// more specific forms first (e.g. "soft gel" before plain "gel").
function inferCategory(name) {
  const n = String(name).toLowerCase();
  if (/inject/.test(n)) return 'Injections';
  if (/drop/.test(n)) return 'Drops';
  if (/(soft\s*gel|softgel|calpsule|\bsg\b|omega|\bfq\b|musli)/.test(n)) return 'Capsules';
  if (/\bgel\b/.test(n)) return 'Gels';
  if (/(cream|ointment|roll[\s-]*on|\brub\b|balm|vapori|foot\s*care)/.test(n)) return 'Ointments';
  if (/capsule/.test(n)) return 'Capsules';
  if (/(syrup|suspension|solution|tonic|drink|\bshot\b|juice|elixir)/.test(n)) return 'Syrups';
  if (/(powder|dusting|sachet|sch[ae]t)/.test(n)) return 'Sachets & Powders';
  if (/(shampoo|soap|tooth\s*paste|toothpaste|mouth\s*wash|mouthwash|\boil\b|inhaler)/.test(n)) return 'Personal Care';
  if (/tablet|\bdt\b/.test(n)) return 'Tablets';
  return 'Tablets';  // fallback (most remaining are tablets)
}

const DOSAGE = {
  Tablets: 'Tablet', Capsules: 'Capsule', Syrups: 'Syrup', Drops: 'Drops',
  Gels: 'Gel', Ointments: 'Cream', 'Sachets & Powders': 'Sachet/Powder',
  'Personal Care': 'Personal Care',
};

function firstStrength(comp) {
  const m = String(comp || '').match(/([\d.]+)\s*(mg|mcg|g|gm|ml|iu|i\.u\.|%)/i);
  return m ? `${m[1]}${m[2]}`.replace(/\s+/g, '') : '-';
}

function compArray(comp) {
  return String(comp || '')
    .split('+')
    .map(s => s.trim())
    .filter(Boolean);
}

// ───────────────────── fuzzy image matching ─────────────────────
// Non-product files in the folder to ignore outright.
const SKIP_FILES = new Set(['logo', 'map', '1', '2', '3']);

// Pure-noise tokens removed from both sides (brand prefix + packaging filler).
const NOISE = new Set([
  'pack', 'the', 'for', 'with', 'and', 'pc', 'strip', 'box', 'gm',
  'losse', 'loose', 'fairford', 'fariford', 'ff', 'pain', 'relief', 'nano',
  'hair', 'new',
]);
// Dosage/packaging FORM words: removed from the core match key (so a filename
// that omits "Capsule" still matches) but kept as a tie-breaker so a brand's
// syrup vs tablet images don't swap.
const FORM = new Set([
  'tablet', 'capsule', 'syrup', 'gel', 'cream', 'ointment', 'drop', 'powder',
  'sachet', 'suspension', 'solution', 'tonic', 'spray', 'oil', 'soap',
  'shampoo', 'toothpaste', 'mouthwash', 'roll', 'on', 'inhaler', 'rub', 'kit',
  'device', 'test', 'jar', 'eye', 'ear', 'nasal', 'softgel', 'soft', 'dry',
  'juice', 'drink', 'paste', 'sg',
]);

// Canonicalize spelling variants / common typos so they collide.
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

// Exact hand-mappings for sub-variants the fuzzy matcher can't tell apart
// (flavor/packaging differences not reflected distinctly in filenames).
const OVERRIDES = {
  'Calcifair D3 nano Shot ( Butter scotch)': 'Calcifair D3 Short.png',
  'Calcifair D3 nano Shot (Orange)': 'Calcifair D3 Short A.png',
  'Omega - 3-6-9 Loose': 'OMEGA 3-6-9 Losse.png',
  'Omega - 3-6-9 Strip': 'OMEGA 3-6-9 Capsule.png',
  'Multi- Vitamin Syrup': 'Multivitamin Syrup.png',
  'Multi- Vitamin Syrup (Sugar Free)': 'Multivitamin SF Syrup.png',
};

// Best fuzzy match. Brand-gated (Oflofair never grabs Moxifair), ranked on a
// core key matched both in-order and sorted (handles tokenization + word-order
// differences), number-conflict penalty, small form-word tie-breaker.
function matchImage(index, product) {
  if (!index) return null;
  const p = describe(product.name);
  let best = null;
  for (const it of index) {
    const brandR = ratio(p.brand, it.brand);
    // brand gate — first-token similarity, with a prefix fallback for brands
    // that tokenize differently (e.g. "Multi Vitamin" vs "Multivitamin").
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

// ───────────────────── category upsert ─────────────────────
const catCache = new Map();
async function getCategoryId(name) {
  if (catCache.has(name)) return catCache.get(name);
  let cat = await Category.findOne({ categoryName: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (!cat && COMMIT) cat = await Category.create({ categoryName: name, categoryDescription: `${name} products` });
  const id = cat ? cat._id : null;
  catCache.set(name, id);
  return id;
}

// ───────────────────────── main ─────────────────────────
(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
  const imgIndex = buildImageIndex(IMAGES_DIR);

  // existing names for idempotent skip
  const existing = await Product.find({}, 'name').lean();
  const existingKeys = new Set(existing.map(e => normKey(e.name)));

  const usedImages = new Set();
  const plan = [];
  const catCount = {};
  let willSkip = 0;

  for (const p of products) {
    const key = normKey(p.name);
    if (existingKeys.has(key)) { willSkip++; continue; }

    const category = inferCategory(p.name);
    catCount[category] = (catCount[category] || 0) + 1;

    let m = matchImage(imgIndex, p);
    if (imgIndex && OVERRIDES[p.name]) {
      const f = imgIndex.find(it => it.file === OVERRIDES[p.name]);
      if (f) m = { ...f, score: 1, how: 'override', rejected: false };
    }
    const img = (m && !m.rejected) ? m : null;
    const bestFile = m ? `${m.file} (${m.score})` : null;
    if (img) usedImages.add(img.file);

    plan.push({
      name: p.name.trim(),
      category,
      dosageForm: DOSAGE[category] || '-',
      strength: firstStrength(p.comp),
      packSize: (p.strip || p.box || '-').trim(),
      composition: compArray(p.comp),
      mrp: round2(p.mrp),
      retailerPrice: round2(p.ptr),
      distributorPrice: round2(p.pts),
      gst: 5,
      stock: 100,
      code: p.code,
      scheme: p.scheme,
      img,
      bestFile,
    });
  }

  console.log(`\n================= ${COMMIT ? 'COMMIT' : 'DRY RUN'} =================`);
  console.log(`Input rows: ${products.length} | already-in-DB (skip): ${willSkip} | to create: ${plan.length}`);
  console.log('\nCategory breakdown:');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  if (imgIndex) {
    const byHow = (h) => plan.filter(p => p.img && p.img.how === h);
    const matched = plan.filter(p => p.img).length;
    console.log(`\nImages: folder ${imgIndex.length} usable files | matched ${matched}/${plan.length}` +
      ` (exact ${byHow('exact').length}, auto ${byHow('auto').length}, review ${byHow('review').length}) | no image ${plan.length - matched}`);

    console.log('\n⚠ REVIEW these medium-confidence matches (0.72–0.86):');
    byHow('review').sort((a, b) => a.img.score - b.img.score)
      .forEach(p => console.log(`   ${p.img.score}  "${p.name}"  ->  ${p.img.file}`));

    console.log('\n✗ Products with NO image (best candidate was too weak):');
    plan.filter(p => !p.img).forEach(p => console.log(`   "${p.name}"  (best: ${p.bestFile || '—'})`));

    const unused = imgIndex.filter(it => !usedImages.has(it.file)).map(it => it.file);
    console.log(`\nUnused image files (${unused.length}): ${unused.join(', ')}`);

    // write full reviewable CSV
    const csv = ['product,category,matched_file,score,confidence',
      ...plan.map(p => [p.name, p.category, p.img ? p.img.file : '', p.img ? p.img.score : '', p.img ? p.img.how : 'NONE']
        .map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const csvPath = path.join(path.dirname(PRODUCTS_JSON), 'image_match_review.csv');
    fs.writeFileSync(csvPath, csv);
    console.log(`\nFull match table -> ${csvPath}`);
  } else {
    console.log('\n(no images dir given — products would be created without images)');
  }

  if (!COMMIT) {
    console.log('\nSample of products to create:');
    plan.slice(0, 8).forEach(p =>
      console.log(`  • ${p.name} [${p.category}] PTS ${p.distributorPrice} / PTR ${p.retailerPrice} / MRP ${p.mrp}` +
                  ` | img: ${p.img ? p.img.file + ' (' + p.img.how + ')' : 'NONE'}`));
    console.log('\nDRY RUN complete — no DB writes. Re-run with --commit to apply.');
    await mongoose.disconnect();
    return;
  }

  // ───────── COMMIT ─────────
  const cloudinary = require('./config/cloudinary');
  let created = 0, uploaded = 0, failed = 0;
  for (const p of plan) {
    try {
      const categoryId = await getCategoryId(p.category);
      let image = { url: null, public_id: null };
      let images = [];
      if (p.img) {
        const up = await cloudinary.uploader.upload(p.img.full, {
          folder: 'fairford/products',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        });
        image = { url: up.secure_url, public_id: up.public_id };
        images = [image];
        uploaded++;
      }
      await Product.create({
        name: p.name,
        brand: 'Fair Ford Pharma',
        category: categoryId,
        categoryName: p.category,
        strength: p.strength,
        packSize: p.packSize,
        dosageForm: p.dosageForm,
        composition: p.composition,
        description: `${p.composition.join(' + ')}${p.scheme ? ' | Scheme: ' + p.scheme : ''}`.slice(0, 990),
        mrp: p.mrp,
        retailerPrice: p.retailerPrice,
        distributorPrice: p.distributorPrice,
        gst: p.gst,
        stock: p.stock,
        image,
        images,
        status: 'active',
        tags: ['catalog-2026-27', p.code ? `code:${p.code}` : null].filter(Boolean),
      });
      created++;
    } catch (e) {
      failed++;
      const msg = (e && (e.message || (e.error && e.error.message))) ||
                  (e && Object.keys(e).length ? JSON.stringify(e) : String(e));
      console.error(`  ! FAILED ${p.name}: ${msg}`);
    }
  }
  console.log(`\nCOMMIT done — created: ${created} | images uploaded: ${uploaded} | failed: ${failed}`);
  await mongoose.disconnect();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
