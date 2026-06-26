const router = require('express').Router();
const c = require('../controllers/superadminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { uploadProductImage, handleUploadError } = require('../middleware/uploadMiddleware');

// Whole dashboard API is admin/superadmin only.
router.use(verifyToken, authorizeRoles('admin', 'superadmin'));

// Dashboard
router.get('/dashboard', c.dashboard);

// Approvals (retailer KYC)
router.get('/approvals', c.listApprovals);
router.put('/approvals/bulk-approve', c.bulkApprove);   // before :id
router.put('/approvals/:id', c.updateApproval);

// Distributors
router.get('/distributors', c.listDistributors);
router.post('/distributors', c.createDistributor);
router.get('/distributors/:id', c.getDistributor);
router.put('/distributors/:id', c.updateDistributor);
router.delete('/distributors/:id', c.deleteDistributor);

// Retailers
router.get('/retailers', c.listRetailers);
router.post('/retailers', c.createRetailer);
router.get('/retailers/:id', c.getRetailer);
router.put('/retailers/:id', c.updateRetailer);
router.delete('/retailers/:id', c.deleteRetailer);

// Products. POST/PUT accept multipart/form-data so an image can be attached
// (the field name "image" matches the form input). JSON requests still work —
// multer just leaves req.body alone when there's no file.
router.get('/products', c.listProducts);
router.post('/products', uploadProductImage, handleUploadError, c.createProduct);
router.get('/products/:id', c.getProduct);
router.put('/products/:id', uploadProductImage, handleUploadError, c.updateProduct);
router.delete('/products/:id', c.deleteProduct);

// Schemes
router.get('/schemes', c.listSchemes);
router.post('/schemes', c.createScheme);

// Inventory
router.get('/inventory', c.listInventory);
router.put('/inventory/:id', c.updateInventory);

// Wallet / settlements
router.get('/wallet', c.listWallet);
router.put('/wallet/:id', c.updateWallet);

// Pricing
router.get('/pricing', c.listPricing);
router.post('/pricing', c.savePricing);
router.delete('/pricing/:id', c.deletePricing);

// Distributor ↔ territory mapping
router.get('/dist-mapping', c.listDistMapping);
router.post('/dist-mapping', c.createDistMapping);
router.put('/dist-mapping/:id', c.updateDistMapping);
router.delete('/dist-mapping/:id', c.deleteDistMapping);

// Notifications
router.post('/notify/low-stock', c.notifyLowStock);

module.exports = router;
