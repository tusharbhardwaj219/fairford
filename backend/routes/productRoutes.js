/* =====================================================================
   routes/productRoutes.js — Product Management Routes
   ===================================================================== */

const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { verifyToken: protect, optionalAuth, authorizeRoles } = require('../middleware/authMiddleware');
const {
  uploadSingleImage,
  uploadMultipleImages,
  handleUploadError
} = require('../middleware/uploadMiddleware');

// Admin-only gate for all product writes. (Was authorizeRoles('mfr') — a role
// no account has, which left DELETE permanently 403 and, combined with the
// missing gate on create/update, let any logged-in user mutate products.)
const adminOnly = authorizeRoles('admin', 'superadmin');

const router = express.Router();

const productValidation = [
  body('name',              'Product name is required').trim().notEmpty(),
  body('brand',             'Brand is required').trim().notEmpty(),
  body('category',          'Category is required').trim().notEmpty(),
  body('strength',          'Strength is required').trim().notEmpty(),
  body('packSize',          'Pack size is required').trim().notEmpty(),
  body('dosageForm',        'Dosage form is required').trim().notEmpty(),
  body('mrp',               'MRP must be a positive number').isFloat({ min: 0 }),
  body('retailerPrice',     'Retailer price must be a positive number').isFloat({ min: 0 }),
  body('distributorPrice',  'Distributor price must be a positive number').isFloat({ min: 0 }),
  body('stock',             'Stock must be a non-negative number').isInt({ min: 0 })
];

// ── Public routes (pricing filtered by role) ──────────────────────────────────
router.get('/',                     optionalAuth, productController.getAllProducts);
router.get('/featured',             optionalAuth, productController.getFeaturedProducts);
router.get('/bestsellers',          optionalAuth, productController.getBestsellers);
router.get('/new-arrivals',         optionalAuth, productController.getNewArrivals);
router.get('/search/auto-suggest',               productController.autoSuggestSearch);
router.get('/category/:categoryId', optionalAuth, productController.getProductsByCategory);
router.get('/brand/:brand',         optionalAuth, productController.getProductsByBrand);
router.get('/slug/:slug',           optionalAuth, productController.getProductBySlug);
router.get('/:id',                  optionalAuth, productController.getProduct);

// ── Protected: CREATE ─────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  adminOnly,
  uploadSingleImage,
  handleUploadError,
  productValidation,
  productController.createProduct
);

// ── Protected: UPDATE ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  adminOnly,
  uploadSingleImage,
  handleUploadError,
  [
    body('name').optional().trim().notEmpty(),
    body('brand').optional().trim().notEmpty(),
    body('category').optional().trim().notEmpty(),
    body('mrp').optional().isFloat({ min: 0 }),
    body('retailerPrice').optional().isFloat({ min: 0 }),
    body('distributorPrice').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 })
  ],
  productController.updateProduct
);

// ── Protected: DELETE (SuperAdmin) ────────────────────────────────────────────
router.delete('/:id', protect, adminOnly, productController.deleteProduct);

// ── Protected: Dashboard stats ────────────────────────────────────────────────
router.get('/stats/dashboard', protect, adminOnly, productController.getDashboardStats);

// ── Protected: Gallery — upload up to 5 images ───────────────────────────────
router.post(
  '/:id/images',
  protect,
  adminOnly,
  uploadMultipleImages,
  handleUploadError,
  productController.addProductImages
);

// ── Protected: Gallery — delete one image ────────────────────────────────────
router.delete(
  '/:id/images/:imageId',
  protect,
  adminOnly,
  productController.deleteProductImage
);

// ── Standalone image upload (returns URL + public_id) ────────────────────────
router.post(
  '/add-product',
  protect,
  adminOnly,
  uploadSingleImage,
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image uploaded' });
      }
      res.json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url:       req.file.path,
          public_id: req.file.filename
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
