const mongoose = require('mongoose');

const retailerSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, default: 'ret' },
}, { timestamps: true });

retailerSchema.methods.toSafe = function () {
  const { password, __v, ...rest } = this.toObject();
  return rest;
};

module.exports = mongoose.model('Retailer', retailerSchema);
