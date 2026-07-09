/* Read-only product diagnostic. Makes NO writes. Run from main/backend:
 *   node diagnose-products.js
 * Connects with the app's own MONGO_URI and reports what the storefront /
 * superadmin pages would see. */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI || '';
  const dbFromUri = (uri.match(/[^/]\/([^/?]+)(?:\?|$)/) || [])[1] || '(none in URI)';
  console.log('─'.repeat(56));
  console.log('MONGO_URI db name :', dbFromUri);
  try {
    await mongoose.connect(uri);
    console.log('Connected DB name :', mongoose.connection.name);

    const Product  = require('./models/Product');
    const Category = require('./models/Category');

    const total  = await Product.countDocuments();
    const active = await Product.countDocuments({ status: 'active' });
    const byStatus = await Product.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const cats   = await Category.countDocuments();

    console.log('─'.repeat(56));
    console.log('Products TOTAL    :', total, '   <- superadmin table shows this');
    console.log('Products ACTIVE   :', active, '   <- storefront shows this');
    console.log('By status         :', JSON.stringify(byStatus));
    console.log('Categories        :', cats);

    // ── Image coverage: how many products actually have a usable image URL ──
    const withImg = await Product.countDocuments({ 'image.url': { $nin: [null, ''] } });
    console.log('─'.repeat(56));
    console.log('WITH image.url    :', withImg, `of ${total}   (${total ? Math.round(withImg / total * 100) : 0}%)`);
    console.log('WITHOUT image     :', total - withImg, '  <- these render the category placeholder');
    // Show what the stored URLs look like (Cloudinary https vs local /Name.png)
    const withDocs = await Product.find({ 'image.url': { $nin: [null, ''] } }).select('name image.url').limit(3).lean();
    const withoutDocs = await Product.find({ $or: [{ 'image.url': null }, { 'image.url': '' }, { image: { $exists: false } }] }).select('name').limit(8).lean();
    console.log('Sample WITH img   :', JSON.stringify(withDocs.map(d => ({ name: d.name, url: d.image && d.image.url }))));
    console.log('Sample WITHOUT    :', JSON.stringify(withoutDocs.map(d => d.name)));

    // Broken category refs would still show in superadmin (no status filter),
    // so this is just extra signal.
    const sample = await Product.findOne().lean();
    if (sample) {
      console.log('─'.repeat(56));
      console.log('Sample product    :', JSON.stringify({
        name: sample.name,
        status: sample.status,
        stock: sample.stock,
        category: sample.category,
        categoryName: sample.categoryName,
        retailerPrice: sample.retailerPrice,
      }));
    }

    console.log('─'.repeat(56));
    if (total === 0)      console.log('VERDICT: collection is EMPTY — data was never written to this db.');
    else if (active === 0) console.log('VERDICT: products exist but NONE are status:active — storefront hidden, superadmin should still list them.');
    else                  console.log('VERDICT: products ARE present & active — problem is at request/render time, not the data.');

    await mongoose.disconnect();
  } catch (e) {
    console.error('CONNECT/QUERY ERROR:', e.message);
    process.exit(1);
  }
})();
