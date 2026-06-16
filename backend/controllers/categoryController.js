/* =====================================================================
   controllers/categoryController.js — Category Management
   Images are stored on Cloudinary; MongoDB only holds {url, public_id}.
   ===================================================================== */

const Category  = require('../models/Category');
const Product   = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const { validationResult } = require('express-validator');

// Helper: safely destroy a Cloudinary asset (never throws)
async function destroyCloudinaryImage(public_id) {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (_) {
    console.error('[cloudinary] Failed to delete asset:', public_id);
  }
}

// @route   POST /api/categories
// @access  Private (Admin)
exports.createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const { categoryName, categoryDescription, displayOrder } = req.body;

    const existingCategory = await Category.findOne({ categoryName });
    if (existingCategory) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(400).json({ success: false, message: 'Category with this name already exists' });
    }

    const categoryData = {
      categoryName,
      categoryDescription,
      displayOrder: displayOrder || 0
    };

    if (req.file) {
      categoryData.categoryImage = {
        url:       req.file.path,
        public_id: req.file.filename
      };
    }

    const category = await Category.create(categoryData);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    if (req.file) await destroyCloudinaryImage(req.file.filename);
    next(error);
  }
};

// @route   GET /api/categories
// @access  Public
exports.getAllCategories = async (req, res, next) => {
  try {
    const { isActive } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const categories = await Category.find(query).sort({ displayOrder: 1, categoryName: 1 });

    for (let category of categories) {
      const count = await Product.countDocuments({ category: category._id, status: 'active' });
      category.productCount = count;
      await category.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      count: categories.length,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/categories/:id
// @access  Public
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: category._id, status: 'active' });

    return res.status(200).json({
      success: true,
      category,
      productCount: products.length
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/categories/slug/:slug
// @access  Public
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ categorySlug: req.params.slug });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: category._id, status: 'active' });

    return res.status(200).json({
      success: true,
      category,
      productCount: products.length
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/categories/:id
// @access  Private (Admin)
exports.updateCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    let category = await Category.findById(req.params.id);
    if (!category) {
      if (req.file) await destroyCloudinaryImage(req.file.filename);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (req.body.categoryName && req.body.categoryName !== category.categoryName) {
      const existingCategory = await Category.findOne({ categoryName: req.body.categoryName });
      if (existingCategory) {
        if (req.file) await destroyCloudinaryImage(req.file.filename);
        return res.status(400).json({ success: false, message: 'Category with this name already exists' });
      }
    }

    category.categoryName        = req.body.categoryName        || category.categoryName;
    category.categoryDescription = req.body.categoryDescription || category.categoryDescription;
    category.displayOrder        = req.body.displayOrder !== undefined ? req.body.displayOrder : category.displayOrder;
    category.isActive            = req.body.isActive    !== undefined ? req.body.isActive    : category.isActive;

    // Replace image: delete old from Cloudinary, save new
    if (req.file) {
      await destroyCloudinaryImage(category.categoryImage && category.categoryImage.public_id);
      category.categoryImage = {
        url:       req.file.path,
        public_id: req.file.filename
      };
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    if (req.file) await destroyCloudinaryImage(req.file.filename);
    next(error);
  }
};

// @route   DELETE /api/categories/:id
// @access  Private (SuperAdmin)
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Please reassign or delete products first.`
      });
    }

    // Remove image from Cloudinary before deleting document
    await destroyCloudinaryImage(category.categoryImage && category.categoryImage.public_id);

    await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
