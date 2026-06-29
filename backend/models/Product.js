/* =====================================================================
   models/Product.js — Product Schema
   Comprehensive pharmaceutical product information and pricing
   ===================================================================== */

const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide product name'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
      index: true
    },
    slug: {
      type: String,
      lowercase: true,
      index: true
    },
    brand: {
      type: String,
      required: [true, 'Please provide brand name'],
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category']
    },
    categoryName: String,
    strength: {
      type: String,
      required: true
    },
    packSize: {
      type: String,
      required: true
    },
    dosageForm: {
      type: String,
      required: true
    },
    composition: [{ type: String }],
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    uses: {
      type: String,
      maxlength: [500, 'Uses description cannot exceed 500 characters']
    },
    benefits: [{ type: String }],
    sideEffects: [{ type: String }],
    storage: [{ type: String }],
    mrp: {
      type: Number,
      required: [true, 'Please provide MRP'],
      min: [0, 'MRP cannot be negative']
    },
    retailerPrice: {
      type: Number,
      required: [true, 'Please provide retailer price'],
      min: [0, 'Retailer price cannot be negative']
    },
    distributorPrice: {
      type: Number,
      required: [true, 'Please provide distributor price'],
      min: [0, 'Distributor price cannot be negative']
    },
    gst: {
      type: Number,
      default: 12,
      enum: [5, 12, 18]
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    minimumOrderQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock'
    },
    image: {
      url:       { type: String, default: null },
      public_id: { type: String, default: null }
    },
    images: [
      {
        url:       { type: String },
        public_id: { type: String }
      }
    ],
    manufacturingDate: { type: String, required: false },
    expiryDate: { type: String, required: false },
    distributor: {
      name: String,
      location: String,
      phone: String,
      email: String
    },
    delivery: {
      time: String,
      coverage: String,
      shipping: String
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    isBestseller: {
      type: Boolean,
      default: false
    },
    isNewArrival: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      index: true
    },
    tags: [{ type: String }],
    certifications: [{ type: String }]
  },
  {
    timestamps: true
  }
);

productSchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true });
  }
  if (this.stock === 0) {
    this.stockStatus = 'Out of Stock';
  } else if (this.stock <= 50) {
    this.stockStatus = 'Low Stock';
  } else {
    this.stockStatus = 'In Stock';
  }
});

productSchema.pre(/^find/, function () {
  if (this.options._recursed) return;
  this.populate({ path: 'category', select: 'categoryName categorySlug' });
});

// Keep stockStatus in sync when stock is updated via findByIdAndUpdate /
// findOneAndUpdate. The pre('save') hook above only runs on .save(); query
// updates bypass it, which left stockStatus stale (e.g. stayed "Out of Stock"
// after Super Admin restocked from 0).
productSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate() || {};
  const setBlock = update.$set || update;
  const incBlock = update.$inc || {};

  let nextStock;
  if (typeof setBlock.stock === 'number') {
    nextStock = setBlock.stock;
  } else if (typeof incBlock.stock === 'number') {
    const current = await this.model
      .findOne(this.getQuery(), null, { _recursed: true })
      .select('stock')
      .lean();
    if (current) nextStock = (current.stock || 0) + incBlock.stock;
  }
  if (nextStock === undefined) return;

  const nextStatus =
    nextStock <= 0 ? 'Out of Stock' :
    nextStock <= 50 ? 'Low Stock' :
    'In Stock';

  update.$set = Object.assign({}, update.$set, { stockStatus: nextStatus });
  this.setUpdate(update);
});

productSchema.statics.getFeaturedProducts = function (limit = 8) {
  return this.find({ isFeatured: true, status: 'active' }).limit(limit);
};

productSchema.statics.getBestsellers = function (limit = 8) {
  return this.find({ isBestseller: true, status: 'active' }).limit(limit);
};

productSchema.statics.getNewArrivals = function (limit = 8) {
  return this.find({ isNewArrival: true, status: 'active' }).sort({ createdAt: -1 }).limit(limit);
};

module.exports = mongoose.model('Product', productSchema);
