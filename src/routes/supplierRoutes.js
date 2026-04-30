const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  toggleSupplierActive,
  deleteSupplier,
} = require('../controllers/supplierController');

const router = express.Router();

router.get('/', authMiddleware, getSuppliers);
router.get('/:id', authMiddleware, getSupplierById);
router.post('/', authMiddleware, isAdmin, createSupplier);
router.put('/:id', authMiddleware, isAdmin, updateSupplier);
router.delete('/:id', authMiddleware, isAdmin, deleteSupplier);
router.patch(
  '/:id/toggle-active',
  authMiddleware,
  isAdmin,
  toggleSupplierActive,
);

module.exports = router;
