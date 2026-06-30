'use strict';
require('dotenv').config();

const connectDB           = require('./config/database');
const Category            = require('./models/Category');
const Product             = require('./models/Product');
const Distributor         = require('./models/Distributor');
const Retailer            = require('./models/Retailer');
const Order               = require('./models/Order');
const Scheme              = require('./models/Scheme');
const Admin               = require('./models/Admin');
const WalletTransaction   = require('./models/WalletTransaction');
const DistributorDispatch = require('./models/DistributorDispatch');
const DistributorReturn   = require('./models/DistributorReturn');

const FRESH = process.argv.includes('--fresh');

// ─── Seed Data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { categoryName: 'Analgesic',     categoryDescription: 'Pain relief medicines',               isActive: true, displayOrder: 1 },
  { categoryName: 'Antibiotic',    categoryDescription: 'Antibacterial medicines',              isActive: true, displayOrder: 2 },
  { categoryName: 'Antidiabetic',  categoryDescription: 'Diabetes management medicines',        isActive: true, displayOrder: 3 },
  { categoryName: 'Cardiac',       categoryDescription: 'Heart and cardiovascular medicines',   isActive: true, displayOrder: 4 },
  { categoryName: 'Gastro',        categoryDescription: 'Gastrointestinal medicines',           isActive: true, displayOrder: 5 },
  { categoryName: 'Antiallergic',  categoryDescription: 'Allergy management medicines',        isActive: true, displayOrder: 6 },
  { categoryName: 'Supplement',    categoryDescription: 'Vitamins and dietary supplements',     isActive: true, displayOrder: 7 },
];

// categoryName is used only to resolve the category ObjectId; it's removed before insert
const PRODUCTS_DATA = [
  { name: 'Paracetamol 500mg',   brand: 'Cipla',       _cat: 'Analgesic',    strength: '500mg',      packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 28,  retailerPrice: 19,  distributorPrice: 15,  gst: 12, stock: 2400, isBestseller: true  },
  { name: 'Ibuprofen 400mg',     brand: 'Sun Pharma',  _cat: 'Analgesic',    strength: '400mg',      packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 42,  retailerPrice: 30,  distributorPrice: 24,  gst: 12, stock: 1800 },
  { name: 'Amoxicillin 500mg',   brand: 'GSK',         _cat: 'Antibiotic',   strength: '500mg',      packSize: '10 caps/strip',  dosageForm: 'Capsule', mrp: 125, retailerPrice: 88,  distributorPrice: 72,  gst: 12, stock: 960  },
  { name: 'Azithromycin 500mg',  brand: 'Pfizer',      _cat: 'Antibiotic',   strength: '500mg',      packSize: '5 tabs/strip',   dosageForm: 'Tablet',  mrp: 145, retailerPrice: 102, distributorPrice: 84,  gst: 12, stock: 720  },
  { name: 'Cetirizine 10mg',     brand: 'Abbott',      _cat: 'Antiallergic', strength: '10mg',       packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 32,  retailerPrice: 22,  distributorPrice: 17,  gst: 12, stock: 3200, isBestseller: true },
  { name: 'Metformin 500mg',     brand: 'USV',         _cat: 'Antidiabetic', strength: '500mg',      packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 55,  retailerPrice: 38,  distributorPrice: 31,  gst: 12, stock: 1440 },
  { name: 'Glimepiride 1mg',     brand: 'Torrent',     _cat: 'Antidiabetic', strength: '1mg',        packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 78,  retailerPrice: 55,  distributorPrice: 44,  gst: 12, stock: 560  },
  { name: 'Atorvastatin 10mg',   brand: 'Cipla',       _cat: 'Cardiac',      strength: '10mg',       packSize: '15 tabs/strip',  dosageForm: 'Tablet',  mrp: 165, retailerPrice: 116, distributorPrice: 95,  gst: 12, stock: 840  },
  { name: 'Amlodipine 5mg',      brand: 'Sun Pharma',  _cat: 'Cardiac',      strength: '5mg',        packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 48,  retailerPrice: 34,  distributorPrice: 27,  gst: 12, stock: 1120 },
  { name: 'Omeprazole 20mg',     brand: 'AstraZeneca', _cat: 'Gastro',       strength: '20mg',       packSize: '14 caps/strip',  dosageForm: 'Capsule', mrp: 118, retailerPrice: 82,  distributorPrice: 67,  gst: 12, stock: 1680 },
  { name: 'Ondansetron 4mg',     brand: 'GSK',         _cat: 'Gastro',       strength: '4mg',        packSize: '10 tabs/strip',  dosageForm: 'Tablet',  mrp: 72,  retailerPrice: 50,  distributorPrice: 41,  gst: 12, stock: 380  },
  { name: 'Vitamin D3 60K IU',   brand: 'Pfizer',      _cat: 'Supplement',   strength: '60000 IU',   packSize: '4 caps/strip',   dosageForm: 'Capsule', mrp: 185, retailerPrice: 130, distributorPrice: 106, gst: 5,  stock: 2100, isFeatured: true },
];

const KYC_VERIFIED = [
  { type: 'gst',          url: 'https://placehold.co/gst.pdf',     status: 'verified' },
  { type: 'drug_license', url: 'https://placehold.co/license.pdf', status: 'verified' },
];

const RETAILERS_DATA = [
  { name: 'Apollo Manager',      email: 'apollo@example.in',      phone: '+91 98200 44312', shopName: 'Apollo Pharmacy',    shopAddress: { street: 'Linking Road',      city: 'Mumbai',      state: 'Maharashtra', pincode: '400050' }, creditLimit: 200000, uphaarTier: 'Gold',     uphaarPoints: 8420, walletBal: 18500 },
  { name: 'MedPlus Manager',     email: 'medplus@example.in',     phone: '+91 98200 44313', shopName: 'MedPlus Pharmacy',   shopAddress: { street: 'FC Road',           city: 'Pune',        state: 'Maharashtra', pincode: '411004' }, creditLimit: 150000, uphaarTier: 'Silver',   uphaarPoints: 4210, walletBal: 12000 },
  { name: 'LifePharm Manager',   email: 'lifepharm@example.in',   phone: '+91 98200 44314', shopName: 'LifePharm Medical',  shopAddress: { street: 'MG Road',           city: 'Thane',       state: 'Maharashtra', pincode: '400601' }, creditLimit: 100000, uphaarTier: 'Silver',   uphaarPoints: 2840, walletBal: 8200  },
  { name: 'Wellness Manager',    email: 'wellness@example.in',    phone: '+91 98200 44315', shopName: 'Wellness Corner',    shopAddress: { street: 'Nashik Phata',      city: 'Nashik',      state: 'Maharashtra', pincode: '422001' }, creditLimit: 80000,  uphaarTier: 'Silver',   uphaarPoints: 1120, walletBal: 5500  },
  { name: 'CareMax Manager',     email: 'caremax@example.in',     phone: '+91 98200 44316', shopName: 'CareMax Pharmacy',   shopAddress: { street: 'Sitabuldi',         city: 'Nagpur',      state: 'Maharashtra', pincode: '440012' }, creditLimit: 120000, uphaarTier: 'Silver',   uphaarPoints: 3320, walletBal: 9800  },
  { name: 'Zydus Manager',       email: 'zydus@example.in',       phone: '+91 98200 44317', shopName: 'Zydus Wellness',     shopAddress: { street: 'Bund Garden Road',  city: 'Pune',        state: 'Maharashtra', pincode: '411001' }, creditLimit: 175000, uphaarTier: 'Gold',     uphaarPoints: 6710, walletBal: 22000 },
  { name: 'HealthFirst Manager', email: 'healthfirst@example.in', phone: '+91 98200 44318', shopName: 'HealthFirst Medical',shopAddress: { street: 'Dadar West',        city: 'Mumbai',      state: 'Maharashtra', pincode: '400028' }, creditLimit: 90000,  uphaarTier: 'Silver',   uphaarPoints: 980,  walletBal: 4200  },
  { name: 'PharmaPlus Manager',  email: 'pharmaplus@example.in',  phone: '+91 98200 44319', shopName: 'PharmaPlus',         shopAddress: { street: 'Aurangabad Road',   city: 'Aurangabad',  state: 'Maharashtra', pincode: '431001' }, creditLimit: 60000,  uphaarTier: 'Silver',   uphaarPoints: 620,  walletBal: 3100  },
  { name: 'MediCare Manager',    email: 'medicare@example.in',    phone: '+91 98200 44320', shopName: 'MediCare Store',     shopAddress: { street: 'Sector 17',         city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400703' }, creditLimit: 110000, uphaarTier: 'Silver',   uphaarPoints: 2580, walletBal: 7600  },
];

// retIdx = index into retailerDocs, pIdx = index into productDocs
const ORDER_SEEDS = [
  { retIdx: 0, items: [{ pIdx: 0,  qty: 50 }, { pIdx: 4,  qty: 30 }], status: 'delivered',  paymentStatus: 'paid',    priority: 'standard', daysAgo: 3,  orderNum: 'ORD-20260615-00001' },
  { retIdx: 1, items: [{ pIdx: 2,  qty: 20 }, { pIdx: 5,  qty: 40 }], status: 'dispatched', paymentStatus: 'partial', priority: 'express',  daysAgo: 1,  orderNum: 'ORD-20260617-00002' },
  { retIdx: 2, items: [{ pIdx: 7,  qty: 15 }, { pIdx: 8,  qty: 25 }], status: 'approved',   paymentStatus: 'unpaid',  priority: 'standard', daysAgo: 2,  orderNum: 'ORD-20260616-00003' },
  { retIdx: 3, items: [{ pIdx: 9,  qty: 30 }],                         status: 'pending',    paymentStatus: 'unpaid',  priority: 'standard', daysAgo: 0,  orderNum: 'ORD-20260618-00004' },
  { retIdx: 4, items: [{ pIdx: 1,  qty: 60 }, { pIdx: 3,  qty: 20 }], status: 'delivered',  paymentStatus: 'paid',    priority: 'urgent',   daysAgo: 7,  orderNum: 'ORD-20260611-00005' },
  { retIdx: 5, items: [{ pIdx: 11, qty: 40 }, { pIdx: 6,  qty: 10 }], status: 'delivered',  paymentStatus: 'paid',    priority: 'standard', daysAgo: 5,  orderNum: 'ORD-20260613-00006' },
  { retIdx: 6, items: [{ pIdx: 4,  qty: 80 }],                         status: 'pending',    paymentStatus: 'unpaid',  priority: 'standard', daysAgo: 0,  orderNum: 'ORD-20260618-00007' },
  { retIdx: 7, items: [{ pIdx: 10, qty: 25 }, { pIdx: 9,  qty: 20 }], status: 'approved',   paymentStatus: 'unpaid',  priority: 'express',  daysAgo: 1,  orderNum: 'ORD-20260617-00008' },
  { retIdx: 8, items: [{ pIdx: 0,  qty: 100},{ pIdx: 5,  qty: 60 }],  status: 'dispatched', paymentStatus: 'partial', priority: 'standard', daysAgo: 2,  orderNum: 'ORD-20260616-00009' },
  { retIdx: 0, items: [{ pIdx: 7,  qty: 30 }, { pIdx: 8,  qty: 20 }], status: 'returned',   paymentStatus: 'paid',    priority: 'standard', daysAgo: 10, orderNum: 'ORD-20260608-00010' },
  { retIdx: 1, items: [{ pIdx: 2,  qty: 40 }],                         status: 'delivered',  paymentStatus: 'paid',    priority: 'express',  daysAgo: 4,  orderNum: 'ORD-20260614-00011' },
  { retIdx: 2, items: [{ pIdx: 11, qty: 50 }, { pIdx: 3,  qty: 15 }], status: 'pending',    paymentStatus: 'unpaid',  priority: 'standard', daysAgo: 0,  orderNum: 'ORD-20260618-00012' },
];

const SCHEMES_DATA = [
  { name: 'Monsoon Bonanza',     schemeCode: 'UPHAAR-001', schemeType: 'cashback',    cashbackPercentage: 5, eligibleFor: 'both',        eligibleTiers: ['Silver', 'Gold', 'Platinum'], validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'), isActive: true,  description: 'Extra 5% cashback on all orders during monsoon season' },
  { name: 'Gold Member Discount',schemeCode: 'UPHAAR-002', schemeType: 'discount',    discountPercentage: 8, eligibleFor: 'retailer',    eligibleTiers: ['Gold', 'Platinum'],           validFrom: new Date('2026-06-01'), validTo: new Date('2026-07-31'), isActive: true,  description: '8% discount exclusively for Gold-tier members' },
  { name: 'Bulk Buy Bonus',      schemeCode: 'UPHAAR-003', schemeType: 'bonus_units', eligibleFor: 'distributor', eligibleTiers: ['Silver', 'Gold', 'Platinum'],  validFrom: new Date('2026-05-01'), validTo: new Date('2026-07-15'), isActive: true,  description: 'Bonus units on bulk purchases above ₹50,000', minOrderValue: 50000 },
  { name: 'Flat ₹500 Off',       schemeCode: 'UPHAAR-004', schemeType: 'flat_off',    flatOff: 500,          eligibleFor: 'retailer',    eligibleTiers: ['Silver', 'Gold', 'Platinum'], validFrom: new Date('2026-07-01'), validTo: new Date('2026-07-31'), isActive: false, description: 'Flat ₹500 discount on orders above ₹5,000', minOrderValue: 5000 },
  { name: 'Silver Cashback',     schemeCode: 'UPHAAR-005', schemeType: 'cashback',    cashbackPercentage: 3, eligibleFor: 'retailer',    eligibleTiers: ['Silver'],                    validFrom: new Date('2026-06-01'), validTo: new Date('2026-09-30'), isActive: true,  description: '3% cashback for Silver-tier retailers' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();
  console.log('\n🌱  MediBridge — Seed Script\n' + '─'.repeat(42));

  if (FRESH) {
    console.log('⚠   --fresh: clearing all collections...');
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Distributor.deleteMany({}),
      Retailer.deleteMany({}),
      Order.deleteMany({}),
      Scheme.deleteMany({}),
      Admin.deleteMany({}),
      WalletTransaction.deleteMany({}),
      DistributorDispatch.deleteMany({}),
      DistributorReturn.deleteMany({}),
    ]);
    console.log('✓   Collections cleared\n');
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  process.stdout.write('    Categories …          ');
  const catDocs = await Category.create(CATEGORIES);
  const catMap  = Object.fromEntries(catDocs.map(c => [c.categoryName, c._id]));
  console.log(`✓  (${catDocs.length})`);

  // ── Products ───────────────────────────────────────────────────────────────
  process.stdout.write('    Products …            ');
  const prodDocs = await Product.create(
    PRODUCTS_DATA.map(({ _cat, ...p }) => ({
      ...p,
      category:     catMap[_cat],
      categoryName: _cat,
    }))
  );
  console.log(`✓  (${prodDocs.length})`);

  // ── Distributors / stockists ────────────────────────────────────────────────
  // Two non-overlapping coverage areas so order routing is demonstrable:
  // MedCore (Mumbai region 400xxx) and Pune Stockist (Pune/Nashik/Nagpur/Aurangabad).
  process.stdout.write('    Distributors …        ');
  const dist = await new Distributor({
    name:             'Rajesh Mehta',
    email:            'rajesh@medcore.in',
    password:         'Medcore@2024',
    phone:            '+91 98200 10001',
    businessName:     'MedCore Distributors Pvt Ltd',
    businessAddress:  { street: '14, MIDC Industrial Area, Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400093' },
    gstNumber:        '27AABCM1234F1Z5',
    drugLicenseNumber:'MH-MUM-D-2019-00421',
    territory:        ['Mumbai', 'Thane', 'Navi Mumbai'],
    serviceablePincodes: ['400093', '400050', '400601', '400028', '400703', '400001'],
    status:           'active',
    wallet:           { balance: 125000 },
  }).save();

  const dist2 = await new Distributor({
    name:             'Sunil Kulkarni',
    email:            'sunil@punestock.in',
    password:         'Pune@2024!!!',
    phone:            '+91 98200 10002',
    businessName:     'Pune Stockist & Supply Co',
    businessAddress:  { street: '7, Shivajinagar', city: 'Pune', state: 'Maharashtra', pincode: '411005' },
    gstNumber:        '27AABCP5678G1Z9',
    drugLicenseNumber:'MH-PUN-D-2020-00733',
    territory:        ['Pune', 'Nashik', 'Nagpur', 'Aurangabad'],
    serviceablePincodes: ['411005', '411001', '411004', '422001', '440012', '431001'],
    status:           'active',
    wallet:           { balance: 90000 },
  }).save();
  console.log('✓  (2)');

  // ── Retailers ──────────────────────────────────────────────────────────────
  process.stdout.write('    Retailers …           ');
  const retDocs = [];
  for (let i = 0; i < RETAILERS_DATA.length; i++) {
    const rd = RETAILERS_DATA[i];
    const doc = await new Retailer({
      name:             rd.name,
      email:            rd.email,
      password:         'Retail@2024!',
      phone:            rd.phone,
      shopName:         rd.shopName,
      shopAddress:      rd.shopAddress,
      gstNumber:        `27RETAIL${String(i + 1).padStart(4, '0')}Z1`,
      drugLicenseNumber:`MH-RET-D-2020-${String(i + 1001).padStart(5, '0')}`,
      distributor:      dist._id,
      status:           'active',
      kycDocuments:     KYC_VERIFIED,
      creditLimit:      rd.creditLimit,
      wallet:           { balance: rd.walletBal },
      uphaarTier:       rd.uphaarTier,
      uphaarPoints:     rd.uphaarPoints,
    }).save();
    retDocs.push(doc);
  }
  console.log(`✓  (${retDocs.length})`);

  // One pending retailer to demo admin KYC approval in the admin panel
  process.stdout.write('    Pending retailer …     ');
  await new Retailer({
    name:              'Sunrise Owner',
    email:             'sunrise@example.in',
    password:          'Retail@2024!',
    phone:             '+91 98200 44321',
    shopName:          'Sunrise Pharmacy',
    shopAddress:       { street: 'Station Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    gstNumber:         '27RETAILPEND0Z1',
    drugLicenseNumber: 'MH-RET-D-2024-09999',
    status:            'pending',
    role:              'ret',
  }).save();
  console.log('✓  (1)');

  // ── Orders ─────────────────────────────────────────────────────────────────
  process.stdout.write('    Orders …              ');
  const orderDocs = [];
  for (const s of ORDER_SEEDS) {
    const retailer = retDocs[s.retIdx];
    const items = s.items.map(it => {
      const p = prodDocs[it.pIdx];
      return {
        product:     p._id,
        productName: p.name,
        brand:       p.brand,
        quantity:    it.qty,
        unitPrice:   p.distributorPrice,
        gstRate:     p.gst,
        totalPrice:  p.distributorPrice * it.qty,
      };
    });
    const subtotal  = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const gstAmount = items.reduce((acc, it) => acc + it.totalPrice * it.gstRate / 100, 0);
    const createdAt = new Date(Date.now() - s.daysAgo * 86_400_000);

    const order = await new Order({
      orderNumber:     s.orderNum,
      retailer:        retailer._id,
      distributor:     dist._id,
      items,
      subtotal,
      gstAmount,
      totalAmount:     subtotal + gstAmount,
      status:          s.status,
      paymentStatus:   s.paymentStatus,
      deliveryPriority:s.priority,
      deliveryAddress: retailer.shopAddress,
      timeline:        [{ status: 'pending', note: 'Order placed', timestamp: createdAt }],
      createdAt,
      updatedAt:       createdAt,
    }).save();
    orderDocs.push(order);
  }
  console.log(`✓  (${orderDocs.length})`);

  // ── Schemes ────────────────────────────────────────────────────────────────
  process.stdout.write('    Schemes …             ');
  const schemeDocs = [];
  for (const sd of SCHEMES_DATA) {
    schemeDocs.push(await new Scheme(sd).save());
  }
  console.log(`✓  (${schemeDocs.length})`);

  // ── Admin ──────────────────────────────────────────────────────────────────
  process.stdout.write('    Admin …               ');
  await new Admin({
    name:     'Super Admin',
    email:    'admin@medibridge.in',
    password: 'Admin@2024!!',
    role:     'superadmin',
    isActive: true,
  }).save();
  console.log('✓  (1)');

  // ── Wallet Transactions ────────────────────────────────────────────────────
  process.stdout.write('    Wallet transactions … ');
  const txns = [
    { userId: dist._id,       userType: 'distributor', type: 'credit', amount: 85000, balance: 125000, description: 'Payment received from Apollo Pharmacy',       referenceType: 'payment'  },
    { userId: dist._id,       userType: 'distributor', type: 'debit',  amount: 24500, balance: 100500, description: 'Weekly settlement payout to HQ',              referenceType: 'payment'  },
    { userId: retDocs[0]._id, userType: 'retailer',    type: 'credit', amount: 10000, balance: 18500,  description: 'Wallet recharge via UPI',                     referenceType: 'recharge' },
    { userId: retDocs[0]._id, userType: 'retailer',    type: 'debit',  amount: 45200, balance: 8500,   description: `Order payment – ${ORDER_SEEDS[0].orderNum}`,  referenceType: 'order'    },
    { userId: retDocs[1]._id, userType: 'retailer',    type: 'credit', amount: 500,   balance: 12500,  description: 'Cashback – Monsoon Bonanza scheme',           referenceType: 'cashback' },
    { userId: retDocs[1]._id, userType: 'retailer',    type: 'debit',  amount: 38200, balance: 12000,  description: `Order payment – ${ORDER_SEEDS[1].orderNum}`,  referenceType: 'order'    },
    { userId: retDocs[4]._id, userType: 'retailer',    type: 'credit', amount: 25000, balance: 34800,  description: 'Wallet recharge via NEFT',                    referenceType: 'recharge' },
    { userId: retDocs[4]._id, userType: 'retailer',    type: 'credit', amount: 750,   balance: 35550,  description: 'Cashback – Silver Cashback scheme',           referenceType: 'cashback' },
  ];
  await WalletTransaction.insertMany(txns);
  console.log(`✓  (${txns.length})`);

  // ── Distributor Dispatches ─────────────────────────────────────────────────
  process.stdout.write('    Dispatches …          ');
  const p = prodDocs; // shorthand
  const DISPATCHES = [
    { distributor: dist._id,  product: p[0]._id,  batchNumber: 'B001', quantitySent: 500, invoiceNumber: 'INV-2026-001', dispatchDate: new Date('2026-06-01'), remarks: 'Initial dispatch' },
    { distributor: dist._id,  product: p[0]._id,  batchNumber: 'B001', quantitySent: 200, invoiceNumber: 'INV-2026-002', dispatchDate: new Date('2026-06-10'), remarks: 'Restock' },
    { distributor: dist._id,  product: p[1]._id,  batchNumber: 'B002', quantitySent: 400, invoiceNumber: 'INV-2026-003', dispatchDate: new Date('2026-06-05'), remarks: 'Initial dispatch' },
    { distributor: dist._id,  product: p[4]._id,  batchNumber: 'B003', quantitySent: 350, invoiceNumber: 'INV-2026-004', dispatchDate: new Date('2026-06-08'), remarks: '' },
    { distributor: dist._id,  product: p[9]._id,  batchNumber: 'B004', quantitySent: 300, invoiceNumber: 'INV-2026-005', dispatchDate: new Date('2026-06-12'), remarks: 'Bulk order' },
    { distributor: dist._id,  product: p[11]._id, batchNumber: 'B005', quantitySent: 250, invoiceNumber: 'INV-2026-006', dispatchDate: new Date('2026-06-15'), remarks: '' },
    { distributor: dist2._id, product: p[2]._id,  batchNumber: 'B006', quantitySent: 300, invoiceNumber: 'INV-2026-007', dispatchDate: new Date('2026-06-03'), remarks: 'Initial dispatch' },
    { distributor: dist2._id, product: p[5]._id,  batchNumber: 'B007', quantitySent: 480, invoiceNumber: 'INV-2026-008', dispatchDate: new Date('2026-06-07'), remarks: '' },
    { distributor: dist2._id, product: p[7]._id,  batchNumber: 'B008', quantitySent: 200, invoiceNumber: 'INV-2026-009', dispatchDate: new Date('2026-06-11'), remarks: 'Restock' },
    { distributor: dist2._id, product: p[3]._id,  batchNumber: 'B009', quantitySent: 150, invoiceNumber: 'INV-2026-010', dispatchDate: new Date('2026-06-14'), remarks: '' },
    { distributor: dist2._id, product: p[8]._id,  batchNumber: 'B010', quantitySent: 220, invoiceNumber: 'INV-2026-011', dispatchDate: new Date('2026-06-16'), remarks: 'Urgent supply' },
    { distributor: dist._id,  product: p[6]._id,  batchNumber: 'B011', quantitySent: 80,  invoiceNumber: 'INV-2026-012', dispatchDate: new Date('2026-06-18'), remarks: '' },
  ];
  const existingDispatches = await DistributorDispatch.countDocuments();
  let dispatchDocs = [];
  if (!existingDispatches) {
    dispatchDocs = await DistributorDispatch.insertMany(DISPATCHES);
    console.log(`✓  (${dispatchDocs.length})`);
  } else {
    console.log(`✓  (skipped — already seeded; use --fresh to reset)`);
  }

  // ── Distributor Returns ────────────────────────────────────────────────────
  process.stdout.write('    Returns …             ');
  const RETURNS = [
    { distributor: dist._id,  product: p[0]._id,  batchNumber: 'B001', quantityReturned: 20,  returnReason: 'Damaged',          returnDate: new Date('2026-06-20'), returnStatus: 'Approved', remarks: 'Damaged in transit' },
    { distributor: dist._id,  product: p[0]._id,  batchNumber: 'B001', quantityReturned: 5,   returnReason: 'Expired',           returnDate: new Date('2026-06-22'), returnStatus: 'Approved', remarks: '' },
    { distributor: dist._id,  product: p[1]._id,  batchNumber: 'B002', quantityReturned: 15,  returnReason: 'Packaging Damage',  returnDate: new Date('2026-06-18'), returnStatus: 'Approved', remarks: '' },
    { distributor: dist._id,  product: p[4]._id,  batchNumber: 'B003', quantityReturned: 300, returnReason: 'Near Expiry',       returnDate: new Date('2026-06-19'), returnStatus: 'Approved', remarks: 'Batch near expiry — bulk return' },
    { distributor: dist._id,  product: p[9]._id,  batchNumber: 'B004', quantityReturned: 30,  returnReason: 'Wrong Product',     returnDate: new Date('2026-06-21'), returnStatus: 'Pending',  remarks: 'Shipped wrong SKU' },
    { distributor: dist2._id, product: p[2]._id,  batchNumber: 'B006', quantityReturned: 10,  returnReason: 'Leakage',           returnDate: new Date('2026-06-17'), returnStatus: 'Approved', remarks: 'Capsule seal broken' },
    { distributor: dist2._id, product: p[5]._id,  batchNumber: 'B007', quantityReturned: 50,  returnReason: 'Near Expiry',       returnDate: new Date('2026-06-20'), returnStatus: 'Approved', remarks: '' },
    { distributor: dist2._id, product: p[7]._id,  batchNumber: 'B008', quantityReturned: 8,   returnReason: 'Damaged',           returnDate: new Date('2026-06-22'), returnStatus: 'Rejected', remarks: 'Damage not verified' },
    { distributor: dist._id,  product: p[6]._id,  batchNumber: 'B011', quantityReturned: 80,  returnReason: 'Expired',           returnDate: new Date('2026-06-23'), returnStatus: 'Approved', remarks: 'Full batch expired' },
  ];
  const existingReturns = await DistributorReturn.countDocuments();
  let returnDocs = [];
  if (!existingReturns) {
    returnDocs = await DistributorReturn.insertMany(RETURNS);
    console.log(`✓  (${returnDocs.length})`);
  } else {
    console.log(`✓  (skipped — already seeded; use --fresh to reset)`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(42));
  console.log('✅  Seed complete!\n');
  console.log('  Categories          :', catDocs.length);
  console.log('  Products            :', prodDocs.length);
  console.log('  Distributor         :', 1);
  console.log('  Retailers           :', retDocs.length);
  console.log('  Orders              :', orderDocs.length);
  console.log('  Schemes             :', schemeDocs.length);
  console.log('  Admin               :', 1);
  console.log('  Wallet transactions :', txns.length);
  console.log('  Dispatches          :', dispatchDocs.length);
  console.log('  Returns             :', returnDocs.length);
  console.log('\n  Login credentials');
  console.log('  ─────────────────────────────────────────');
  console.log('  Admin        admin@medibridge.in   / Admin@2024!!');
  console.log('  Distributor  rajesh@medcore.in     / Medcore@2024');
  console.log('  Retailer     apollo@example.in     / Retail@2024!');
  console.log('  ─────────────────────────────────────────\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('\n✗  Seed failed:', err.message);
  process.exit(1);
});
