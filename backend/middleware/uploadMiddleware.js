/* =====================================================================
   middleware/uploadMiddleware.js — Cloudinary File Upload Handling
   Images are uploaded directly to Cloudinary (no local disk storage).
   req.file.path   → secure HTTPS URL  (store as image.url)
   req.file.filename → public_id       (store as image.public_id)
   ===================================================================== */

const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Factory: one CloudinaryStorage instance per folder
const createStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `fairford/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    }
  });

// Only accept image MIME types
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5 MB

// Separate multer instances per entity type
const productUpload  = multer({ storage: createStorage('products'),   fileFilter, limits });
const categoryUpload = multer({ storage: createStorage('categories'), fileFilter, limits });
const userUpload     = multer({ storage: createStorage('users'),      fileFilter, limits });

// ── Per-entity exports ──────────────────────────────────────────────────────
exports.uploadProductImage   = productUpload.single('image');
exports.uploadProductImages  = productUpload.array('images', 5);
exports.uploadCategoryImage  = categoryUpload.single('categoryImage');
exports.uploadUserImage      = userUpload.single('profileImage');

// ── Backward-compatible aliases (used by existing productRoutes.js) ─────────
exports.uploadSingleImage    = productUpload.single('image');
exports.uploadMultipleImages = productUpload.array('images', 5);

// ── Error handler (must be the 4-argument form to catch multer errors) ──────
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File size exceeds 5 MB limit.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Maximum 5 images allowed.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};
