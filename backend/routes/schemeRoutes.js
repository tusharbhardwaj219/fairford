const router = require('express').Router();
const {
  getAllSchemes, getSchemeById, createScheme, updateScheme, deleteScheme,
} = require('../controllers/schemeController');
const { verifyToken, authorizeRoles, requireActive } = require('../middleware/authMiddleware');

const distOnly = [verifyToken, authorizeRoles('dist'), requireActive];
const authAny  = [verifyToken];

router.get('/all', ...authAny, getAllSchemes);
router.get('/:id', getSchemeById);
router.post('/',   ...distOnly, createScheme);
router.put('/:id', ...distOnly, updateScheme);
router.delete('/:id', ...distOnly, deleteScheme);

module.exports = router;
