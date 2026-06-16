/* =====================================================================
   models/Category.js — Product Category Schema
   Manages pharmaceutical product categories
   ===================================================================== */

const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, 'Please provide category name'],
      unique: true,
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    categorySlug: {
      type: String,
      lowercase: true,
      index: true
    },
    categoryDescription: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    categoryImage: {
      url:       { type: String, default: null },
      public_id: { type: String, default: null }
    },
    productCount: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Create slug from category name before saving
categorySchema.pre('save', function (next) {
  if (this.isModified('categoryName')) {
    this.categorySlug = slugify(this.categoryName, { lower: true });
  }
  next();
});

// Static method to get active categories
categorySchema.statics.getActiveCategories = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

module.exports = mongoose.model('Category', categorySchema);