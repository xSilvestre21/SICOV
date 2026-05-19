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

// Backup sob demanda (apenas admin)
router.post('/backup', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'backup.js');
    const output = execSync(`node "${scriptPath}"`, {
      timeout: 120000,
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..', '..'),
    });
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    res.json({ message: 'Backup realizado com sucesso!', detail: lastLine });
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    if (output.includes('ECONNREFUSED') || output.includes('ENOTFOUND')) {
      return res.status(503).json({ message: 'Erro de conexão com o banco de dados. Verifique sua internet.' });
    }
    res.status(500).json({ message: 'Erro ao executar backup.', detail: (output || err.message).slice(0, 300) });
  }
});

module.exports = router;
