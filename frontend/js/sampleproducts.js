/* =====================================================================
   seed/sampleProducts.js — Database Seed Script
   Populates database with sample categories and products
   
   Run with: npm run seed
   ===================================================================== */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

// Sample categories
const sampleCategories = [
  {
    categoryName: 'Tablets',
    categoryDescription: 'Oral tablets for various conditions',
    displayOrder: 1
  },
  {
    categoryName: 'Capsules',
    categoryDescription: 'Gelatin and vegetarian capsules',
    displayOrder: 2
  },
  {
    categoryName: 'Syrups',
    categoryDescription: 'Liquid oral formulations',
    displayOrder: 3
  },
  {
    categoryName: 'Injections',
    categoryDescription: 'Sterile injectable formulations',
    displayOrder: 4
  },
  {
    categoryName: 'Ointments',
    categoryDescription: 'Topical creams and ointments',
    displayOrder: 5
  },
  {
    categoryName: 'Protein Powder',
    categoryDescription: 'Nutritional protein supplements',
    displayOrder: 6
  },
  {
    categoryName: 'Nutraceuticals',
    categoryDescription: 'Functional food supplements',
    displayOrder: 7
  },
  {
    categoryName: 'Ayurvedic',
    categoryDescription: 'Traditional ayurvedic medicines',
    displayOrder: 8
  },
  {
    categoryName: 'Drops',
    categoryDescription: 'Eye, ear, and nasal drops',
    displayOrder: 9
  },
  {
    categoryName: 'Sachets',
    categoryDescription: 'Powdered sachets and packets',
    displayOrder: 10
  }
];

// Sample products - comprehensive pharmaceutical data
const sampleProducts = [
  // Tablets
  {
    name: 'Paracip 500 Tablets',
    brand: 'Cipla',
    categoryName: 'Tablets',
    strength: '500 mg',
    packSize: '10 x 10 Tablets',
    dosageForm: 'Oral Tablet',
    composition: ['Paracetamol IP 500 mg', 'Excipients q.s.'],
    description: 'Analgesic and antipyretic tablet for pain relief and fever reduction',
    uses: 'Used to relieve mild to moderate pain such as headache, toothache, body ache and to reduce fever.',
    benefits: ['Fast Relief', 'WHO-GMP Certified', 'High Quality Manufacturing', 'Trusted Product'],
    sideEffects: ['Nausea', 'Headache', 'Dizziness', 'Skin rash (rare)'],
    storage: ['Store below 25°C', 'Keep away from direct sunlight', 'Keep out of reach of children'],
    mrp: 30.0,
    retailerPrice: 21.5,
    distributorPrice: 18.75,
    gst: 12,
    stock: 4200,
    minimumOrderQuantity: 50,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    rating: 4.6,
    reviewCount: 312,
    manufacturingDate: '2025-03',
    expiryDate: '2028-02',
    distributor: {
      name: 'HealthLine Distributors Pvt. Ltd.',
      location: 'Mumbai, Maharashtra',
      phone: '+91 98200 11223',
      email: 'sales@healthlinedist.in'
    },
    delivery: {
      time: '2–4 business days',
      coverage: 'Pan India (28 states)',
      shipping: 'Free shipping on orders above ₹5,000'
    }
  },
  {
    name: 'Crocin 650 Tablets',
    brand: 'GSK',
    categoryName: 'Tablets',
    strength: '650 mg',
    packSize: '15 Tablets',
    dosageForm: 'Film-coated Tablet',
    composition: ['Paracetamol IP 650 mg', 'Excipients q.s.'],
    description: 'Effective pain reliever and fever reducer',
    uses: 'Relief from pain and fever associated with cold, cough, and other conditions.',
    benefits: ['Rapid Action', 'WHO-GMP Certified', 'Doctor Recommended', 'Trusted Product'],
    sideEffects: ['Rare side effects', 'Nausea (uncommon)', 'Allergic reaction (rare)'],
    storage: ['Store below 25°C', 'Protect from moisture', 'Keep out of reach of children'],
    mrp: 45.0,
    retailerPrice: 31.5,
    distributorPrice: 27.5,
    gst: 12,
    stock: 3500,
    minimumOrderQuantity: 50,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    rating: 4.7,
    reviewCount: 425,
    manufacturingDate: '2025-02',
    expiryDate: '2028-01',
    distributor: {
      name: 'GSK Pharma Limited',
      location: 'Bangalore, Karnataka',
      phone: '+91 98755 44556',
      email: 'bulk@gskpharma.in'
    },
    delivery: {
      time: '2–3 business days',
      coverage: 'Pan India',
      shipping: 'Free above ₹8,000'
    }
  },
  {
    name: 'Metfor 500 Tablets',
    brand: 'Sun Pharma',
    categoryName: 'Tablets',
    strength: '500 mg',
    packSize: '10 x 20 Tablets',
    dosageForm: 'Sustained-release Tablet',
    composition: ['Metformin Hydrochloride IP 500 mg', 'Excipients q.s.'],
    description: 'Anti-diabetic tablet for type 2 diabetes management',
    uses: 'First-line oral anti-diabetic agent for the management of type-2 diabetes mellitus.',
    benefits: ['Sustained Release', 'WHO-GMP Certified', 'High Quality Manufacturing', 'Trusted Product'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Metallic taste', 'Loss of appetite'],
    storage: ['Store below 30°C', 'Protect from moisture', 'Keep out of reach of children'],
    mrp: 58.0,
    retailerPrice: 42.0,
    distributorPrice: 36.0,
    gst: 12,
    stock: 3100,
    minimumOrderQuantity: 50,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    rating: 4.5,
    reviewCount: 287,
    manufacturingDate: '2025-02',
    expiryDate: '2028-01',
    distributor: {
      name: 'Sun Pharma Distributors',
      location: 'Ahmedabad, Gujarat',
      phone: '+91 99250 44556',
      email: 'orders@sunpharma.co.in'
    },
    delivery: {
      time: '3–5 business days',
      coverage: 'Pan India',
      shipping: 'Standard shipping ₹120'
    }
  },
  // Capsules
  {
    name: 'Azithro 250 Capsules',
    brand: 'Sun Pharma',
    categoryName: 'Capsules',
    strength: '250 mg',
    packSize: '3 x 6 Capsules',
    dosageForm: 'Oral Capsule',
    composition: ['Azithromycin IP 250 mg', 'Excipients q.s.'],
    description: 'Broad-spectrum antibiotic for bacterial infections',
    uses: 'Broad-spectrum antibiotic used to treat respiratory, throat and skin infections caused by bacteria.',
    benefits: ['Broad Spectrum', 'WHO-GMP Certified', 'High Quality Manufacturing', 'Trusted Product'],
    sideEffects: ['Nausea', 'Stomach upset', 'Dizziness', 'Diarrhoea'],
    storage: ['Store below 25°C', 'Keep away from moisture', 'Keep out of reach of children'],
    mrp: 110.0,
    retailerPrice: 84.0,
    distributorPrice: 72.5,
    gst: 12,
    stock: 180,
    minimumOrderQuantity: 30,
    isFeatured: false,
    isBestseller: true,
    isNewArrival: false,
    rating: 4.4,
    reviewCount: 198,
    manufacturingDate: '2025-01',
    expiryDate: '2027-12',
    distributor: {
      name: 'MediCore Supplies',
      location: 'Ahmedabad, Gujarat',
      phone: '+91 99250 44556',
      email: 'orders@medicore.co.in'
    },
    delivery: {
      time: '3–5 business days',
      coverage: 'Pan India',
      shipping: 'Standard shipping ₹120'
    }
  },
  {
    name: 'Amox 500 Capsules',
    brand: 'Cipla',
    categoryName: 'Capsules',
    strength: '500 mg',
    packSize: '10 x 10 Capsules',
    dosageForm: 'Oral Capsule',
    composition: ['Amoxicillin Trihydrate IP eq. to Amoxicillin 500 mg', 'Excipients q.s.'],
    description: 'Penicillin antibiotic for bacterial infections',
    uses: 'Penicillin antibiotic for ear, nose, throat, chest and urinary tract infections.',
    benefits: ['Broad Spectrum', 'WHO-GMP Certified', 'High Quality Manufacturing', 'Trusted Product'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Rash', 'Headache'],
    storage: ['Store below 25°C', 'Protect from moisture', 'Keep out of reach of children'],
    mrp: 92.0,
    retailerPrice: 68.0,
    distributorPrice: 59.0,
    gst: 12,
    stock: 140,
    minimumOrderQuantity: 50,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: true,
    rating: 4.2,
    reviewCount: 176,
    manufacturingDate: '2025-01',
    expiryDate: '2027-11',
    distributor: {
      name: 'MediCore Supplies',
      location: 'Ahmedabad, Gujarat',
      phone: '+91 99250 44556',
      email: 'orders@medicore.co.in'
    },
    delivery: {
      time: '3–5 business days',
      coverage: 'Pan India',
      shipping: 'Standard shipping ₹120'
    }
  },
  // Syrups
  {
    name: 'Cofdex Cough Syrup',
    brand: `dr reddy's `,
    categoryName: 'Syrups',
    strength: '100 ml',
    packSize: '1 x 100 ml Bottle',
    dosageForm: 'Oral Syrup',
    composition: ['Dextromethorphan HBr 10 mg/5ml', 'Chlorpheniramine Maleate 2 mg/5ml', 'Flavoured base q.s.'],
    description: 'Effective cough suppressant with antihistamine',
    uses: 'Provides relief from dry cough, throat irritation and associated allergic symptoms.',
    benefits: ['Soothing Relief', 'WHO-GMP Certified', 'Sugar-free Variant', 'Trusted Product'],
    sideEffects: ['Drowsiness', 'Dry mouth', 'Dizziness', 'Nausea'],
    storage: ['Store below 25°C', 'Do not freeze', 'Keep out of reach of children'],
    mrp: 95.0,
    retailerPrice: 70.0,
    distributorPrice: 61.0,
    gst: 5,
    stock: 0,
    minimumOrderQuantity: 24,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: false,
    rating: 4.1,
    reviewCount: 87,
    manufacturingDate: '2024-11',
    expiryDate: '2027-10',
    distributor: {
      name: 'Wellness Pharma Logistics',
      location: 'Hyderabad, Telangana',
      phone: '+91 90000 77881',
      email: 'support@wellnesspharma.in'
    },
    delivery: {
      time: '4–6 business days',
      coverage: 'South & West India',
      shipping: 'Free shipping on orders above ₹4,000'
    }
  },
  {
    name: 'Ironvit Tonic Syrup',
    brand: 'Zydus',
    categoryName: 'Syrups',
    strength: '200 ml',
    packSize: '1 x 200 ml Bottle',
    dosageForm: 'Oral Syrup',
    composition: ['Ferrous Ascorbate 30 mg', 'Folic Acid 550 mcg', 'Vitamin B12 7.5 mcg', 'Flavoured base q.s.'],
    description: 'Iron and vitamin supplement for anaemia',
    uses: 'Iron and vitamin supplement for the prevention and treatment of iron-deficiency anaemia.',
    benefits: ['Better Absorption', 'WHO-GMP Certified', 'Pleasant Taste', 'Trusted Product'],
    sideEffects: ['Constipation', 'Nausea', 'Dark stools', 'Stomach upset'],
    storage: ['Store below 25°C', 'Do not freeze', 'Keep out of reach of children'],
    mrp: 165.0,
    retailerPrice: 122.0,
    distributorPrice: 106.0,
    gst: 18,
    stock: 540,
    minimumOrderQuantity: 24,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: false,
    rating: 4.0,
    reviewCount: 64,
    manufacturingDate: '2025-02',
    expiryDate: '2027-09',
    distributor: {
      name: 'Wellness Pharma Logistics',
      location: 'Hyderabad, Telangana',
      phone: '+91 90000 77881',
      email: 'support@wellnesspharma.in'
    },
    delivery: {
      time: '4–6 business days',
      coverage: 'South & West India',
      shipping: 'Free shipping on orders above ₹4,000'
    }
  },
  // Injections
  {
    name: 'Ceftri 1g Injection',
    brand: 'Mankind',
    categoryName: 'Injections',
    strength: '1 g',
    packSize: '1 Vial + Diluent',
    dosageForm: 'Injectable (IV/IM)',
    composition: ['Ceftriaxone Sodium IP eq. to Ceftriaxone 1 g', 'Sterile water for injection q.s.'],
    description: 'Third-generation cephalosporin antibiotic',
    uses: 'Third-generation cephalosporin antibiotic for serious bacterial infections including septicaemia.',
    benefits: ['Hospital Grade', 'WHO-GMP Certified', 'Sterile Manufacturing', 'Trusted Product'],
    sideEffects: ['Injection site pain', 'Nausea', 'Headache', 'Dizziness'],
    storage: ['Store below 25°C', 'Protect from light', 'Keep out of reach of children'],
    mrp: 65.0,
    retailerPrice: 47.0,
    distributorPrice: 40.5,
    gst: 12,
    stock: 980,
    minimumOrderQuantity: 100,
    isFeatured: false,
    isBestseller: true,
    isNewArrival: false,
    rating: 4.7,
    reviewCount: 256,
    manufacturingDate: '2025-02',
    expiryDate: '2027-08',
    distributor: {
      name: 'Apex Critical Care',
      location: 'Delhi NCR',
      phone: '+91 98110 33445',
      email: 'procure@apexcare.in'
    },
    delivery: {
      time: '2–3 business days',
      coverage: 'Pan India',
      shipping: 'Cold-chain assured · Free above ₹10,000'
    }
  },
  {
    name: 'Vitcobal B12 Injection',
    brand: 'Zydus',
    categoryName: 'Injections',
    strength: '1000 mcg/ml',
    packSize: '5 x 1 ml Ampoules',
    dosageForm: 'Injectable (IM)',
    composition: ['Methylcobalamin 1000 mcg/ml', 'Sterile vehicle q.s.'],
    description: 'Vitamin B12 supplement for nerve health',
    uses: 'Vitamin B12 supplement for nerve health, anaemia and peripheral neuropathy.',
    benefits: ['Nerve Support', 'WHO-GMP Certified', 'Sterile Manufacturing', 'Trusted Product'],
    sideEffects: ['Injection site pain', 'Nausea', 'Headache', 'Itching'],
    storage: ['Store below 25°C', 'Protect from light', 'Keep out of reach of children'],
    mrp: 120.0,
    retailerPrice: 89.0,
    distributorPrice: 77.0,
    gst: 12,
    stock: 260,
    minimumOrderQuantity: 50,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    rating: 4.6,
    reviewCount: 131,
    manufacturingDate: '2025-02',
    expiryDate: '2027-09',
    distributor: {
      name: 'Apex Critical Care',
      location: 'Delhi NCR',
      phone: '+91 98110 33445',
      email: 'procure@apexcare.in'
    },
    delivery: {
      time: '2–3 business days',
      coverage: 'Pan India',
      shipping: 'Free above ₹10,000'
    }
  },
  // Ointments
  {
    name: 'Mupiro Skin Ointment',
    brand: 'Glenmark',
    categoryName: 'Ointments',
    strength: '2% w/w',
    packSize: '1 x 10 g Tube',
    dosageForm: 'Topical Ointment',
    composition: ['Mupirocin IP 2% w/w', 'Polyethylene glycol base q.s.'],
    description: 'Topical antibiotic for skin infections',
    uses: 'Topical antibiotic for skin infections such as impetigo and infected wounds.',
    benefits: ['Fast Acting', 'WHO-GMP Certified', 'Dermatologist Tested', 'Trusted Product'],
    sideEffects: ['Burning sensation', 'Itching', 'Redness', 'Dryness'],
    storage: ['Store below 25°C', 'Keep cap tightly closed', 'Keep out of reach of children'],
    mrp: 88.0,
    retailerPrice: 64.0,
    distributorPrice: 55.0,
    gst: 12,
    stock: 320,
    minimumOrderQuantity: 40,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: false,
    rating: 4.3,
    reviewCount: 142,
    manufacturingDate: '2025-04',
    expiryDate: '2028-03',
    distributor: {
      name: 'DermaTrade Distributors',
      location: 'Pune, Maharashtra',
      phone: '+91 98220 66778',
      email: 'hello@dermatrade.in'
    },
    delivery: {
      time: '3–5 business days',
      coverage: 'Pan India',
      shipping: 'Standard shipping ₹90'
    }
  },
  {
    name: 'Clobeta GM Ointment',
    brand: 'Torrent',
    categoryName: 'Ointments',
    strength: '15 g',
    packSize: '1 x 15 g Tube',
    dosageForm: 'Topical Ointment',
    composition: ['Clobetasol Propionate 0.05%', 'Gentamicin 0.1%', 'Miconazole Nitrate 2%'],
    description: 'Combination ointment for skin conditions with bacterial and fungal infection',
    uses: 'Combination ointment for inflammatory skin conditions with bacterial and fungal infection.',
    benefits: ['Triple Action', 'WHO-GMP Certified', 'Dermatologist Tested', 'Trusted Product'],
    sideEffects: ['Burning', 'Itching', 'Skin thinning', 'Redness'],
    storage: ['Store below 25°C', 'Keep cap tightly closed', 'Keep out of reach of children'],
    mrp: 76.0,
    retailerPrice: 55.0,
    distributorPrice: 48.0,
    gst: 12,
    stock: 410,
    minimumOrderQuantity: 40,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: false,
    rating: 4.2,
    reviewCount: 98,
    manufacturingDate: '2025-03',
    expiryDate: '2028-02',
    distributor: {
      name: 'DermaTrade Distributors',
      location: 'Pune, Maharashtra',
      phone: '+91 98220 66778',
      email: 'hello@dermatrade.in'
    },
    delivery: {
      time: '3–5 business days',
      coverage: 'Pan India',
      shipping: 'Standard shipping ₹90'
    }
  }
];

const seedDatabase = async () => {
  try {
    console.log('🔄 Starting database seeding...\n');

    // Connect to database
    await connectDB();

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Admin.deleteMany({});

    // Create categories
    console.log('📁 Creating categories...');
    const createdCategories = await Category.insertMany(sampleCategories);
    console.log(`✓ Created ${createdCategories.length} categories\n`);

    // Create products with category references
    console.log('📦 Creating products...');
    const productsToInsert = sampleProducts.map(product => {
      const category = createdCategories.find(cat => cat.categoryName === product.categoryName);
      return {
        ...product,
        category: category._id
      };
    });

    const createdProducts = await Product.insertMany(productsToInsert);
    console.log(`✓ Created ${createdProducts.length} products\n`);

    // Create sample admin
    console.log('👤 Creating sample admin user...');
    const admin = await Admin.create({
      name: 'Admin User',
      email: 'admin@medibridge.com',
      password: 'admin123456',
      role: 'superadmin'
    });
    console.log(`✓ Admin created with email: admin@medibridge.com\n`);

    // Update category product counts
    console.log('🔢 Updating category product counts...');
    for (let category of createdCategories) {
      const count = await Product.countDocuments({ category: category._id, status: 'active' });
      category.productCount = count;
      await category.save();
    }
    console.log('✓ Product counts updated\n');

    console.log(`
╔════════════════════════════════════════════════════════════╗
║             Database Seeding Completed Successfully         ║
╠════════════════════════════════════════════════════════════╣
║  Categories Created: ${createdCategories.length}                                 ║
║  Products Created: ${createdProducts.length}                                   ║
║  Admin User: admin@medibridge.com / admin123456   ║
╚════════════════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  }
};

// Run seed
seedDatabase();