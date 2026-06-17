const Distributor = require('../models/Distributor');
const Product     = require('../models/Product');

// GET /api/distributor/dashboard
const getDashboard = async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.user._id).select('-password');
    if (!distributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    const totalProducts = await Product.countDocuments({ status: 'active' });
    const featuredProducts = await Product.find({ status: 'active', isFeatured: true })
      .select('name brand distributorPrice stock stockStatus images')
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        profile: distributor.toSafe(),
        stats: { totalProducts },
        featuredProducts
      }
    });
  } catch (err) {
    console.error('[distributor:getDashboard]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/distributor/profile
const getProfile = async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.user._id).select('-password');
    if (!distributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    return res.status(200).json({ success: true, user: distributor.toSafe() });
  } catch (err) {
    console.error('[distributor:getProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/distributor/profile
const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'companyName', 'address', 'gstin'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const distributor = await Distributor.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!distributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: distributor.toSafe()
    });
  } catch (err) {
    console.error('[distributor:updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/distributor/products
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const filter = { status: 'active' };

    if (category) filter.category = category;
    if (search)   filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } }
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product
      .find(filter)
      .select('name brand category strength packSize dosageForm distributorPrice mrp gst stock stockStatus minimumOrderQuantity images slug')
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    console.error('[distributor:getProducts]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getDashboard, getProfile, updateProfile, getProducts };
