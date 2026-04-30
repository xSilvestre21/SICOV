const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function registerAdmin(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Nome, email e senha são obrigatórios' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(409)
        .json({ message: 'Já existe um usuário com esse email' });
    }

    const hashedPassword = await argon2.hash(password);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      profile: 'admin',
      active: true,
    });

    return res.status(201).json({
      message: 'Administrador cadastrado com sucesso.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        profile: newUser.profile,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao cadastrar o administrador.',
      error: err.message,
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email e senha são obrigatórios!' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    if (!user.active) {
      return res.status(403).json({
        message: 'Usuário inativo. Acesso bloqueado.',
      });
    }

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        profile: user.profile,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
    );

    return res.status(200).json({
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        active: user.active,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: ' Erro ao reaçizar o login.',
      error: err.message,
    });
  }
}

module.exports = {
  registerAdmin,
  login,
};
