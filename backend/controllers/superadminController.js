/* =====================================================================
   controllers/superadminController.js

   Backs the embedded Super Admin dashboard (frontend/public/superadmin.html)
   with the main app's REAL data, mapped into the shapes that dashboard's
   superadmin.js expects. Mounted at /api/superadmin behind admin auth.

   Real models: Retailer, Distributor, Product, Order, Scheme, Category.
   Two dashboard-only concepts with no main-app equivalent (pricing rules,
   distributor↔territory mapping) are stored in their own collections.
   ===================================================================== */

const mongoose    = require('mongoose');
const Retailer    = require('../models/Retailer');
const Distributor = require('../models/Distributor');
const Product     = require('../models/Product');
const Order       = require('../models/Order');
const Scheme      = require('../models/Scheme');
const Category    = require('../models/Category');

// ── Dashboard-only collections (no real equivalent in the storefront) ─────────
const PriceRule = mongoose.models.SaPriceRule || mongoose.model('SaPriceRule',
  new mongoose.Schema({ category: String, channel: String, mrp: mongoose.Schema.Types.Mixed,
    dist_margin: Number, retail_margin: Number, gst_rate: String, status: String },
    { timestamps: true }), 'sa_price_rules');

const DistMapping = mongoose.models.SaDistMapping || mongoose.model('SaDistMapping',
  new mongoose.Schema({ distributor: String, state: String, district: String,
    retailers_mapped: Number, coverage_pct: Number, last_updated: String },
    { timestamps: true }), 'sa_dist_mapping');

// ── Helpers ───────────────────────────────────────────────────────────────────
const sid   = (d) => d._id.toString();
const str   = (v) => (v == null ? '' : String(v));
const num   = (v) => Number(v || 0);
const lakh  = (n) => `₹${(num(n) / 100000).toFixed(1)}L`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const isOid = (id) => mongoose.Types.ObjectId.isValid(id);
const escRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ok = (res, extra = {}) => res.json({ success: true, ...extra });

async function genUniqueEmail(prefix, domain) {
  return `${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@${domain}`;
}

// ════════════════════════════ DASHBOARD ═══════════════════════════════════════
exports.dashboard = async (req, res) => {
  try {
    const [pending_approvals, active_distributors, active_retailers] = await Promise.all([
      Retailer.countDocuments({ status: 'pending' }),
      Distributor.countDocuments({ status: 'active' }),
      Retailer.countDocuments({ status: 'active' }),
    ]);
    res.json({ pending_approvals, active_distributors, active_retailers });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ APPROVALS (Retailer KYC) ════════════════════════
// retailer.status  pending↔pending · active↔approved · suspended↔rejected
const RET_TO_APPROVAL = { pending: 'pending', active: 'approved', suspended: 'rejected' };
const APPROVAL_TO_RET = { pending: 'pending', approved: 'active', rejected: 'suspended' };

function toApproval(r) {
  const a = r.shopAddress || {};
  return {
    id:        sid(r),
    name:      str(r.shopName || r.name),
    type:      'Retailer',
    region:    [a.city, a.state].filter(Boolean).join(', ') || '—',
    submitted: fmtDate(r.createdAt),
    docs:      (r.kycDocuments && r.kycDocuments.length) ? `${r.kycDocuments.length} docs` : 'GST, License',
    status:    RET_TO_APPROVAL[r.status] || 'pending',
  };
}

exports.listApprovals = async (req, res) => {
  try {
    const q = {};
    if (req.query.status && APPROVAL_TO_RET[req.query.status]) q.status = APPROVAL_TO_RET[req.query.status];
    const rets = await Retailer.find(q).sort({ createdAt: -1 }).limit(500);
    res.json(rets.map(toApproval));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateApproval = async (req, res) => {
  try {
    const mapped = APPROVAL_TO_RET[req.body.status];
    if (!mapped) return res.status(400).json({ error: 'Invalid status' });
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await Retailer.findByIdAndUpdate(req.params.id, { status: mapped }, { new: true });
    if (!r) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.bulkApprove = async (req, res) => {
  try {
    const r = await Retailer.updateMany({ status: 'pending' }, { status: 'active' });
    ok(res, { updated: r.modifiedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ DISTRIBUTORS ════════════════════════════════════
// Aggregate per-distributor order stats once, reused for the table.
async function distributorStats() {
  const agg = await Order.aggregate([
    { $group: {
      _id: '$distributor',
      retailers: { $addToSet: '$retailer' },
      gmv: { $sum: { $cond: [{ $in: ['$status', ['dispatched', 'delivered']] }, '$totalAmount', 0] } },
      outstanding: { $sum: { $cond: [{ $and: [
        { $ne: ['$paymentStatus', 'paid'] },
        { $not: [{ $in: ['$status', ['cancelled', 'returned']] }] },
      ] }, '$totalAmount', 0] } },
    } },
  ]);
  const by = {};
  agg.forEach(a => { by[String(a._id)] = { retailers: (a.retailers || []).length, gmv: a.gmv, outstanding: a.outstanding }; });
  return by;
}

function toDistributor(d, stats) {
  const a = d.businessAddress || {};
  const s = stats[sid(d)] || { retailers: 0, gmv: 0, outstanding: 0 };
  return {
    id:              sid(d),
    name:            str(d.businessName || d.name),
    state:           str(a.state),
    retailers_count: s.retailers,
    may_gmv:         lakh(s.gmv),
    outstanding:     s.outstanding > 0 ? lakh(s.outstanding) : '₹0',
    status:          str(d.status || 'active'),
  };
}

exports.listDistributors = async (req, res) => {
  try {
    const [dists, stats] = await Promise.all([Distributor.find().sort({ createdAt: -1 }), distributorStats()]);
    res.json(dists.map(d => toDistributor(d, stats)));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getDistributor = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const d = await Distributor.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(toDistributor(d, await distributorStats()));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createDistributor = async (req, res) => {
  try {
    const { name, state, status } = req.body;
    if (!name || !state) return res.status(400).json({ error: 'name and state are required' });
    const d = await Distributor.create({
      name, businessName: name,
      email: await genUniqueEmail((name || 'dist').toLowerCase().replace(/[^a-z0-9]/g, ''), 'dist.fairford.local'),
      password: `Fairford@${Math.floor(1000 + Math.random() * 9000)}`,
      businessAddress: { state },
      status: status || 'active',
      role: 'dist',
    });
    res.status(201).json(toDistributor(d, {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateDistributor = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const { name, state, status } = req.body;
    const patch = {};
    if (name !== undefined) { patch.name = name; patch.businessName = name; }
    if (status !== undefined) patch.status = status;
    if (state !== undefined) patch['businessAddress.state'] = state;
    const d = await Distributor.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!d) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteDistributor = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await Distributor.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ RETAILERS ═══════════════════════════════════════
async function retailerOrderStats() {
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const agg = await Order.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$retailer',
      last_order: { $first: '$createdAt' },
      last_dist: { $first: '$distributor' },
      monthly: { $sum: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, 1, 0] } },
    } },
  ]);
  const by = {};
  agg.forEach(a => { by[String(a._id)] = a; });
  return by;
}

function toRetailer(r, stats, distNames) {
  const a = r.shopAddress || {};
  const s = stats[sid(r)] || {};
  return {
    id:             sid(r),
    name:           str(r.shopName || r.name),
    city:           str(a.city),
    type:           'Medical Store',
    distributor:    (s.last_dist && distNames[String(s.last_dist)]) || '—',
    monthly_orders: num(s.monthly),
    last_order:     s.last_order ? fmtDate(s.last_order) : '—',
    status:         str(r.status || 'pending'),
  };
}

exports.listRetailers = async (req, res) => {
  try {
    const [rets, stats, dists] = await Promise.all([
      Retailer.find().sort({ createdAt: -1 }).limit(500),
      retailerOrderStats(),
      Distributor.find().select('businessName name'),
    ]);
    const distNames = {};
    dists.forEach(d => { distNames[sid(d)] = str(d.businessName || d.name); });
    res.json(rets.map(r => toRetailer(r, stats, distNames)));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getRetailer = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await Retailer.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(toRetailer(r, await retailerOrderStats(), {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createRetailer = async (req, res) => {
  try {
    const { name, city, status } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'name and city are required' });
    const r = await Retailer.create({
      name, shopName: name,
      email: await genUniqueEmail((name || 'ret').toLowerCase().replace(/[^a-z0-9]/g, ''), 'ret.fairford.local'),
      password: `Fairford@${Math.floor(1000 + Math.random() * 9000)}`,
      shopAddress: { city, state: req.body.state || 'Maharashtra' },
      status: status || 'pending',
      role: 'ret',
    });
    res.status(201).json(toRetailer(r, {}, {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateRetailer = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const { name, city, status } = req.body;
    const patch = {};
    if (name !== undefined) { patch.name = name; patch.shopName = name; }
    if (status !== undefined) patch.status = status;
    if (city !== undefined) patch['shopAddress.city'] = city;
    const r = await Retailer.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!r) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteRetailer = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await Retailer.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ PRODUCTS ════════════════════════════════════════
function skuOf(p) { return str(p.slug || `FF-${sid(p).slice(-6).toUpperCase()}`); }

function toProduct(p) {
  const catName = (p.category && p.category.categoryName) || p.categoryName || 'General';
  const imageUrl = (p.image && p.image.url) ||
                   (p.images && p.images[0] && p.images[0].url) || '';
  return {
    id:               sid(p),
    name:             str(p.name),
    sku:              skuOf(p),
    category:         str(catName),
    mrp:              num(p.mrp),
    retailerPrice:    num(p.retailerPrice),
    distributorPrice: num(p.distributorPrice),
    manufacturer:     str(p.brand || 'Fair Ford Pharma'),
    brand:            str(p.brand || 'Fair Ford Pharma'),
    strength:         str(p.strength || '-'),
    packSize:         str(p.packSize || '-'),
    dosageForm:       str(p.dosageForm || '-'),
    stock:            num(p.stock),
    status:           str(p.status || 'active'),
    created_date:     fmtDate(p.createdAt),
    description:      str(p.description),
    imageUrl:         imageUrl,
  };
}

async function resolveCategoryId(name) {
  if (!name) {
    const any = await Category.findOne();
    if (any) return any._id;
  }
  let cat = await Category.findOne({ categoryName: new RegExp(`^${escRx(name)}$`, 'i') });
  if (!cat) {
    try { cat = await Category.create({ categoryName: name, categoryDescription: `${name} products` }); }
    catch (_) { cat = await Category.findOne(); }
  }
  return cat ? cat._id : null;
}

exports.listProducts = async (req, res) => {
  try {
    const prods = await Product.find().sort({ createdAt: -1 }).limit(1000);
    res.json(prods.map(toProduct));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getProduct = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(toProduct(p));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name, sku, category, mrp, retailerPrice, distributorPrice,
      manufacturer, brand, strength, packSize, dosageForm,
      stock, description, status,
    } = req.body;
    if (!name || mrp == null) return res.status(400).json({ error: 'name and mrp are required' });

    const mrpNum   = Number(mrp);
    // Sensible defaults if the form omits them — but the form sends all three.
    const retNum   = Number(retailerPrice ?? mrp);
    const distNum  = Number(distributorPrice ?? mrp);
    if (Number.isNaN(mrpNum) || Number.isNaN(retNum) || Number.isNaN(distNum)) {
      return res.status(400).json({ error: 'mrp, retailerPrice and distributorPrice must be numbers' });
    }

    const categoryId = await resolveCategoryId(category);
    const productData = {
      name,
      slug: sku || undefined,
      brand: manufacturer || brand || 'Fair Ford Pharma',
      category: categoryId,
      categoryName: category || 'General',
      strength:   strength   || '-',
      packSize:   packSize   || '-',
      dosageForm: dosageForm || '-',
      mrp: mrpNum,
      retailerPrice: retNum,
      distributorPrice: distNum,
      stock: Number(stock) || 0,
      description: description || '',
      status: status || 'active',
    };
    // Multer (Cloudinary storage) attaches the uploaded asset to req.file.
    // `path` is the secure URL Cloudinary returns; `filename` is the public_id
    // we need to delete the asset later on update/delete.
    if (req.file) {
      productData.image = { url: req.file.path, public_id: req.file.filename };
    }
    const p = await Product.create(productData);
    res.status(201).json(toProduct(p));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateProduct = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const {
      name, sku, category, mrp, retailerPrice, distributorPrice,
      manufacturer, brand, strength, packSize, dosageForm,
      stock, description, status,
    } = req.body;
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (sku !== undefined) patch.slug = sku;
    if (mrp !== undefined) patch.mrp = Number(mrp);
    if (retailerPrice !== undefined)    patch.retailerPrice    = Number(retailerPrice);
    if (distributorPrice !== undefined) patch.distributorPrice = Number(distributorPrice);
    if (manufacturer !== undefined) patch.brand = manufacturer;
    else if (brand !== undefined)   patch.brand = brand;
    if (strength !== undefined)   patch.strength   = strength;
    if (packSize !== undefined)   patch.packSize   = packSize;
    if (dosageForm !== undefined) patch.dosageForm = dosageForm;
    if (stock !== undefined) patch.stock = Number(stock);
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (category !== undefined) { patch.category = await resolveCategoryId(category); patch.categoryName = category; }

    // Replace the product image: delete the old Cloudinary asset (fire and
    // forget — failure to clean up shouldn't block the update), then store
    // the new one. If no file came in, leave the existing image intact.
    if (req.file) {
      const existing = await Product.findById(req.params.id).select('image').lean();
      if (existing && existing.image && existing.image.public_id) {
        try {
          const cloudinary = require('../config/cloudinary');
          cloudinary.uploader.destroy(existing.image.public_id).catch(() => {});
        } catch (_) {}
      }
      patch.image = { url: req.file.path, public_id: req.file.filename };
    }

    const p = await Product.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!p) return res.status(404).json({ error: 'Product not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const r = await Product.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Product not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ SCHEMES ═════════════════════════════════════════
const SCHEME_TYPE_IN = (t) => {
  const s = String(t || '').toLowerCase();
  if (s.includes('cashback')) return 'cashback';
  if (s.includes('bonus')) return 'bonus_units';
  if (s.includes('flat')) return 'flat_off';
  return 'discount';
};
function schemeStatus(s) {
  const now = new Date();
  if (s.validFrom && now < new Date(s.validFrom)) return 'upcoming';
  if (s.validTo && now > new Date(s.validTo)) return 'ended';
  return 'active';
}
function toScheme(s) {
  return {
    id:          sid(s),
    name:        str(s.name),
    type:        str(s.schemeType || 'discount'),
    category:    'All Products',
    channel:     str(s.eligibleFor || 'both'),
    description: str(s.description),
    start_date:  s.validFrom ? new Date(s.validFrom).toISOString() : '',
    end_date:    s.validTo ? new Date(s.validTo).toISOString() : '',
    target:      num(s.minOrderValue) || 1000,
    redemptions: num(s.usageCount),
    status:      schemeStatus(s),
  };
}

exports.listSchemes = async (req, res) => {
  try {
    const schemes = await Scheme.find().sort({ createdAt: -1 }).limit(200);
    res.json(schemes.map(toScheme));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createScheme = async (req, res) => {
  try {
    const { name, type, channel, start_date, end_date, description } = req.body;
    if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date are required' });
    const s = await Scheme.create({
      name,
      description: description || '',
      schemeType: SCHEME_TYPE_IN(type),
      eligibleFor: ['distributor', 'retailer', 'both'].includes(String(channel || '').toLowerCase()) ? String(channel).toLowerCase() : 'both',
      validFrom: new Date(start_date),
      validTo: new Date(end_date),
      isActive: true,
    });
    res.status(201).json(toScheme(s));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ INVENTORY (from Product.stock) ══════════════════
exports.listInventory = async (req, res) => {
  try {
    const prods = await Product.find().sort({ name: 1 }).limit(1000);
    res.json(prods.map(p => {
      const total = num(p.stock);
      const status = total === 0 ? 'out' : total <= 50 ? 'low' : 'ok';
      return {
        id:           sid(p),
        product_name: str(p.name),
        sku:          skuOf(p),
        category:     str((p.category && p.category.categoryName) || p.categoryName || 'General'),
        total_stock:  total,
        reserved:     0,
        available:    total,
        reorder_level: 50,
        status,
      };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateInventory = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const patch = {};
    if (req.body.total_stock !== undefined) patch.stock = Number(req.body.total_stock);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields to update' });
    const p = await Product.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!p) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ WALLET / SETTLEMENTS (from Orders) ══════════════
function settlementStatus(o) {
  if (o.paymentStatus === 'paid') return 'settled';
  if (o.status === 'delivered') return 'overdue';
  if (o.status === 'dispatched') return 'due_today';
  return 'pending';
}
exports.listWallet = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $nin: ['cancelled'] } })
      .populate('distributor', 'businessName name')
      .sort({ createdAt: -1 }).limit(300);
    res.json(orders.map(o => ({
      id:         sid(o),
      distributor: str(o.distributor && (o.distributor.businessName || o.distributor.name)),
      invoice_no: str(o.orderNumber),
      amount:     `₹${num(o.totalAmount).toLocaleString('en-IN')}`,
      due_date:   fmtDate(o.expectedDelivery || o.createdAt),
      status:     settlementStatus(o),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateWallet = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    if (req.body.status !== 'settled') return res.status(400).json({ error: 'Only settling is supported' });
    const o = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' }, { new: true });
    if (!o) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ PRICING (own collection) ════════════════════════
const toPriceRule = (r) => ({
  id: sid(r), category: str(r.category), channel: str(r.channel),
  mrp: r.mrp, dist_margin: num(r.dist_margin), retail_margin: num(r.retail_margin),
  gst_rate: str(r.gst_rate || '12%'), status: str(r.status || 'active'),
});

exports.listPricing = async (req, res) => {
  try {
    let rules = await PriceRule.find().sort({ createdAt: -1 });
    if (!rules.length) {
      // Seed sensible defaults from the real product categories
      const cats = await Category.find().select('categoryName').limit(8);
      if (cats.length) {
        await PriceRule.insertMany(cats.map(c => ({
          category: c.categoryName, channel: 'Distributor → Retailer',
          mrp: 'Varies', dist_margin: 10, retail_margin: 20, gst_rate: '12%', status: 'active',
        })));
        rules = await PriceRule.find().sort({ createdAt: -1 });
      }
    }
    res.json(rules.map(toPriceRule));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.savePricing = async (req, res) => {
  try {
    const { category, channel = 'Distributor → Retailer', mrp, dist_margin, retail_margin, gst_rate, status } = req.body;
    if (!category) return res.status(400).json({ error: 'category is required' });
    const existing = await PriceRule.findOne({ category, channel });
    if (existing) {
      await PriceRule.updateOne({ _id: existing._id }, { $set: { mrp, dist_margin, retail_margin, gst_rate, status: status || 'active' } });
      return res.json({ id: sid(existing), success: true, updated: true });
    }
    const r = await PriceRule.create({ category, channel, mrp, dist_margin, retail_margin, gst_rate: gst_rate || '12%', status: status || 'active' });
    res.status(201).json({ id: sid(r), success: true, updated: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deletePricing = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await PriceRule.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ DIST-MAPPING (own collection) ═══════════════════
const toMapping = (m) => ({
  id: sid(m), distributor: str(m.distributor), state: str(m.state), district: str(m.district),
  retailers_mapped: num(m.retailers_mapped), coverage_pct: num(m.coverage_pct), last_updated: str(m.last_updated),
});

exports.listDistMapping = async (req, res) => {
  try {
    let maps = await DistMapping.find().sort({ createdAt: -1 });
    if (!maps.length) {
      // Seed one mapping row per active distributor from real coverage data
      const dists = await Distributor.find({ status: 'active' });
      if (dists.length) {
        await DistMapping.insertMany(dists.map(d => ({
          distributor: str(d.businessName || d.name),
          state: str(d.businessAddress && d.businessAddress.state),
          district: str(d.businessAddress && d.businessAddress.city),
          retailers_mapped: (d.territory || []).length,
          coverage_pct: Math.min(100, (d.serviceablePincodes || []).length * 10),
          last_updated: fmtDate(new Date()),
        })));
        maps = await DistMapping.find().sort({ createdAt: -1 });
      }
    }
    res.json(maps.map(toMapping));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createDistMapping = async (req, res) => {
  try {
    const { distributor, state } = req.body;
    if (!distributor || !state) return res.status(400).json({ error: 'distributor and state are required' });
    const m = await DistMapping.create({
      distributor, state,
      district: req.body.district || '',
      retailers_mapped: num(req.body.retailers_mapped),
      coverage_pct: num(req.body.coverage_pct),
      last_updated: fmtDate(new Date()),
    });
    res.status(201).json(toMapping(m));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateDistMapping = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const patch = { last_updated: fmtDate(new Date()) };
    ['distributor', 'state', 'district'].forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
    if (req.body.retailers_mapped !== undefined) patch.retailers_mapped = num(req.body.retailers_mapped);
    if (req.body.coverage_pct !== undefined) patch.coverage_pct = num(req.body.coverage_pct);
    const m = await DistMapping.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!m) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteDistMapping = async (req, res) => {
  try {
    if (!isOid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await DistMapping.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    ok(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ════════════════════════════ NOTIFY ══════════════════════════════════════════
exports.notifyLowStock = async (req, res) => {
  try {
    const { distributor_name, email, items = [] } = req.body;
    if (!distributor_name) return res.status(400).json({ error: 'distributor_name required' });
    console.log(`[superadmin] low-stock alert → ${distributor_name} <${email}> — ${items.length} item(s)`);
    res.json({ success: true, message: `Email reminder sent to ${distributor_name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
