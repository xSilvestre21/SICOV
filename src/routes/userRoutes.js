const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const {
  createRepresentative,
  getRepresentatives,
  getRepresentativeById,
  updateRepresentative,
  deleteRepresentative,
  toggleRepresentativeActive,
} = require('../controllers/userController');

const router = express.Router();

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    message: 'Usuário autenticado',
    user: req.user,
  });
});

router.get('/representatives', authMiddleware, isAdmin, getRepresentatives);

router.get(
  '/representatives/:id',
  authMiddleware,
  isAdmin,
  getRepresentativeById,
);

router.post(
  '/create-representative',
  authMiddleware,
  isAdmin,
  createRepresentative,
);

router.put(
  '/representatives/:id',
  authMiddleware,
  isAdmin,
  updateRepresentative,
);

router.delete(
  '/representatives/:id',
  authMiddleware,
  isAdmin,
  deleteRepresentative,
);

router.patch(
  '/representatives/:id/toggle-active',
  authMiddleware,
  isAdmin,
  toggleRepresentativeActive,
);

module.exports = router;
