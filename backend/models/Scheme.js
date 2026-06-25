const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  schemeCode:  { type: String, unique: true, uppercase: true },
  schemeType: {
    type: String,
    enum: ['cashback', 'discount', 'bonus_units', 'flat_off'],
    required: true,
  },
  cashbackPercentage: { type: Number, default: 0 },
  discountPercentage: { type: Number, default: 0 },
  flatOff:            { type: Number, default: 0 },
  eligibleFor: {
    type:    String,
    enum:    ['distributor', 'retailer', 'both'],
    default: 'both',
  },
  eligibleTiers: [{
    type: String,
    enum: ['Silver', 'Gold', 'Platinum'],
  }],
  eligibleCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  eligibleProducts:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product'  }],
  minOrderValue: { type: Number, default: 0 },
  maxCashback:   { type: Number, default: null },
  validFrom:     { type: Date, required: true },
  validTo:       { type: Date, required: true },
  isActive:      { type: Boolean, default: true, index: true },
  terms:         [String],
  usageCount:    { type: Number, default: 0 },
}, { timestamps: true });

schemeSchema.pre('save', async function () {
  if (this.schemeCode) return;
  const count = await mongoose.model('Scheme').countDocuments();
  this.schemeCode = `UPHAAR-${String(count + 1).padStart(3, '0')}`;
});

schemeSchema.index({ validFrom: 1, validTo: 1, isActive: 1 });

module.exports = mongoose.model('Scheme', schemeSchema);
