/* =====================================================================
   routes/categoryRoutes.js — Category Management Routes
   ===================================================================== */

const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { verifyToken: protect, authorizeRoles } = require('../middleware/authMiddleware');
const { uploadCategoryImage, handleUploadError } = require('../middleware/uploadMiddleware');

const adminOnly = authorizeRoles('admin', 'superadmin');

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/',            categoryController.getAllCategories);
router.get('/slug/:slug',  categoryController.getCategoryBySlug);
router.get('/:id',         categoryController.getCategory);

// ── Protected routes (Admin) ──────────────────────────────────────────────────
router.post(
  '/',
  protect,
  adminOnly,
  uploadCategoryImage,
  handleUploadError,
  [
    body('categoryName', 'Category name is required').trim().notEmpty(),
    body('categoryDescription').optional().isLength({ max: 500 })
  ],
  categoryController.createCategory
);

router.put(
  '/:id',
  protect,
  adminOnly,
  uploadCategoryImage,
  handleUploadError,
  [
    body('categoryName').optional().trim().notEmpty(),
    body('categoryDescription').optional().isLength({ max: 500 })
  ],
  categoryController.updateCategory
);

// ── Protected route (SuperAdmin) ──────────────────────────────────────────────
router.delete('/:id', protect, adminOnly, categoryController.deleteCategory);

module.exports = router;
