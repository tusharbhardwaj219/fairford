/* =====================================================================
   dedupe-product-slugs.js — find & fix duplicate product slugs

   Two or more products can share a slug (e.g. a duplicated "Montufair-L"),
   which collapses them onto one /product/<slug> URL — one product becomes
   unreachable via the clean URL and the two are duplicate content.

   This script is NON-DESTRUCTIVE: it never deletes a product (deletion could
   orphan order references). For each colliding slug it keeps the OLDEST record
   on the original slug and re-slugs the newer duplicate(s) to <slug>-2, <slug>-3…
   so every product stays reachable and the collision is gone. Deciding whether
   the duplicate is a genuine separate SKU or an accidental double-entry to be
   merged/removed remains a human/business decision.

   Usage (from main/backend/):
     node dedupe-product-slugs.js            # DRY RUN — reports, writes nothing
     node dedupe-product-slugs.js --apply    # writes the re-slugs

   Run against each environment's DB separately (local .env ≠ production).
   ===================================================================== */

require('dotenv').config();
const connectDB = require('./config/database');
const Product = require('./models/Product');

const APPLY = process.argv.includes('--apply');

(async () => {
  await connectDB();
  const products = await Product.find({}, null, { _recursed: true })
    .select('name slug createdAt status')
    .sort({ createdAt: 1 })
    .lean();

  // group by slug
  const bySlug = {};
  products.forEach(p => { (bySlug[p.slug] = bySlug[p.slug] || []).push(p); });
  const dupes = Object.entries(bySlug).filter(([, list]) => list.length > 1);

  if (!dupes.length) {
    console.log('\n✓ No duplicate slugs found across ' + products.length + ' products.\n');
    process.exit(0);
  }

  console.log('\n' + (APPLY ? 'APPLYING' : 'DRY RUN — no changes will be written') +
    '. Found ' + dupes.length + ' colliding slug(s):\n');

  const existing = new Set(products.map(p => p.slug));
  let planned = 0;

  for (const [slug, list] of dupes) {
    console.log('  slug "' + slug + '" → ' + list.length + ' products:');
    // list is createdAt-ascending; keep [0], re-slug the rest.
    list.forEach((p, i) => {
      const keep = i === 0;
      console.log('    - ' + (keep ? '[keep] ' : '[reslug]') + ' ' + p.name +
        '  (id ' + p._id + ', ' + (p.status || 'active') + ', created ' + new Date(p.createdAt).toISOString().slice(0, 10) + ')');
    });
    for (let i = 1; i < list.length; i++) {
      let candidate = slug + '-' + (i + 1), n = i + 1;
      while (existing.has(candidate)) { n++; candidate = slug + '-' + n; }
      existing.add(candidate);
      planned++;
      console.log('        → new slug: ' + candidate);
      if (APPLY) {
        // update slug only; skip full validation/hooks to avoid re-slugging.
        await Product.updateOne({ _id: list[i]._id }, { $set: { slug: candidate } });
      }
    }
  }

  console.log('\n' + (APPLY ? 'Done. Re-slugged ' + planned + ' duplicate product(s).'
    : 'DRY RUN complete. ' + planned + ' product(s) would be re-slugged. Re-run with --apply to write.') + '\n');
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
