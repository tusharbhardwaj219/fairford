/* test-source.js — checks whether we can READ the prod (source) cluster.
   Run:  $env:SRC_URI='<prod connection string>'   (SINGLE quotes!)
         node test-source.js                                             */
const { MongoClient } = require('mongodb');
const SRC = process.env.SRC_URI;
if (!SRC) { console.error('❌ SRC_URI not set. In PowerShell:  $env:SRC_URI=\'<prod uri>\'  (single quotes)'); process.exit(1); }
const host = SRC.replace(/^.*@/, '').replace(/[/?].*$/, '').split(',')[0];
(async () => {
  console.log('Testing SOURCE (prod):', host);
  const c = new MongoClient(SRC, { serverSelectionTimeoutMS: 12000 });
  try {
    await c.connect();
    const db = c.db();
    const products = await db.collection('products').countDocuments({});
    const categories = await db.collection('categories').countDocuments({});
    console.log(`✅ CONNECTED.  db=${db.databaseName}  products=${products}  categories=${categories}`);
    console.log(products > 0
      ? '👉 Source has your data — migration will work. Run migrate-db.js next (same SRC_URI).'
      : '⚠️ Connected but products=0 — this may be the wrong cluster/db. Check the URI.');
  } catch (e) {
    console.log('❌ CANNOT READ PROD:', e.message.split('\n')[0]);
    console.log('   • "IP ... whitelisted"  → your laptop IP 122.183.40.19 is NOT on the 5xpti30 cluster; add it in Network Access.');
    console.log('   • "Authentication failed" → the prod URI/password is wrong.');
    console.log('   • "querySrv" / timeout    → the URI host is wrong, or the SRC_URI was not single-quoted.');
  } finally { await c.close().catch(() => {}); process.exit(0); }
})();
