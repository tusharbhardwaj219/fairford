/* =====================================================================
   controllers/productController.js — Product Management
   Images are stored on Cloudinary; MongoDB only holds {url, public_id}.
   ===================================================================== */

const Product     = require('../models/Product');
const Category    = require('../models/Category');
const cloudinary  = require('../config/cloudinary');
const APIFeatures = require('../utils/apiFeatures');
const { validationResult } = require('express-validator');

// ── Role-based pricing filter ─────────────────────────────────────────────────
function filterProductPricing(product, role) {
  const p = product.toObject ? product.toObject() : { ...product };

  if (!role) {
    delete p.mrp;
    delete p.retailerPrice;
    delete p.distributorPrice;
    delete p.gst;
    p.pricingMessage = 'Please login to view product prices.';
    return p;
  }

  if (role === 'dist') {
    if (p.mrp && p.distributorPrice) {
      p.discount = Number(((p.mrp - p.distributorPrice) / p.mrp * 100).toFixed(1));
      p.margin   = p.discount;
    }
    delete p.retailerPrice;
    return p;
  }

  if (role === 'ret') {
    delete p.mrp;
    delete p.distributorPrice;
    delete p.gst;
    return p;
  }

  return p; // hospital / manufacturer — full data
}

function filterList(products, role) {
  return products.map(p => filterProductPricing(p, role));
}

// Helper: safely destroy a Cloudinary asset (never throws)
async function destroyCloudinaryImage(public_id) {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (_) {
    // Non-fatal — log but do not bubble up
    console.error('[cloudinary] Failed to delete asset:', public_id);
  }
}

// ── @route  POST /api/products ────────────────────────────────────────────────
// ── @access Private (Admin)
exports.createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If a file was uploaded but validation failed, clean up Cloudinary
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const categoryDoc = await Category.findById(req.body.category);
    if (!categoryDoc) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const productData = { ...req.body, categoryName: categoryDoc.categoryName };

    // Single main image (field name: "image")
    if (req.file) {
      productData.image = {
        url:       req.file.path,
        public_id: req.file.filename
      };
    }

    // Multiple gallery images (field name: "images") — used via addProductImages route
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(f => ({ url: f.path, public_id: f.filename }));
    }

    const product = await Product.create(productData);
    await product.populate('category');

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    // DB error after upload — remove orphaned Cloudinary asset
    if (req.file)  await destroyCloudinaryImage(req.file.filename);
    if (req.files) await Promise.all(req.files.map(f => destroyCloudinaryImage(f.filename)));
    next(error);
  }
};

// ── @route  GET /api/products ─────────────────────────────────────────────────
exports.getAllProducts = async (req, res, next) => {
  try {
    let query = Product.find({ status: 'active' });
    const features = new APIFeatures(query, req.query)
      .search()
      .filterByCategory()
      .filterByBrand()
      .filterByPrice()
      .filterByStockStatus()
      .filterByRating()
      .sort()
      .pagination();

    const products   = await features.query;
    const totalCount = await Product.countDocuments({ status: 'active' });
    const pagination = features.getPaginationMeta(totalCount);
    const role       = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      count: products.length,
      pagination,
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/featured ───────────────────────────────────────
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const limit    = Number(req.query.limit) || 8;
    const products = await Product.getFeaturedProducts(limit);
    const role     = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: 'Featured products retrieved successfully',
      count: products.length,
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/bestsellers ─────────────────────────────────────
exports.getBestsellers = async (req, res, next) => {
  try {
    const limit    = Number(req.query.limit) || 8;
    const products = await Product.getBestsellers(limit);
    const role     = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: 'Bestseller products retrieved successfully',
      count: products.length,
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/new-arrivals ────────────────────────────────────
exports.getNewArrivals = async (req, res, next) => {
  try {
    const limit    = Number(req.query.limit) || 8;
    const products = await Product.getNewArrivals(limit);
    const role     = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: 'New arrival products retrieved successfully',
      count: products.length,
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/:id ────────────────────────────────────────────
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: 'active'
    }).limit(8);

    const role = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      product: filterProductPricing(product, role),
      relatedProducts: filterList(relatedProducts, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/slug/:slug ─────────────────────────────────────
exports.getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).populate('category');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: 'active'
    }).limit(8);

    const role = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      product: filterProductPricing(product, role),
      relatedProducts: filterList(relatedProducts, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/category/:categoryId ───────────────────────────
exports.getProductsByCategory = async (req, res, next) => {
  try {
    const page  = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: req.params.categoryId, status: 'active' })
      .skip(skip).limit(limit).sort({ createdAt: -1 });

    const totalCount = await Product.countDocuments({ category: req.params.categoryId, status: 'active' });
    const role = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: `Products in ${category.categoryName} retrieved successfully`,
      category,
      count: products.length,
      pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, limit },
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/brand/:brand ───────────────────────────────────
exports.getProductsByBrand = async (req, res, next) => {
  try {
    const page  = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const products = await Product.find({ brand: req.params.brand, status: 'active' })
      .skip(skip).limit(limit).sort({ createdAt: -1 });

    const totalCount = await Product.countDocuments({ brand: req.params.brand, status: 'active' });
    const role = req.user ? req.user.role : undefined;

    return res.status(200).json({
      success: true,
      message: `Products by ${req.params.brand} retrieved successfully`,
      brand: req.params.brand,
      count: products.length,
      pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, limit },
      products: filterList(products, role)
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/search/auto-suggest ────────────────────────────
exports.autoSuggestSearch = async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword || keyword.length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const products = await Product.find({
      $or: [
        { name:        { $regex: keyword, $options: 'i' } },
        { brand:       { $regex: keyword, $options: 'i' } },
        { composition: { $regex: keyword, $options: 'i' } }
      ],
      status: 'active'
    }).select('name brand').limit(10);

    const suggestions = [];
    const seen = new Set();
    products.forEach(p => {
      if (!seen.has(p.name))  { suggestions.push({ type: 'product', text: p.name,  value: p.name  }); seen.add(p.name);  }
      if (!seen.has(p.brand)) { suggestions.push({ type: 'brand',   text: p.brand, value: p.brand }); seen.add(p.brand); }
    });

    return res.status(200).json({ success: true, suggestions: suggestions.slice(0, 10) });
  } catch (error) {
    next(error);
  }
};

// ── @route  PUT /api/products/:id ────────────────────────────────────────────
// ── @access Private (Admin)
exports.updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    let product = await Product.findById(req.params.id);
    if (!product) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        if (req.file) await destroyCloudinaryImage(req.file.filename);
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      req.body.categoryName = category.categoryName;
    }

    // Replace main image: delete old from Cloudinary, save new
    if (req.file) {
      await destroyCloudinaryImage(product.image && product.image.public_id);
      req.body.image = {
        url:       req.file.path,
        public_id: req.file.filename
      };
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    }).populate('category');

    return res.status(200).json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    if (req.file) await destroyCloudinaryImage(req.file.filename);
    next(error);
  }
};

// ── @route  POST /api/products/:id/images ────────────────────────────────────
// ── @desc   Upload up to 5 gallery images for a product
// ── @access Private (Admin)
exports.addProductImages = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      if (req.files) await Promise.all(req.files.map(f => destroyCloudinaryImage(f.filename)));
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    const newImages = req.files.map(f => ({ url: f.path, public_id: f.filename }));
    product.images.push(...newImages);
    await product.save();

    return res.status(200).json({
      success: true,
      message: `${newImages.length} image(s) added to gallery`,
      data: { images: product.images }
    });
  } catch (error) {
    if (req.files) await Promise.all(req.files.map(f => destroyCloudinaryImage(f.filename)));
    next(error);
  }
};

// ── @route  DELETE /api/products/:id/images/:imageId ─────────────────────────
// ── @desc   Remove one gallery image from Cloudinary + product document
// ── @access Private (Admin)
exports.deleteProductImage = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const imgIndex = product.images.findIndex(
      img => img._id.toString() === req.params.imageId
    );
    if (imgIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found in gallery' });
    }

    const [removed] = product.images.splice(imgIndex, 1);
    await destroyCloudinaryImage(removed.public_id);
    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Gallery image deleted',
      data: { images: product.images }
    });
  } catch (error) {
    next(error);
  }
};

// ── @route  DELETE /api/products/:id ─────────────────────────────────────────
// ── @access Private (SuperAdmin)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Delete main image from Cloudinary
    await destroyCloudinaryImage(product.image && product.image.public_id);

    // Delete all gallery images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map(img => destroyCloudinaryImage(img.public_id)));
    }

    await Product.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ── @route  GET /api/products/stats/dashboard ─────────────────────────────────
// ── @access Private (Admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalProducts      = await Product.countDocuments({ status: 'active' });
    const totalCategories    = await Category.countDocuments({ isActive: true });
    const featuredProducts   = await Product.countDocuments({ isFeatured: true, status: 'active' });
    const outOfStockProducts = await Product.countDocuments({ stockStatus: 'Out of Stock' });

    const totalValue = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, totalMRP: { $sum: '$mrp' }, totalRetailerValue: { $sum: '$retailerPrice' } } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalProducts, totalCategories, featuredProducts, outOfStockProducts,
        totalMRPValue:       totalValue[0]?.totalMRP || 0,
        totalRetailerValue:  totalValue[0]?.totalRetailerValue || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
