const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductActive,
  deleteProduct,
} = require('../controllers/productController');

const router = express.Router();

router.get('/', authMiddleware, getProducts);
router.get('/:id', authMiddleware, getProductById);

router.post('/', authMiddleware, createProduct);
router.put('/:id', authMiddleware, updateProduct);
router.patch('/:id/toggle-active', authMiddleware, toggleProductActive);
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;
