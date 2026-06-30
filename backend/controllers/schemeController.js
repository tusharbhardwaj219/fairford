const Scheme = require('../models/Scheme');

// GET /api/schemes/all — paginated list for admin
const getAllSchemes = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip     = (Number(page) - 1) * Number(limit);
    const total    = await Scheme.countDocuments(filter);
    const schemes  = await Scheme.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    return res.status(200).json({ success: true, schemes, total, page: Number(page) });
  } catch (err) {
    console.error('[scheme:getAll]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/schemes/:id
const getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id)
      .populate('eligibleCategories', 'categoryName')
      .populate('eligibleProducts',   'name brand');
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    return res.status(200).json({ success: true, scheme });
  } catch (err) {
    console.error('[scheme:getById]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/schemes — create a scheme (admin/dist)
const createScheme = async (req, res) => {
  try {
    const scheme = await Scheme.create(req.body);
    return res.status(201).json({ success: true, message: 'Scheme created', scheme });
  } catch (err) {
    console.error('[scheme:create]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/schemes/:id
const updateScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    return res.status(200).json({ success: true, message: 'Scheme updated', scheme });
  } catch (err) {
    console.error('[scheme:update]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/schemes/:id
const deleteScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findByIdAndDelete(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    return res.status(200).json({ success: true, message: 'Scheme deleted' });
  } catch (err) {
    console.error('[scheme:delete]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAllSchemes, getSchemeById, createScheme, updateScheme, deleteScheme };
