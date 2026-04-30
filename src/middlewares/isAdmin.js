function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  if (req.user.profile !== 'admin') {
    return res
      .status(403)
      .json({ message: 'Acesso negado. Apenas administradores.' });
  }

  next();
}

module.exports = isAdmin;
