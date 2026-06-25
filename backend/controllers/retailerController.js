const Retailer = require('../models/Retailer');
const Product  = require('../models/Product');

// GET /api/retailer/profile
const getProfile = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user._id).select('-password');
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    return res.status(200).json({ success: true, user: retailer.toSafe() });
  } catch (err) {
    console.error('[retailer:getProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/retailer/profile — also how a retailer sets the shop address used for order routing
const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'shopName', 'shopAddress', 'gstNumber', 'drugLicenseNumber'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const retailer = await Retailer.findByIdAndUpdate(
      req.user._id, { $set: updates }, { new: true, runValidators: true }
    ).select('-password');

    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });

    return res.status(200).json({ success: true, message: 'Profile updated', user: retailer.toSafe() });
  } catch (err) {
    console.error('[retailer:updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/retailer/products — active products with retailer pricing
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const filter = { status: 'active' };

    if (category) filter.category = category;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
    ];

    const skip     = (Number(page) - 1) * Number(limit);
    const total    = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .select('name brand category strength packSize dosageForm retailerPrice gst stock stockStatus minimumOrderQuantity images slug')
      .skip(skip).limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error('[retailer:getProducts]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getProfile, updateProfile, getProducts };
