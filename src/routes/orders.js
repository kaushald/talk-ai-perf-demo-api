const express = require('express');
const router = express.Router();
const { Order, OrderItem, User, Product } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Memory leak demonstration - accumulating order data
function addToOrderHistory(order) {
  if (process.env.ENABLE_MEMORY_LEAK === 'true') {
    // Memory leak: Never cleaning up this array
    global.orderHistory.push({
      ...order.toJSON(),
      processedAt: new Date(),
      // Adding large objects to make leak more obvious
      metadata: {
        timestamp: Date.now(),
        random: Array(1000).fill(0).map(() => Math.random()),
        buffer: Buffer.alloc(10000).toString('base64')
      }
    });
  }
}

// POST /api/orders - Create order with memory leak
router.post('/', async (req, res, next) => {
  try {
    const { userId, items, shippingAddress, paymentMethod, notes } = req.body;

    // Validate user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }

      const subtotal = parseFloat(product.price) * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        subtotal
      });
    }

    // Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    const order = await Order.create({
      orderNumber,
      userId,
      status: 'pending',
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes
    });

    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item
      });
    }

    // Memory leak: Add to global history
    addToOrderHistory(order);

    // Fetch complete order with items
    const completeOrder = await Order.findByPk(order.id, {
      include: [
        { model: User, attributes: ['id', 'username', 'email'] },
        { 
          model: OrderItem,
          include: [{ model: Product, attributes: ['id', 'name', 'price'] }]
        }
      ]
    });

    res.status(201).json(completeOrder);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders - List all orders
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const orders = await Order.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: User, attributes: ['id', 'username', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      orders: orders.rows,
      total: orders.count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(orders.count / limit)
      },
      memoryLeakInfo: {
        orderHistorySize: global.orderHistory.length,
        estimatedMemoryMB: (global.orderHistory.length * 0.01).toFixed(2) // Rough estimate
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Get order details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'username', 'email', 'firstName', 'lastName'] },
        { 
          model: OrderItem,
          include: [{ model: Product }]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Add to history again (making memory leak worse)
    addToOrderHistory(order);

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/user/:userId - Get user's orders
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const orders = await Order.findAndCountAll({
      where: { userId },
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { 
          model: OrderItem,
          include: [{ model: Product, attributes: ['id', 'name', 'price'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      orders: orders.rows,
      total: orders.count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(orders.count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ status });

    // Add status change to history (more memory leak)
    addToOrderHistory(order);

    res.json({
      message: 'Order status updated',
      order
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Soft delete by updating status
    await order.update({ status: 'cancelled' });

    res.json({
      message: 'Order cancelled',
      order
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;