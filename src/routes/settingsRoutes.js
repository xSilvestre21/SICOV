const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const { getSettings, updateSettings, updateThemePreference } = require('../controllers/settingsController');

const router = express.Router();

// Qualquer usuário autenticado pode ler (para pré-preencher o formulário)
router.get('/', authMiddleware, getSettings);

// Apenas admin pode alterar o padrão
router.put('/', authMiddleware, isAdmin, updateSettings);

// Qualquer usuário pode alterar sua preferência de tema
router.patch('/theme', authMiddleware, updateThemePreference);

module.exports = router;
