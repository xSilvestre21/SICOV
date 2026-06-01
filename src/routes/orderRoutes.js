const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  createOrder,
  markAsSentToSupplier,
  cancelOrder,
  deleteOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getDuplicateOrderTemplate,
  getOrderPdf,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/', authMiddleware, createOrder);

router.patch(
  '/:id/sent-to-supplier',
  authMiddleware,
  isAdmin,
  markAsSentToSupplier,
);

router.patch('/:id/cancel', authMiddleware, isAdmin, cancelOrder);

router.delete('/:id', authMiddleware, isAdmin, deleteOrder);

router.get('/', authMiddleware, getOrders);

router.get('/:id', authMiddleware, getOrderById);

router.put('/:id', authMiddleware, updateOrder);

router.get(
  '/:id/duplicate-template',
  authMiddleware,
  getDuplicateOrderTemplate,
);

router.get('/:id/pdf', authMiddleware, getOrderPdf);

module.exports = router;
