const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Guard against "Cannot overwrite model" errors on hot-reload / multiple requires
const { cartSchema, orderSchema, productSchema } = require('../src/model');
const Cart    = mongoose.models.Cart    || mongoose.model('Cart',    cartSchema);
const Order   = mongoose.models.Order   || mongoose.model('Order',   orderSchema);
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const User    = require('../models/User');

// ============ MIDDLEWARE ============

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============ CART ROUTES ============

// @GET /api/cart
// Get user cart
router.get('/', verifyToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.userId })
      .populate('items.productId');

    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [], totalAmount: 0 });
      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: cart
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cart'
    });
  }
});

// @POST /api/cart/add
// Add item to cart
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID or quantity'
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available`
      });
    }

    let cart = await Cart.findOne({ userId: req.userId });
    
    if (!cart) {
      cart = new Cart({ userId: req.userId, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        priceAtTime: product.netPrice
      });
    }

    // Update total
    cart.totalAmount = cart.items.reduce((sum, item) => {
      return sum + (item.priceAtTime * item.quantity);
    }, 0);

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart'
    });
  }
});

// @PUT /api/cart/update/:itemId
// Update cart item quantity
router.put('/update/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity'
      });
    }

    const cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.find(i => i._id.toString() === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    if (quantity === 0) {
      cart.items = cart.items.filter(i => i._id.toString() !== itemId);
    } else {
      item.quantity = quantity;
    }

    // Recalculate total
    cart.totalAmount = cart.items.reduce((sum, item) => {
      return sum + (item.priceAtTime * item.quantity);
    }, 0);

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: cart
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating cart'
    });
  }
});

// @DELETE /api/cart/remove/:itemId
// Remove item from cart
router.delete('/remove/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: req.userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(i => i._id.toString() !== itemId);

    // Recalculate total
    cart.totalAmount = cart.items.reduce((sum, item) => {
      return sum + (item.priceAtTime * item.quantity);
    }, 0);

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart'
    });
  }
});

// @DELETE /api/cart/clear
// Clear entire cart
router.delete('/clear', verifyToken, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.userId },
      { items: [], totalAmount: 0 }
    );

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error clearing cart'
    });
  }
});

// ============ ORDER ROUTES ============

// @POST /api/orders/create
// Create order from cart
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, notes } = req.body;

    const cart = await Cart.findOne({ userId: req.userId })
      .populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Get user info
    const user = await User.findById(req.userId);

    // Build order items
    const orderItems = cart.items.map(item => ({
      productId: item.productId._id,
      productName: item.productId.name,
      quantity: item.quantity,
      pricePerUnit: item.priceAtTime,
      total: item.priceAtTime * item.quantity,
      gst: (item.priceAtTime * item.quantity * item.productId.gst) / 100
    }));

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const gstAmount = orderItems.reduce((sum, item) => sum + item.gst, 0);
    const totalAmount = subtotal + gstAmount;

    // Create order
    const orderId = `ORD-${Date.now()}`;
    const newOrder = new Order({
      orderId,
      userId: req.userId,
      items: orderItems,
      shippingAddress: shippingAddress || user.address,
      subtotal,
      gstAmount,
      totalAmount,
      paymentMethod,
      notes
    });

    await newOrder.save();

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId: req.userId },
      { items: [], totalAmount: 0 }
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: newOrder.orderId,
        totalAmount: newOrder.totalAmount,
        status: newOrder.orderStatus
      }
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order'
    });
  }
});

// @GET /api/orders
// Get user orders
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.productId');

    const total = await Order.countDocuments({ userId: req.userId });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders'
    });
  }
});

// @GET /api/orders/:orderId
// Get order details
router.get('/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId, userId: req.userId })
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order'
    });
  }
});

// @PUT /api/orders/:orderId/cancel
// Cancel order
router.put('/:orderId/cancel', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId, userId: req.userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (['shipped', 'delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled in current status'
      });
    }

    order.orderStatus = 'cancelled';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling order'
    });
  }
});

module.exports = router;