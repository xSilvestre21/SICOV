const express = require('express');
const { registerAdmin, login, refreshAccessToken, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register-admin', registerAdmin);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);

module.exports = router;
