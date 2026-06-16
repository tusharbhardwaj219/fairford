const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Product model using the shared schema in src/model.js
const { productSchema } = require('../src/model');
// Guard against "Cannot overwrite model" error on hot reload
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strip all price fields and return only the caller's price.
// NEVER send both prices to the client.
function applyRolePricing(product, role) {
  const p = product.toObject ? product.toObject() : { ...product };

  const userPrice =
    role === 'distributor'
      ? p.distributorPrice ?? p.netPrice
      : p.netPrice ?? p.retailerPrice;

  const mrp       = p.mrp ?? 0;
  const discount  = mrp > 0 ? Math.round(((mrp - userPrice) / mrp) * 100) : 0;

  // Remove both price fields so neither leaks
  delete p.netPrice;
  delete p.distributorPrice;
  delete p.retailerPrice;

  return {
    ...p,
    mrp,
    userPrice,
    discount,
    role
  };
}

// ─── Public routes (no auth required) ────────────────────────────────────────

// GET /api/products — listing (no prices returned)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 12, category, manufacturer,
      minPrice, maxPrice, search, sort = 'latest', schedule
    } = req.query;

    const filter = { isActive: true };
    if (category)     filter.category     = category;
    if (manufacturer) filter.manufacturer = manufacturer;
    if (schedule)     filter.schedule     = schedule;
    if (minPrice || maxPrice) {
      filter.mrp = {};
      if (minPrice) filter.mrp.$gte = parseFloat(minPrice);
      if (maxPrice) filter.mrp.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { name:         { $regex: search, $options: 'i' } },
        { composition:  { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } }
      ];
    }

    const sortMap = {
      latest:     { createdAt: -1 },
      'price-low':  { mrp: 1 },
      'price-high': { mrp: -1 },
      rating:     { ratings: -1 },
      popular:    { reviews: -1 }
    };
    const skip = (page - 1) * limit;

    // Never expose prices on the listing — select them out
    const products = await Product
      .find(filter)
      .select('-netPrice -distributorPrice -retailerPrice')
      .sort(sortMap[sort] || sortMap.latest)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

router.get('/featured',   async (req, res) => {
  try {
    const products = await Product
      .find({ isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice')
      .sort({ reviews: -1, ratings: -1 })
      .limit(8);
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching featured products' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

router.get('/manufacturers', async (req, res) => {
  try {
    const manufacturers = await Product.distinct('manufacturer', { isActive: true });
    res.status(200).json({ success: true, data: manufacturers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching manufacturers' });
  }
});

router.get('/bestsellers', async (req, res) => {
  try {
    const products = await Product
      .find({ isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice')
      .sort({ reviews: -1, ratings: -1 })
      .limit(parseInt(req.query.limit) || 8);
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching bestsellers' });
  }
});

router.get('/new-arrivals', async (req, res) => {
  try {
    const products = await Product
      .find({ isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 8);
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching new arrivals' });
  }
});

router.get('/stats/dashboard', async (req, res) => {
  try {
    const total      = await Product.countDocuments({ isActive: true });
    const outOfStock = await Product.countDocuments({ isActive: true, stock: 0 });
    const lowStock   = await Product.countDocuments({ isActive: true, stock: { $gt: 0, $lte: 50 } });
    res.status(200).json({ success: true, data: { total, outOfStock, lowStock } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ success: false, message: 'Product IDs are required' });
    const productIds = Array.isArray(ids) ? ids : [ids];
    const validIds   = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const products   = await Product
      .find({ _id: { $in: validIds }, isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice');
    res.status(200).json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const product = await Product
      .findOne({ sku: req.params.slug, isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
});

router.get('/brand/:brand', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip     = (page - 1) * limit;
    const products = await Product
      .find({ manufacturer: req.params.brand, isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice')
      .skip(skip).limit(parseInt(limit));
    const total = await Product.countDocuments({ manufacturer: req.params.brand, isActive: true });
    res.status(200).json({
      success: true, data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching brand products' });
  }
});

router.get('/category/:category', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip     = (page - 1) * limit;
    const products = await Product
      .find({ category: req.params.category, isActive: true })
      .select('-netPrice -distributorPrice -retailerPrice')
      .skip(skip).limit(parseInt(limit));
    const total = await Product.countDocuments({ category: req.params.category, isActive: true });
    res.status(200).json({
      success: true, data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching category products' });
  }
});

// POST /api/products/search
router.post('/search', async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });

    const searchFilter = {
      isActive: true,
      $or: [
        { name:         { $regex: query, $options: 'i' } },
        { composition:  { $regex: query, $options: 'i' } },
        { manufacturer: { $regex: query, $options: 'i' } },
        { category:     { $regex: query, $options: 'i' } },
        { tags:         { $in: [new RegExp(query, 'i')] } }
      ],
      ...filters
    };

    const products = await Product
      .find(searchFilter)
      .select('-netPrice -distributorPrice -retailerPrice')
      .limit(20);

    res.status(200).json({ success: true, data: products, count: products.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error searching products' });
  }
});

// ─── Protected: product detail with role-based pricing ───────────────────────
// GET /api/products/:id  — MUST stay last among GET routes
router.get('/:id', verifyToken, authorizeRoles('distributor', 'retailer'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findOne({ _id: id, isActive: true });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Return only the calling role's price — never both
    const payload = applyRolePricing(product, req.user.role);

    res.status(200).json({ success: true, data: payload });

  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
});

// ─── Admin-only write routes ──────────────────────────────────────────────────

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, category, sku } = req.body;
    if (!name || !category || !sku) {
      return res.status(400).json({ success: false, message: 'Name, category, and SKU are required' });
    }
    if (await Product.findOne({ sku })) {
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    }
    const newProduct = await Product.create({ ...req.body, productId: `PROD-${Date.now()}` });
    res.status(201).json({ success: true, message: 'Product created', data: newProduct });
  } catch (err) {
    console.error('Product creation error:', err);
    res.status(500).json({ success: false, message: 'Error creating product' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    const product = await Product.findByIdAndUpdate(id, { ...req.body }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(200).json({ success: true, message: 'Product updated', data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

module.exports = router;
