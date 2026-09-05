/* =====================================================================
   import-products.js — bulk-create categories + products in the NEW DB
   from data/products-final.json (parsed from the OTS Price List PDF).

   Prices: distributorPrice = PTS, retailerPrice = PTR, mrp = MRP.
   Safe & idempotent: a product whose `name` already exists is SKIPPED
   (never duplicated). Categories are created once and reused.

   Usage (run from backend/):
     node import-products.js            # DRY-RUN: validates everything, writes nothing
     node import-products.js --apply    # actually creates categories + products
   Reads MONGO_URI from .env (already the new cluster).
   ===================================================================== */
require('dotenv/config');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/database');
const Product = require('./models/Product');
const Category = require('./models/Category');

const APPLY = process.argv.includes('--apply');
const DATA = path.join(__dirname, 'data', 'products-final.json');

(async () => {
  const products = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  await connectDB();
  console.log(`\n${APPLY ? '=== APPLY ===' : '=== DRY-RUN (no writes) ==='}  source: ${products.length} products\n`);

  // ---- 1) categories ----
  const catNames = [...new Set(products.map(p => p.category))].sort();
  const catMap = {};
  for (const name of catNames) {
    let cat = await Category.findOne({ categoryName: name });
    if (!cat && APPLY) cat = await Category.create({ categoryName: name, categoryDescription: `${name} products`, isActive: true });
    catMap[name] = cat ? cat._id : new mongoose.Types.ObjectId(); // placeholder id in dry-run so validation can run
    console.log(`  category "${name}": ${cat ? 'ready ' + cat._id : (APPLY ? 'FAILED' : 'would create')}`);
  }

  // ---- 2) products ----
  let created = 0, skipped = 0, invalid = 0;
  const errors = [];
  for (const p of products) {
    const doc = {
      name: p.name, brand: p.brand || 'Fair Ford Pharmaceuticals',
      category: catMap[p.category], categoryName: p.category,
      strength: p.strength || '-', packSize: p.packSize || '-', dosageForm: p.dosageForm || 'Tablet',
      composition: p.composition || [], description: p.description || '', uses: p.uses || '',
      mrp: p.mrp, retailerPrice: p.retailerPrice, distributorPrice: p.distributorPrice,
      gst: [5, 12, 18].includes(p.gst) ? p.gst : 5, stock: p.stock ?? 100,
      status: p.status || 'active', tags: p.code ? ['code:' + p.code] : []
    };
    const existing = await Product.findOne({ name: p.name }).lean();
    if (existing) { skipped++; continue; }
    // validate against schema without writing
    const vErr = new Product(doc).validateSync();
    if (vErr) { invalid++; errors.push(`${p.name}: ${Object.keys(vErr.errors).join(', ')}`); continue; }
    if (APPLY) await Product.create(doc);
    created++;
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} summary:`);
  console.log(`  categories        : ${catNames.length}`);
  console.log(`  products created  : ${created}${APPLY ? '' : ' (would create)'}`);
  console.log(`  skipped (existing): ${skipped}`);
  console.log(`  INVALID (schema)  : ${invalid}`);
  if (errors.length) { console.log('\n  validation errors:'); errors.slice(0, 20).forEach(e => console.log('   - ' + e)); }
  console.log(APPLY ? '\nDone.' : '\nNo data written. Re-run with  --apply  to create categories + products.');
  await mongoose.disconnect();
  process.exit(invalid ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
