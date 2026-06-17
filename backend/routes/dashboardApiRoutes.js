/**
 * Dashboard API Routes
 * Serves data for the Distributor and Retailer dashboard panels.
 * Uses in-memory data (seeded from realistic defaults) so dashboards
 * work immediately without additional MongoDB setup.
 */

const router = require('express').Router();
const Product = require('../models/Product');

/* ══════════════════════════════════════════════════════════════════
   IN-MEMORY DATA STORES
══════════════════════════════════════════════════════════════════ */

let orders = [
  { _id: "ord1", id: "ORD-7821", name: "Paracetamol 500mg × 200", qty: "4 products", amount: 14200, status: "Dispatched", delivery: "Today, 6 PM", priority: "express", items: [{ name: "Paracetamol 500mg", price: 71, qty: 200 }], retailer: "ret1", createdAt: new Date("2026-06-15") },
  { _id: "ord2", id: "ORD-7818", name: "Antibiotic Bundle", qty: "7 products", amount: 22800, status: "Delivered", delivery: "19 May", priority: "standard", items: [], retailer: "ret1", createdAt: new Date("2026-06-12") },
  { _id: "ord3", id: "ORD-7815", name: "Vitamins & Supplements", qty: "3 products", amount: 8640, status: "Pending", delivery: "21 May", priority: "standard", items: [], retailer: "ret1", createdAt: new Date("2026-06-10") },
  { _id: "ord4", id: "ORD-7812", name: "Insulin & Diabetes Care", qty: "5 products", amount: 38400, status: "Delivered", delivery: "18 May", priority: "standard", items: [], retailer: "ret1", createdAt: new Date("2026-06-08") },
  { _id: "ord5", id: "ORD-7809", name: "Cough & Cold Medicines", qty: "9 products", amount: 6720, status: "Dispatched", delivery: "20 May", priority: "standard", items: [], retailer: "ret2", createdAt: new Date("2026-06-06") },
  { _id: "ord6", id: "ORD-7806", name: "Cardiology Range", qty: "6 products", amount: 51200, status: "Pending", delivery: "22 May", priority: "standard", items: [], retailer: "ret2", createdAt: new Date("2026-06-04") },
];

let prescriptions = [
  { _id: "rx1", id: "RX-4021", patient: "Ramesh Kumar", doc: "Dr. A. Sharma", status: "Verified", date: "14 Jun" },
  { _id: "rx2", id: "RX-4018", patient: "Sunita Rao", doc: "Dr. P. Mehta", status: "Pending", date: "13 Jun" },
  { _id: "rx3", id: "RX-4015", patient: "Anjali Singh", doc: "Dr. R. Joshi", status: "Rejected", date: "12 Jun" },
  { _id: "rx4", id: "RX-4012", patient: "Vikram Shah", doc: "Dr. S. Nair", status: "Verified", date: "11 Jun" },
];

const retailerProfile = {
  _id: "ret1",
  name: "Apollo Pharmacy",
  role: "Retailer",
  location: "Mumbai",
  kycStatus: "Verified",
  kycId: "RET-00421",
  creditLimit: 200000,
  creditUsed: 48200,
  walletBalance: 18450,
  outstandingDue: 48200,
  overdueAmount: 12800,
  paidThisMonth: 334160,
  escrowBalance: 18450,
  distributor: {
    name: "MedCore Distributors",
    location: "Andheri East, Mumbai",
    phone: "+91 98200 44312",
  },
};

/* ══════════════════════════════════════════════════════════════════
   SHARED — SCHEMES (used by both retailer and distributor)
══════════════════════════════════════════════════════════════════ */

router.get('/schemes', (req, res) => {
  res.json([
    { _id: "sc1", icon: "🎁", name: "Buy 10 Get 1 — Paracetamol 500mg", meta: "Expires Sep 15 · 47 retailers active", saving: "Save ₹480", retailersCount: 47, expiryDate: "2026-09-15" },
    { _id: "sc2", icon: "⚡", name: "Extra 5% Margin — Vitamins Range", meta: "Expires Sep 30 · Applied automatically", saving: "Save ₹1,240", retailersCount: 112, expiryDate: "2026-09-30" },
    { _id: "sc3", icon: "🌧️", name: "Seasonal Scheme — Monsoon Meds", meta: "Expires Sep 30 · New this month", saving: "Save ₹960", retailersCount: 63, expiryDate: "2026-09-30" },
    { _id: "sc4", icon: "📦", name: "Fast Moving — Antibiotics Bulk", meta: "Expires May 30 · Order before deadline", saving: "Save ₹3,560", retailersCount: 28, expiryDate: "2026-05-30" },
  ]);
});

/* ══════════════════════════════════════════════════════════════════
   DISTRIBUTOR DASHBOARD
══════════════════════════════════════════════════════════════════ */

router.get('/dashboard/metrics', (req, res) => {
  res.json({
    ordersThisMonth: 326,
    totalOrders: 326,
    revenue: 1676430,
    outstandingPayments: 12068930,
    activeRetailers: 2453,
    pendingPaymentRetailers: 43,
    pendingDispatch: 28,
    pendingApproval: 14,
    lowStockSkus: 9,
    retailerRequests: 6,
    walletBalance: 243500,
  });
});

router.get('/reports/revenue', (req, res) => {
  res.json([
    { month: "Dec", revenue: 980000,  orders: 820  },
    { month: "Jan", revenue: 1140000, orders: 940  },
    { month: "Feb", revenue: 1060000, orders: 870  },
    { month: "Mar", revenue: 1280000, orders: 1080 },
    { month: "Apr", revenue: 1420000, orders: 1190 },
    { month: "May", revenue: 1676430, orders: 1380 },
  ]);
});

router.get('/reports/territory', (req, res) => {
  res.json([
    { city: "Mumbai",     value: 98 },
    { city: "Pune",       value: 82 },
    { city: "Nagpur",     value: 74 },
    { city: "Nashik",     value: 61 },
    { city: "Aurangabad", value: 53 },
    { city: "Kolhapur",   value: 38 },
  ]);
});

router.get('/orders/recent', (req, res) => {
  const distOrders = [
    { orderNo: "ORD-8821", retailer: { name: "Apollo Pharmacy", city: "Mumbai" }, items: [{ quantity: 4 }], amount: 14200, status: "Dispatched", orderDate: new Date("2026-06-15") },
    { orderNo: "ORD-8818", retailer: { name: "MedPlus Store", city: "Pune" }, items: [{ quantity: 7 }], amount: 22800, status: "Delivered", orderDate: new Date("2026-06-12") },
    { orderNo: "ORD-8815", retailer: { name: "Wellness Pharma", city: "Nagpur" }, items: [{ quantity: 3 }], amount: 8640, status: "Pending", orderDate: new Date("2026-06-10") },
    { orderNo: "ORD-8812", retailer: { name: "HealthCare Plus", city: "Nashik" }, items: [{ quantity: 5 }], amount: 38400, status: "Delivered", orderDate: new Date("2026-06-08") },
    { orderNo: "ORD-8809", retailer: { name: "City Medical", city: "Aurangabad" }, items: [{ quantity: 9 }], amount: 6720, status: "Approved", orderDate: new Date("2026-06-06") },
    { orderNo: "ORD-8806", retailer: { name: "Sunrise Pharma", city: "Kolhapur" }, items: [{ quantity: 6 }], amount: 51200, status: "Pending", orderDate: new Date("2026-06-04") },
  ];
  res.json(distOrders);
});

router.get('/retailers/top', (req, res) => {
  res.json([
    { rank: 1, name: "Apollo Pharmacy", orders: 142, amount: 284600 },
    { rank: 2, name: "MedPlus Chain",   orders: 118, amount: 236400 },
    { rank: 3, name: "HealthCare Plus", orders: 96,  amount: 192000 },
    { rank: 4, name: "Wellness Hub",    orders: 87,  amount: 174000 },
  ]);
});

router.get('/insights', (req, res) => {
  res.json([
    { icon: "📈", type: "Demand Spike", color: "#6366f1", bg: "#eef2ff", msg: "Monsoon season ahead — stock up on ORS, anti-diarrheals. Demand up 40%." },
    { icon: "⚠️", type: "Low Stock Alert", color: "#f59e0b", bg: "#fffbeb", msg: "Paracetamol 500mg stock at 12-day cover. Reorder 5,000 strips today." },
    { icon: "💡", type: "Scheme Opportunity", color: "#10b981", bg: "#ecfdf5", msg: "Vitamin C range qualifies for extra 3% margin if ordered before Jun 25." },
    { icon: "⏰", type: "Payment Reminder", color: "#ef4444", bg: "#fef2f2", msg: "₹12,800 overdue from Apollo. Risk of credit suspension if not paid by Jun 22." },
    { icon: "🏆", type: "Top Performer", color: "#8b5cf6", bg: "#ede9fe", msg: "Apollo Pharmacy crossed ₹2.8L this month — eligible for Gold Distributor benefits." },
  ]);
});

/* ══════════════════════════════════════════════════════════════════
   RETAILER DASHBOARD
══════════════════════════════════════════════════════════════════ */

router.get('/retailer', (req, res) => {
  res.json(retailerProfile);
});

router.post('/retailer/pay', (req, res) => {
  const { paymentAmount } = req.body;
  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ message: 'Invalid payment amount' });
  }
  retailerProfile.outstandingDue = Math.max(0, retailerProfile.outstandingDue - paymentAmount);
  retailerProfile.creditUsed = Math.max(0, retailerProfile.creditUsed - paymentAmount);
  retailerProfile.paidThisMonth += paymentAmount;
  res.json({ message: 'Payment completed successfully!', retailer: retailerProfile });
});

router.get('/dashboard/trends', (req, res) => {
  res.json([
    { month: "Dec", purchases: 280000, payments: 260000 },
    { month: "Jan", purchases: 310000, payments: 295000 },
    { month: "Feb", purchases: 295000, payments: 310000 },
    { month: "Mar", purchases: 360000, payments: 340000 },
    { month: "Apr", purchases: 408000, payments: 390000 },
    { month: "May", purchases: 482360, payments: 334160 },
  ]);
});

router.get('/dashboard/categories', (req, res) => {
  res.json([
    { label: "Analgesics",    value: 28, color: "#2563eb" },
    { label: "Antibiotics",   value: 22, color: "#7c3aed" },
    { label: "Antidiabetics", value: 18, color: "#06b6d4" },
    { label: "Cardiac",       value: 14, color: "#10b981" },
    { label: "Gastro",        value: 10, color: "#f59e0b" },
    { label: "Others",        value: 8,  color: "#94a3b8" },
  ]);
});

router.get('/orders', (req, res) => {
  const { status } = req.query;
  if (status && status !== 'all') {
    return res.json(orders.filter(o => o.status === status));
  }
  res.json(orders);
});

router.post('/orders', (req, res) => {
  const { items, priority } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in order' });
  }

  let totalAmount = items.reduce((sum, item) => sum + ((item.price || 100) * item.qty), 0);

  const deliveryMap = { express: 'Today, 6 PM', urgent: 'Urgent (4 hrs)', standard: 'Standard (2-3 days)' };
  const summaryName = items.map(i => `${i.name} × ${i.qty}`).join(', ');
  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  const newOrder = {
    _id: `ord${Date.now()}`,
    id: orderId,
    name: summaryName.length > 50 ? summaryName.substring(0, 47) + '...' : summaryName,
    qty: `${items.length} product${items.length > 1 ? 's' : ''}`,
    amount: totalAmount,
    status: 'Pending',
    delivery: deliveryMap[priority] || deliveryMap.standard,
    priority: priority || 'standard',
    items,
    retailer: 'ret1',
    createdAt: new Date(),
  };

  orders.unshift(newOrder);

  retailerProfile.creditUsed += totalAmount;
  retailerProfile.outstandingDue += totalAmount;

  res.status(201).json(newOrder);
});

router.get('/expiry-alerts', (req, res) => {
  res.json([
    { _id: "ea1", name: "Paracetamol 500mg", batch: "Batch #B2840", date: "Jun 2026", risk: "critical", qty: "280 strips" },
    { _id: "ea2", name: "Amoxicillin 250mg",  batch: "Batch #B2241", date: "Jul 2026", risk: "warning",  qty: "140 caps"  },
    { _id: "ea3", name: "Cetirizine 10mg",    batch: "Batch #B2109", date: "Aug 2026", risk: "warning",  qty: "90 tabs"   },
    { _id: "ea4", name: "Omeprazole 20mg",    batch: "Batch #B1984", date: "Oct 2026", risk: "normal",   qty: "200 caps"  },
    { _id: "ea5", name: "Metformin 500mg",    batch: "Batch #B2398", date: "Nov 2026", risk: "normal",   qty: "180 tabs"  },
  ]);
});

router.get('/prescriptions', (req, res) => {
  res.json(prescriptions);
});

router.post('/prescriptions', (req, res) => {
  const { patient, doc } = req.body;
  if (!patient || !doc) {
    return res.status(400).json({ message: 'Patient and Doctor names are required' });
  }
  const rxId = `RX-${Math.floor(4000 + Math.random() * 1000)}`;
  const now = new Date();
  const dateText = `${now.getDate()} ${now.toLocaleString('default', { month: 'short' })}`;
  const newRx = { _id: `rx${Date.now()}`, id: rxId, patient, doc, status: 'Pending', date: dateText };
  prescriptions.unshift(newRx);
  res.status(201).json(newRx);
});

router.get('/ai-alerts', (req, res) => {
  res.json([
    { _id: "ai1", type: "Demand Spike",       icon: "📈", color: "#6366f1", bg: "#eef2ff", msg: "Monsoon season ahead — stock up on ORS, anti-diarrheals and anti-malarials. Demand up 40%." },
    { _id: "ai2", type: "Reorder Alert",      icon: "⚠️", color: "#f59e0b", bg: "#fffbeb", msg: "Paracetamol 500mg stock at 12-day cover. Recommended reorder: 500 strips today." },
    { _id: "ai3", type: "Scheme Opportunity", icon: "💡", color: "#10b981", bg: "#ecfdf5", msg: "Vitamin C range qualifies for an extra 3% margin if ordered before May 25." },
    { _id: "ai4", type: "Payment Reminder",   icon: "⏰", color: "#ef4444", bg: "#fef2f2", msg: "₹12,800 overdue balance. Pay before May 22 to avoid credit limit suspension." },
  ]);
});

// Product search — retailer order modal uses ?search= and expects {name, price}
router.get('/products', async (req, res, next) => {
  const { search } = req.query;
  if (!search) return next(); // no search param → fall through to main product routes
  try {
    const products = await Product.find({
      $or: [
        { name:  { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ],
    })
      .select('name brand category retailerPrice mrp stock')
      .limit(10);

    // Normalise price field so retailer.js can use product.price uniformly
    res.json(products.map(p => ({
      _id:   p._id,
      name:  p.name,
      brand: p.brand,
      price: p.retailerPrice || p.mrp || 0,
      stock: p.stock,
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/products/top', (req, res) => {
  res.json([
    { _id: "p1", rank: 1, name: "Paracetamol 500mg",  brand: "Calpol",    category: "Analgesics",   price: 71,  qty: "200 strips/month" },
    { _id: "p2", rank: 2, name: "Amoxicillin 500mg",  brand: "Novamox",   category: "Antibiotics",  price: 700, qty: "45 strips/month"  },
    { _id: "p3", rank: 3, name: "Metformin 500mg",    brand: "Glycomet",  category: "Antidiabetics",price: 600, qty: "60 strips/month"  },
    { _id: "p4", rank: 4, name: "Atorvastatin 10mg",  brand: "Lipitor",   category: "Cardiac",      price: 45,  qty: "90 tabs/month"    },
    { _id: "p5", rank: 5, name: "Omeprazole 20mg",    brand: "Ocid",      category: "Gastro",       price: 520, qty: "30 caps/month"    },
  ]);
});

module.exports = router;
