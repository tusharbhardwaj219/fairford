const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, default: 'ret' },
  profileImage: {
    url:       { type: String, default: null },
    public_id: { type: String, default: null }
  }
}, { timestamps: true });

userSchema.methods.toSafe = function () {
  const { password, __v, ...rest } = this.toObject();
  return rest;
};

module.exports = mongoose.model('User', userSchema);
