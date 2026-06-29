/* =====================================================================
   fixStockStatus.js — one-shot cleanup

   Recomputes stockStatus on every product based on its current stock.
   Run this once after deploying the Product.findOneAndUpdate hook fix
   to repair products that already had stale stockStatus values.

   Usage (from main/backend/):
     node fixStockStatus.js
   ===================================================================== */

require('dotenv').config();
const connectDB = require('./config/database');
const Product = require('./models/Product');

(async () => {
  await connectDB();
  const products = await Product.find({}, null, { _recursed: true }).select('name stock stockStatus');

  let changed = 0;
  for (const p of products) {
    const next =
      p.stock <= 0 ? 'Out of Stock' :
      p.stock <= 50 ? 'Low Stock' :
      'In Stock';
    if (p.stockStatus !== next) {
      p.stockStatus = next;
      await p.save({ validateBeforeSave: false });
      changed += 1;
      console.log(`  ✓ ${p.name} — stock ${p.stock} → ${next}`);
    }
  }

  console.log(`\nDone. Repaired ${changed} of ${products.length} products.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
