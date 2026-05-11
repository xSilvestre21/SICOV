const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  createInstallments,
  getCommissionsSummary,
} = require('../controllers/commissionController');

const router = express.Router();

// Listagem — Admin vê todos; Representante vê apenas os seus
router.get('/', authMiddleware, getCommissions);

// Resumo por período — Admin vê todos; Representante vê apenas os seus (sem campos sensíveis)
// DEVE ficar antes de /:id para evitar conflito de parâmetro
router.get('/summary', authMiddleware, getCommissionsSummary);

// Busca por ID — Representante só acessa os próprios
router.get('/:id', authMiddleware, getCommissionById);

// Atualização — apenas Admin
router.put('/:id', authMiddleware, isAdmin, updateCommission);

// Remoção — apenas Admin
router.delete('/:id', authMiddleware, isAdmin, deleteCommission);

// Projeção de parcelas — apenas Admin
router.post('/:id/installments', authMiddleware, isAdmin, createInstallments);

module.exports = router;
