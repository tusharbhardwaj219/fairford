const Prescription = require('../models/Prescription');
const cloudinary   = require('../config/cloudinary');

// GET /api/prescriptions — list prescriptions for logged-in retailer
const getPrescriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { retailer: req.user._id };
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Prescription.countDocuments(filter);

    const prescriptions = await Prescription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({ success: true, prescriptions, total, page: Number(page) });
  } catch (err) {
    console.error('[prescription:get]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/prescriptions — upload a new prescription
const createPrescription = async (req, res) => {
  try {
    const { patientName, doctorName, hospitalName, prescriptionDate, medicines } = req.body;

    if (!patientName || !doctorName) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      return res.status(400).json({ success: false, message: 'Patient name and doctor name are required' });
    }

    const data = {
      retailer:    req.user._id,
      patientName: patientName.trim(),
      doctorName:  doctorName.trim(),
      hospitalName: hospitalName?.trim(),
      prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : new Date(),
      medicines:   medicines ? JSON.parse(medicines) : [],
    };

    if (req.file) {
      data.imageUrl      = req.file.path;
      data.imagePublicId = req.file.filename;
    }

    const prescription = await Prescription.create(data);

    return res.status(201).json({ success: true, message: 'Prescription uploaded', prescription });
  } catch (err) {
    if (req.file) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    console.error('[prescription:create]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/prescriptions/:id
const getPrescriptionById = async (req, res) => {
  try {
    const rx = await Prescription.findById(req.params.id);
    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });

    if (req.user.role === 'ret' && rx.retailer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, prescription: rx });
  } catch (err) {
    console.error('[prescription:getById]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/prescriptions/:id/verify — distributor or admin verifies a prescription
const verifyPrescription = async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
    }

    const rx = await Prescription.findById(req.params.id);
    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });

    rx.status           = status;
    rx.verifiedBy       = req.user._id;
    rx.verificationNote = note || '';
    rx.verifiedAt       = new Date();
    await rx.save();

    return res.status(200).json({ success: true, message: `Prescription ${status}`, prescription: rx });
  } catch (err) {
    console.error('[prescription:verify]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/prescriptions/:id
const deletePrescription = async (req, res) => {
  try {
    const rx = await Prescription.findById(req.params.id);
    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });

    if (rx.retailer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (rx.imagePublicId) {
      await cloudinary.uploader.destroy(rx.imagePublicId).catch(() => {});
    }

    await rx.deleteOne();

    return res.status(200).json({ success: true, message: 'Prescription deleted' });
  } catch (err) {
    console.error('[prescription:delete]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getPrescriptions, createPrescription, getPrescriptionById, verifyPrescription, deletePrescription };
