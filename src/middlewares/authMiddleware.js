const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'Token não provido.' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return res.status(401).json({ message: 'Formato de token inválido.' });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({ message: 'Token mal formatado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select(
      '_id name email profile active',
    );

    if (!user) {
      return res.status(401).json({
        message: 'Usuário não encontrado.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        message: 'Usuário inativo. Acesso bloqueado.',
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      profile: user.profile,
      active: user.active,
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      message: 'Token inválido ou expirado.',
      error: err.message,
    });
  }
}

module.exports = authMiddleware;
