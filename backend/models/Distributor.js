const mongoose = require('mongoose');

const distributorSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, default: 'dist' },
}, { timestamps: true });

distributorSchema.methods.toSafe = function () {
  const { password, __v, ...rest } = this.toObject();
  return rest;
};

module.exports = mongoose.model('Distributor', distributorSchema);
