const Retailer = require('../models/Retailer');
const Product  = require('../models/Product');

// GET /api/retailer/dashboard
const getDashboard = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user._id).select('-password');
    if (!retailer)
      return res.status(404).json({ success: false, message: 'Retailer not found' });

    const totalProducts = await Product.countDocuments({ status: 'active' });
    const featuredProducts = await Product.find({ status: 'active', isFeatured: true })
      .select('name brand retailerPrice stock stockStatus images')
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        profile: retailer.toSafe(),
        stats: { totalProducts },
        featuredProducts
      }
    });
  } catch (err) {
    console.error('[retailer:getDashboard]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/retailer/profile
const getProfile = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user._id).select('-password');
    if (!retailer)
      return res.status(404).json({ success: false, message: 'Retailer not found' });

    return res.status(200).json({ success: true, user: retailer.toSafe() });
  } catch (err) {
    console.error('[retailer:getProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/retailer/profile
const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'shopName', 'address', 'gstin', 'drugLicenseNo'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const retailer = await Retailer.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!retailer)
      return res.status(404).json({ success: false, message: 'Retailer not found' });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: retailer.toSafe()
    });
  } catch (err) {
    console.error('[retailer:updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/retailer/products
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
      .select('name brand category strength packSize dosageForm retailerPrice mrp gst stock stockStatus minimumOrderQuantity images slug')
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    console.error('[retailer:getProducts]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getDashboard, getProfile, updateProfile, getProducts };
