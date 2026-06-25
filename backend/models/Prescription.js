const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name:      String,
  quantity:  String,
  frequency: String,
  duration:  String,
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  prescriptionNumber: { type: String, unique: true },
  retailer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Retailer',
    required: true,
    index:    true,
  },
  patientName:   { type: String, required: true, trim: true },
  doctorName:    { type: String, required: true, trim: true },
  hospitalName:  { type: String, trim: true },
  prescriptionDate: { type: Date, default: Date.now },
  expiryDate:    Date,
  imageUrl:      String,
  imagePublicId: String,
  status: {
    type:    String,
    enum:    ['pending', 'verified', 'rejected'],
    default: 'pending',
    index:   true,
  },
  verifiedBy:       { type: mongoose.Schema.Types.ObjectId, default: null },
  verificationNote: String,
  verifiedAt:       Date,
  medicines:        [medicineSchema],
  order: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Order',
    default: null,
  },
}, { timestamps: true });

prescriptionSchema.pre('save', async function () {
  if (this.prescriptionNumber) return;
  const count = await mongoose.model('Prescription').countDocuments();
  const pad = String(count + 1).padStart(4, '0');
  const yr  = new Date().getFullYear();
  this.prescriptionNumber = `RX-${yr}-${pad}`;
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
