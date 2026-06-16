/* =====================================================================
   config/db.js — MongoDB Connection Configuration
   Establishes Mongoose connection to MongoDB with error handling
   ===================================================================== */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/medibridge';
    
    const connection = await mongoose.connect(mongoURI);

    console.log(`✓ MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
