const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();

// Qualquer usuário autenticado pode ler (para pré-preencher o formulário)
router.get('/', authMiddleware, getSettings);

// Apenas admin pode alterar o padrão
router.put('/', authMiddleware, isAdmin, updateSettings);

module.exports = router;
