/* =====================================================================
   upload-images.js — upload matched product + composition images to
   Cloudinary and attach them to the products (run AFTER import-products).

   Order is enforced: PRODUCT image = images[0]/primary, COMPOSITION = images[1].
   Only confident ('ok') matches from data/image-map.json are used; ambiguous
   and missing ones are skipped and listed (resolve them, then re-run).

   Usage (run from backend/, after `node import-products.js --apply`):
     node upload-images.js            # DRY-RUN: reports what it would upload
     node upload-images.js --apply    # uploads to Cloudinary + saves on products
   Needs CLOUDINARY_* in .env; reads MONGO_URI (new cluster) from .env.
   ===================================================================== */
require('dotenv/config');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/database');
const cloudinary = require('./config/cloudinary');
const Product = require('./models/Product');
require('./models/Category'); // register Category so Product's pre-find populate('category') works

const APPLY = process.argv.includes('--apply');
const MAP = path.join(__dirname, 'data', 'image-map.json');
const IMG = path.join(__dirname, '..', 'image');

async function upload(file, sub) {
  const abs = path.join(IMG, sub, file);
  if (!fs.existsSync(abs)) return null;
  const r = await cloudinary.uploader.upload(abs, { folder: 'fairford/products' });
  return { url: r.secure_url, public_id: r.public_id };
}

(async () => {
  const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  await connectDB();
  console.log(`\n${APPLY ? '=== APPLY (uploading) ===' : '=== DRY-RUN (no uploads) ==='}\n`);
  let set = 0, noProduct = 0, noImage = 0; const skipped = [];
  for (const m of map) {
    const prod = await Product.findOne({ name: m.name });
    if (!prod) { noProduct++; continue; }
    const plan = [];
    if (m.prod.status === 'ok' && m.prod.file) plan.push(['PRODUCT', m.prod.file, '']);
    if (m.comp.status === 'ok' && m.comp.file) plan.push(['COMPOSITION', m.comp.file, 'composition']);
    if (!plan.length) { noImage++; skipped.push(`${m.name}  [prod:${m.prod.status} comp:${m.comp.status}]`); continue; }
    if (APPLY) {
      const gallery = [];
      for (const [, file, sub] of plan) { const img = await upload(file, sub); if (img) gallery.push(img); }
      if (gallery.length) { prod.images = gallery.slice(0, 3); prod.image = gallery[0]; await prod.save(); set++; }
    } else { set++; console.log(`  ${m.name}: ${plan.map(x => x[0] + '=' + x[1]).join('  →  ')}`); }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: images on ${set} products | no matching product in DB: ${noProduct} | no confident image: ${noImage}`);
  if (skipped.length) { console.log('\nProducts skipped (resolve image match, then re-run):'); skipped.slice(0, 40).forEach(s => console.log('   - ' + s)); }
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
