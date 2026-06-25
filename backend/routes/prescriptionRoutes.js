const router = require('express').Router();
const {
  getPrescriptions, createPrescription, getPrescriptionById,
  verifyPrescription, deletePrescription,
} = require('../controllers/prescriptionController');
const { verifyToken, authorizeRoles, requireActive } = require('../middleware/authMiddleware');
const { uploadPrescriptionImage, handleUploadError } = require('../middleware/uploadMiddleware');

const retOnly  = [verifyToken, authorizeRoles('ret'),  requireActive];
const distOnly = [verifyToken, authorizeRoles('dist'), requireActive];
const authAny  = [verifyToken, requireActive];

router.get('/',    ...retOnly, getPrescriptions);
router.post('/',   ...retOnly, uploadPrescriptionImage, handleUploadError, createPrescription);
router.get('/:id', ...authAny, getPrescriptionById);
router.put('/:id/verify', ...distOnly, verifyPrescription);
router.delete('/:id', ...retOnly, deletePrescription);

module.exports = router;
