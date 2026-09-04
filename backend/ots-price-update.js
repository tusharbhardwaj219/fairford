/* =====================================================================
   ots-price-update.js — apply the "OTS Price List 1st September 2026"
   pricing (and missing compositions) to the product catalogue.

   SOURCE OF TRUTH: ots-updates.json (generated from the PDF, human-reviewed).
   Each entry = { code, name, pts, ptr, mrp, composition|null }.
     pts -> distributorPrice   (Price To Stockist)
     ptr -> retailerPrice      (Price To Retailer)
     mrp -> mrp                (Maximum Retail Price)
     composition -> ONLY inserted when the product currently has none
                    (never overwrites an existing composition).

   It touches ONLY those four fields. Names, images, categories, GST, etc.
   are never modified. Products in the JSON that can't be matched are listed,
   not created (NUEVA VIDA / unknown products are intentionally excluded).

   Matching: by product `code` (tags "code:<code>") first, then by exact
   (case-insensitive) name. Only the 138 confident matches are in the JSON;
   the ~20 ambiguous/variant products were held out for manual confirmation.

   Usage (from main/backend/, with the target environment's .env):
     node ots-price-update.js            # DRY RUN — reports, writes nothing
     node ots-price-update.js --apply    # writes the changes

   Run against each environment separately (local .env and production point at
   different clusters). ALWAYS dry-run first and read the report.
   ===================================================================== */

require('dotenv').config();
const connectDB = require('./config/database');
const Product = require('./models/Product');
const updates = require('./ots-updates.json');

const APPLY = process.argv.includes('--apply');
const money = n => (Math.round(Number(n) * 100) / 100);
const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const rx = s => new RegExp('^' + String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
const codeOf = p => { const t = (p.tags || []).find(x => /^code:/i.test(String(x))); return t ? String(t).slice(5).trim() : ''; };

(async () => {
  await connectDB();

  // Load once; build code/name lookup maps.
  const all = await Product.find({}, null, { _recursed: true })
    .select('name tags distributorPrice retailerPrice mrp composition').lean();
  const byCode = {}, byName = {};
  all.forEach(p => {
    const c = codeOf(p); if (c) byCode[c] = p;
    byName[String(p.name || '').trim().toLowerCase()] = p;
  });

  let matched = 0, notFound = [], priceChanged = 0, compInserted = 0, compSkipped = 0, noChange = 0;
  console.log('\n' + (APPLY ? 'APPLYING' : 'DRY RUN — no changes will be written') +
    '  ·  ' + updates.length + ' products in the price list\n');

  for (const u of updates) {
    let prod = (u.code && byCode[u.code]) || byName[String(u.name).trim().toLowerCase()] || null;
    if (!prod) { notFound.push((u.code ? u.code + ' ' : '') + u.name); continue; }
    matched++;

    const set = {}, log = [];
    if (!eq(prod.distributorPrice, u.pts)) { set.distributorPrice = money(u.pts); log.push('PTS ' + prod.distributorPrice + '→' + money(u.pts)); }
    if (!eq(prod.retailerPrice, u.ptr))    { set.retailerPrice   = money(u.ptr); log.push('PTR ' + prod.retailerPrice + '→' + money(u.ptr)); }
    if (!eq(prod.mrp, u.mrp))              { set.mrp             = money(u.mrp); log.push('MRP ' + prod.mrp + '→' + money(u.mrp)); }
    if (log.length) priceChanged++;

    // Composition: insert ONLY when the product has none. Never overwrite.
    const hasComp = Array.isArray(prod.composition) && prod.composition.filter(Boolean).length > 0;
    if (u.composition && u.composition.length) {
      if (!hasComp) { set.composition = u.composition; log.push('COMPOSITION insert (' + u.composition.length + ' part' + (u.composition.length > 1 ? 's' : '') + ')'); compInserted++; }
      else compSkipped++;
    }

    if (!Object.keys(set).length) { noChange++; continue; }
    console.log('  ' + (APPLY ? '✓ ' : '· ') + (u.code || '------').padEnd(8) + ' ' + String(prod.name).slice(0, 34).padEnd(35) + ' :: ' + log.join('  |  '));
    if (APPLY) await Product.updateOne({ _id: prod._id }, { $set: set });
  }

  console.log('\n──────── SUMMARY ────────');
  console.log('matched products      :', matched, '/', updates.length);
  console.log('price changes         :', priceChanged);
  console.log('compositions inserted :', compInserted, APPLY ? '' : '(would insert)');
  console.log('compositions skipped  :', compSkipped, '(already present — left untouched)');
  console.log('already up to date    :', noChange);
  if (notFound.length) {
    console.log('\nNOT FOUND in this database (not updated, not created):');
    notFound.forEach(n => console.log('  -', n));
  }
  console.log('\n' + (APPLY ? 'Done — changes written.' : 'DRY RUN complete. Re-run with --apply to write.') + '\n');
  process.exit(0);
})().catch(err => { console.error('Failed:', err); process.exit(1); });
