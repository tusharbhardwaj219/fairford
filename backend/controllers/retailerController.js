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

    // Server-side format validation (mirrors the client) so malformed values —
    // especially the pincode/city used for order routing — can't be persisted.
    if (updates.phone != null) {
      const phone = String(updates.phone).replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
      }
      updates.phone = phone;
    }
    if (updates.gstNumber) {
      const gst = String(updates.gstNumber).toUpperCase().trim();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)) {
        return res.status(400).json({ success: false, message: 'Enter a valid 15-character GST number.' });
      }
      updates.gstNumber = gst;
    }
    if (updates.shopAddress && updates.shopAddress.pincode != null && updates.shopAddress.pincode !== '') {
      if (!/^[1-9][0-9]{5}$/.test(String(updates.shopAddress.pincode))) {
        return res.status(400).json({ success: false, message: 'Enter a valid 6-digit PIN code.' });
      }
    }

    const retailer = await Retailer.findByIdAndUpdate(
      req.user._id, { $set: updates }, { returnDocument: 'after', runValidators: true }
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
    if (search) {
      // Escape regex metacharacters + cap length so a crafted `search` value
      // can't trigger ReDoS / catastrophic backtracking.
      const kw = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name:  { $regex: kw, $options: 'i' } },
        { brand: { $regex: kw, $options: 'i' } },
      ];
    }

    const skip     = (Number(page) - 1) * Number(limit);
    const total    = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .select('name brand category strength packSize dosageForm retailerPrice gst stock stockStatus minimumOrderQuantity image images slug')
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
