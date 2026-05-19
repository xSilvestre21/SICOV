const express = require('express');
const { registerAdmin, login, refreshAccessToken } = require('../controllers/authController');

const router = express.Router();

router.post('/register-admin', registerAdmin);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);

module.exports = router;
