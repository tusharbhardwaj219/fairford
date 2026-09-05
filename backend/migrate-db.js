/*
  migrate-db.js — one-time data copy from the OLD prod cluster to a NEW cluster.

  Copies every (non-system) collection from SOURCE → TARGET, preserving _id so
  all cross-references (orders → products, etc.) stay intact.

  SOURCE (prod, 5xpti30) URI  : env SRC_URI      (you supply this in your shell)
  TARGET (new cluster) URI    : env DST_URI, else MONGO_URI from .env (already set)

  Safety: a collection that ALREADY has documents in the target is SKIPPED (so a
  re-run never duplicates). To force a clean re-copy, drop that collection in the
  target first. Run from backend/ so the mongodb driver resolves.

  Windows PowerShell:
    $env:SRC_URI = "<PROD connection string>"
    node migrate-db.js
*/
require('dotenv/config');
const { MongoClient } = require('mongodb');

const SRC = process.env.SRC_URI;
const DST = process.env.DST_URI || process.env.MONGO_URI;

const hostOf = (u) => String(u || '').replace(/^.*@/, '').replace(/[/?].*$/, '');

if (!SRC) { console.error('❌ Set SRC_URI to the PROD (5xpti30) connection string first.'); process.exit(1); }
if (!DST) { console.error('❌ No target URI (DST_URI or MONGO_URI in .env).'); process.exit(1); }

(async () => {
  const src = new MongoClient(SRC, { serverSelectionTimeoutMS: 20000 });
  const dst = new MongoClient(DST, { serverSelectionTimeoutMS: 20000 });
  try {
    await src.connect();
    await dst.connect();
    const srcDb = src.db();
    const dstDb = dst.db();

    console.log('SOURCE :', srcDb.databaseName, '@', hostOf(SRC));
    console.log('TARGET :', dstDb.databaseName, '@', hostOf(DST));
    if (srcDb.databaseName !== dstDb.databaseName) {
      console.log(`⚠️  DB names differ — data lands in TARGET db "${dstDb.databaseName}". Your app URI must point to that db.`);
    }
    console.log('');

    const cols = (await srcDb.listCollections().toArray())
      .map(c => c.name)
      .filter(n => !n.startsWith('system.'));
    if (!cols.length) { console.log('Source has no collections — nothing to copy.'); process.exit(0); }

    const WIPE = process.env.WIPE_TARGET === '1';
    if (WIPE) console.log('⚠️  WIPE_TARGET=1 → each target collection is emptied before copying.\n');

    let grand = 0;
    for (const name of cols) {
      const docs = await srcDb.collection(name).find({}).toArray();
      const tgt = dstDb.collection(name);
      const existing = await tgt.countDocuments({});
      if (existing > 0) {
        if (WIPE) {
          await tgt.deleteMany({});
          console.log(`  • ${name}: cleared ${existing} old docs in target`);
        } else {
          console.log(`  • ${name}: target already has ${existing} docs — SKIPPED (run with WIPE_TARGET=1 to replace)`);
          continue;
        }
      }
      if (docs.length) await tgt.insertMany(docs, { ordered: false });
      console.log(`  • ${name}: copied ${docs.length}`);
      grand += docs.length;
    }
    console.log(`\n✅ DONE. Total documents copied: ${grand}`);
  } catch (e) {
    console.error('❌ MIGRATION ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await src.close().catch(() => {});
    await dst.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
