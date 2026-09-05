const mongoose = require('mongoose');

// Log drops/reconnects once, so a transient blip is visible but not fatal. The
// driver reconnects on its own as long as the network/IP-allowlist permit.
let listenersBound = false;
const bindConnectionListeners = () => {
  if (listenersBound) return;
  listenersBound = true;
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected — driver will auto-reconnect'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[db] connection error:', e.message));
};

/**
 * Connect with retry + backoff so a TRANSIENT blip at startup (brief DNS/network
 * hiccup, Atlas failover) does NOT immediately kill the container — which is what
 * previously turned every deploy into a hard failure. Only after several failed
 * attempts do we exit(1). Once connected, the driver auto-reconnects on pool drops.
 */
const connectDB = async (retries = 5, delayMs = 5000) => {
  // Fail fast with a CLEAR message if the URI is missing/malformed. A bad
  // MONGO_URI (e.g. a hand-edited secret missing the scheme) otherwise throws a
  // cryptic driver error "Invalid scheme, expected connection string to start
  // with mongodb..." and bricks every new instance's boot. Retrying a malformed
  // URI is pointless, so this is checked once, before the retry loop.
  const uri = (process.env.MONGO_URI || '').trim();
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    console.error('FATAL: MONGO_URI is missing or malformed — it must start with "mongodb://" or "mongodb+srv://". '
      + 'Check the MONGO_URI secret/env value (a mangled value here brings the whole site down). '
      + 'Got prefix: ' + JSON.stringify(uri.slice(0, 15)));
    process.exit(1);
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        // Force IPv4. On Windows the dual-stack resolver often fails the IPv6
        // (AAAA) lookup for Atlas shard hosts intermittently, surfacing as
        // "getaddrinfo ENOTFOUND ...mongodb.net" even though the initial connect
        // succeeded. IPv4-only avoids that. (No effect on Cloud Run/Linux.)
        family: 4,
        serverSelectionTimeoutMS: 30000, // tolerate transient DNS/network blips
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      bindConnectionListeners();
      return conn;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error('MongoDB: all connection attempts failed — exiting.');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
