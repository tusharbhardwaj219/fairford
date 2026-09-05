const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Force IPv4. On Windows the dual-stack resolver often fails the IPv6
      // (AAAA) lookup for Atlas shard hosts intermittently, surfacing as
      // "getaddrinfo ENOTFOUND ...mongodb.net" on background queries even
      // though the initial connect succeeded. IPv4-only avoids that.
      family: 4,
      serverSelectionTimeoutMS: 30000, // tolerate transient DNS/network blips
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
