const express = require('express');
const { registerAdmin, login } = require('../controllers/authController');

const router = express.Router();

router.post('/register-admin', registerAdmin);
router.post('/login', login);

module.exports = router;
