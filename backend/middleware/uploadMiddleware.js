const cloudinary  = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const createStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `fairford/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, and WebP images are allowed.'), false);
};

const limits = { fileSize: 5 * 1024 * 1024 };

const productUpload      = multer({ storage: createStorage('products'),      fileFilter, limits });
const categoryUpload     = multer({ storage: createStorage('categories'),    fileFilter, limits });
const userUpload         = multer({ storage: createStorage('users'),         fileFilter, limits });
const prescriptionUpload = multer({ storage: createStorage('prescriptions'), fileFilter, limits });

exports.uploadProductImage      = productUpload.single('image');
exports.uploadProductImages     = productUpload.array('images', 5);
exports.uploadCategoryImage     = categoryUpload.single('categoryImage');
exports.uploadUserImage         = userUpload.single('profileImage');
exports.uploadPrescriptionImage = prescriptionUpload.single('prescription');

exports.uploadSingleImage    = productUpload.single('image');
exports.uploadMultipleImages = productUpload.array('images', 5);

exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')  return res.status(400).json({ success: false, message: 'File size exceeds 5 MB limit.' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, message: 'Maximum 5 images allowed.' });
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
};
