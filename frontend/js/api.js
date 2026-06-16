/* =====================================================================
   frontend/api.js — API Client Library
   Handles all HTTP requests to the backend API
   Place this file in your frontend directory alongside HTML files
   ===================================================================== */

// API Configuration
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('ff_token');

// API Error Handler
class APIError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// Generic fetch wrapper
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add auth token if available
  if (authToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new APIError(response.status, data.message, data.errors);
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(500, 'Network error: ' + error.message);
  }
}

// ===== AUTHENTICATION API =====

const authAPI = {
  // Register new admin
  register: async (name, email, password, confirmPassword) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword }),
      skipAuth: true
    });
  },

  // Login
  login: async (email, password) => {
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true
    });
    
    if (response.token) {
      authToken = response.token;
      localStorage.setItem('ff_token', response.token);
    }
    
    return response;
  },

  // Get current admin
  getMe: async () => {
    return apiCall('/auth/me', { method: 'GET' });
  },

  // Logout
  logout: async () => {
    const response = await apiCall('/auth/logout', { method: 'POST' });
    authToken = null;
    localStorage.removeItem('ff_token');
    return response;
  },

  // Update password
  updatePassword: async (currentPassword, newPassword, confirmPassword) => {
    return apiCall('/auth/update-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  }
};

// ===== CATEGORY API =====

const categoryAPI = {
  // Get all categories
  getAllCategories: async (isActive = null) => {
    let query = '';
    if (isActive !== null) {
      query = `?isActive=${isActive}`;
    }
    return apiCall(`/categories${query}`, { method: 'GET' });
  },

  // Get single category
  getCategory: async (id) => {
    return apiCall(`/categories/${id}`, { method: 'GET' });
  },

  // Get category by slug
  getCategoryBySlug: async (slug) => {
    return apiCall(`/categories/slug/${slug}`, { method: 'GET' });
  },

  // Create category
  createCategory: async (categoryName, categoryDescription, displayOrder) => {
    return apiCall('/categories', {
      method: 'POST',
      body: JSON.stringify({ categoryName, categoryDescription, displayOrder })
    });
  },

  // Update category
  updateCategory: async (id, data) => {
    return apiCall(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Delete category
  deleteCategory: async (id) => {
    return apiCall(`/categories/${id}`, { method: 'DELETE' });
  }
};

// ===== PRODUCT API =====

const productAPI = {
  // Get all products with filters
  getAllProducts: async (filters = {}) => {
    const query = new URLSearchParams();
    
    if (filters.page) query.append('page', filters.page);
    if (filters.limit) query.append('limit', filters.limit);
    if (filters.keyword) query.append('keyword', filters.keyword);
    if (filters.category) query.append('category', filters.category);
    if (filters.brand) query.append('brand', filters.brand);
    if (filters.minPrice) query.append('minPrice', filters.minPrice);
    if (filters.maxPrice) query.append('maxPrice', filters.maxPrice);
    if (filters.stockStatus) query.append('stockStatus', filters.stockStatus);
    if (filters.minRating) query.append('minRating', filters.minRating);
    if (filters.sort) query.append('sort', filters.sort);

    const queryString = query.toString();
    const endpoint = `/products${queryString ? '?' + queryString : ''}`;
    
    return apiCall(endpoint, { method: 'GET' });
  },

  // Get featured products
  getFeaturedProducts: async (limit = 8) => {
    return apiCall(`/products/featured?limit=${limit}`, { method: 'GET' });
  },

  // Get bestseller products
  getBestsellers: async (limit = 8) => {
    return apiCall(`/products/bestsellers?limit=${limit}`, { method: 'GET' });
  },

  // Get new arrivals
  getNewArrivals: async (limit = 8) => {
    return apiCall(`/products/new-arrivals?limit=${limit}`, { method: 'GET' });
  },

  // Get single product
  getProduct: async (id) => {
    return apiCall(`/products/${id}`, { method: 'GET' });
  },

  // Get product by slug
  getProductBySlug: async (slug) => {
    return apiCall(`/products/slug/${slug}`, { method: 'GET' });
  },

  // Get products by category
  getProductsByCategory: async (categoryId, page = 1, limit = 10) => {
    return apiCall(`/products/category/${categoryId}?page=${page}&limit=${limit}`, { 
      method: 'GET' 
    });
  },

  // Get products by brand
  getProductsByBrand: async (brand, page = 1, limit = 10) => {
    return apiCall(`/products/brand/${brand}?page=${page}&limit=${limit}`, { 
      method: 'GET' 
    });
  },

  // Auto-suggest search
  autoSuggest: async (keyword) => {
    return apiCall(`/products/search/auto-suggest?keyword=${encodeURIComponent(keyword)}`, { 
      method: 'GET' 
    });
  },

  // Create product (requires file upload)
  createProduct: async (formData) => {
    return fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData // FormData object, don't set Content-Type
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.message, data.errors);
      }
      return data;
    });
  },

  // Update product
  updateProduct: async (id, formData) => {
    return fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData // FormData object if has file, otherwise JSON
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.message, data.errors);
      }
      return data;
    });
  },

  // Delete product
  deleteProduct: async (id) => {
    return apiCall(`/products/${id}`, { method: 'DELETE' });
  },

  // Get dashboard stats
  getDashboardStats: async () => {
    return apiCall('/products/stats/dashboard', { method: 'GET' });
  }
};

// ===== NEWSLETTER API =====

const newsletterAPI = {
  // Subscribe to newsletter
  subscribe: async (email, name = null, userType = 'general') => {
    return apiCall('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email, name, userType }),
      skipAuth: true
    });
  },

  // Unsubscribe from newsletter
  unsubscribe: async (email, token = null) => {
    return apiCall('/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ email, token }),
      skipAuth: true
    });
  },

  // Check subscription status
  getStatus: async (email) => {
    return apiCall(`/newsletter/status/${encodeURIComponent(email)}`, {
      method: 'GET',
      skipAuth: true
    });
  },

  // Send campaign (Admin only)
  sendCampaign: async (subject, html, userTypes = []) => {
    return apiCall('/newsletter/send-campaign', {
      method: 'POST',
      body: JSON.stringify({ subject, html, userTypes })
    });
  },

  // Get stats (Admin only)
  getStats: async () => {
    return apiCall('/newsletter/stats', { method: 'GET' });
  }
};

// Export all APIs
const API = {
  authAPI,
  categoryAPI,
  productAPI,
  newsletterAPI
};

// Make available globally
if (typeof window !== 'undefined') {
  window.API = API;
}

// For Node.js/module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}