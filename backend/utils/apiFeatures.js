/* =====================================================================
   utils/apiFeatures.js — Advanced Query Features
   Handles search, filtering, sorting, and pagination for products
   ===================================================================== */

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // Search by name, brand, or composition
  search() {
    const keyword = this.queryString.keyword;
    if (keyword) {
      this.query = this.query.find({
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { brand: { $regex: keyword, $options: 'i' } },
          { composition: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ]
      });
    }
    return this;
  }

  // Filter by category, brand, price, stock status, rating
  filter() {
    const queryCopy = { ...this.queryString };
    
    // Remove fields that are not for filtering
    const removeFields = ['keyword', 'page', 'limit', 'sort'];
    removeFields.forEach(field => delete queryCopy[field]);

    // Convert query object to filter object
    let filterString = JSON.stringify(queryCopy);
    filterString = filterString.replace(/\b(gt|gte|lt|lte)\b/g, match => `$${match}`);
    
    this.query = this.query.find(JSON.parse(filterString));
    return this;
  }

  // Filter by category
  filterByCategory() {
    if (this.queryString.category) {
      this.query = this.query.find({ categoryName: this.queryString.category });
    }
    return this;
  }

  // Filter by brand
  filterByBrand() {
    if (this.queryString.brand) {
      const brands = this.queryString.brand.split(',');
      this.query = this.query.find({ brand: { $in: brands } });
    }
    return this;
  }

  // Filter by price range
  filterByPrice() {
    if (this.queryString.minPrice || this.queryString.maxPrice) {
      const priceFilter = {};
      if (this.queryString.minPrice) {
        priceFilter.$gte = Number(this.queryString.minPrice);
      }
      if (this.queryString.maxPrice) {
        priceFilter.$lte = Number(this.queryString.maxPrice);
      }
      this.query = this.query.find({ retailerPrice: priceFilter });
    }
    return this;
  }

  // Filter by stock status
  filterByStockStatus() {
    if (this.queryString.stockStatus) {
      const statuses = this.queryString.stockStatus.split(',');
      this.query = this.query.find({ stockStatus: { $in: statuses } });
    }
    return this;
  }

  // Filter by rating
  filterByRating() {
    if (this.queryString.minRating) {
      this.query = this.query.find({ rating: { $gte: Number(this.queryString.minRating) } });
    }
    return this;
  }

  // Sort
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  // Pagination
  pagination() {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.page = page;
    this.limit = limit;
    this.skip = skip;

    return this;
  }

  // Get pagination metadata
  getPaginationMeta(totalCount) {
    const totalPages = Math.ceil(totalCount / this.limit);
    const hasNextPage = this.page < totalPages;
    const hasPrevPage = this.page > 1;

    return {
      currentPage: this.page,
      totalPages,
      totalCount,
      limit: this.limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? this.page + 1 : null,
      prevPage: hasPrevPage ? this.page - 1 : null
    };
  }
}

module.exports = APIFeatures;