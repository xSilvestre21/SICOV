const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  createQuotation,
  updateQuotation,
  convertToOrder,
  deleteQuotation,
  getQuotations,
  getQuotationById,
  getQuotationPdf,
  generateQuotationPdfFromBody,
  getClientProductsForQuotation,
} = require('../controllers/quotationController');

const router = express.Router();

router.post('/', authMiddleware, createQuotation);

router.post('/pdf', authMiddleware, generateQuotationPdfFromBody);

router.get('/', authMiddleware, getQuotations);

// IMPORTANTE: /client-products deve ser registrado ANTES de /:id
router.get('/client-products', authMiddleware, getClientProductsForQuotation);

router.get('/:id', authMiddleware, getQuotationById);

router.put('/:id', authMiddleware, updateQuotation);

router.delete('/:id', authMiddleware, deleteQuotation);

router.post('/:id/convert-to-order', authMiddleware, convertToOrder);

router.get('/:id/pdf', authMiddleware, getQuotationPdf);

module.exports = router;
