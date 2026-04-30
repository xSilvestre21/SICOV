const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  toggleClientActive,
} = require('../controllers/clientController');

const router = express.Router();

router.post('/', authMiddleware, isAdmin, createClient);

router.get('/', authMiddleware, getClients);

router.get('/:id', authMiddleware, getClientById);

router.put('/:id', authMiddleware, updateClient);

router.delete('/:id', authMiddleware, deleteClient);

router.patch('/:id/toggle-active', authMiddleware, toggleClientActive);

module.exports = router;
