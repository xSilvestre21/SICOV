const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  createCommission,
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  createInstallments,
} = require('../controllers/commissionController');

const router = express.Router();

// Listagem — Admin vê todos; Representante vê apenas os seus
router.get('/', authMiddleware, getCommissions);

// Busca por ID — Representante só acessa os próprios
router.get('/:id', authMiddleware, getCommissionById);

// Criação — apenas Admin
router.post('/', authMiddleware, isAdmin, createCommission);

// Atualização — apenas Admin
router.put('/:id', authMiddleware, isAdmin, updateCommission);

// Remoção — apenas Admin
router.delete('/:id', authMiddleware, isAdmin, deleteCommission);

// Projeção de parcelas — apenas Admin
router.post('/:id/installments', authMiddleware, isAdmin, createInstallments);

module.exports = router;
