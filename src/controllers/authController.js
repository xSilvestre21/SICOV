const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { sendPasswordResetEmail } = require('../utils/mailer');

/** Valida formato básico de email. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

// Rota protegida: só pode ser chamada se já não existir nenhum admin,
// ou se a variável ADMIN_REGISTER_SECRET estiver definida e for enviada no header.
async function registerAdmin(req, res) {
  try {
    const secret = process.env.ADMIN_REGISTER_SECRET;

    if (!secret) {
      return res.status(403).json({
        message: 'Registro de administrador desabilitado neste ambiente.',
      });
    }

    const providedSecret = req.headers['x-admin-secret'];

    if (!providedSecret || providedSecret !== secret) {
      return res.status(403).json({
        message: 'Acesso negado.',
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Nome, email e senha são obrigatórios' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res
        .status(400)
        .json({ message: 'A senha deve ter no mínimo 8 caracteres' });
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
    console.error('[registerAdmin]', err.message);
    return res.status(500).json({
      message: 'Erro ao cadastrar o administrador.',
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email e senha são obrigatórios.' });
    }

    const user = await User.findOne({ email });

    // Resposta genérica para não revelar se o email existe
    if (!user) {
      const remaining = res.getHeader('RateLimit-Remaining');
      const msg = remaining !== undefined && Number(remaining) <= 3
        ? `Credenciais inválidas. ${remaining} tentativa${Number(remaining) !== 1 ? 's' : ''} restante${Number(remaining) !== 1 ? 's' : ''} antes do bloqueio.`
        : 'Credenciais inválidas.';
      return res.status(401).json({ message: msg, remaining: Number(remaining) });
    }

    if (!user.active) {
      return res.status(403).json({
        message: 'Usuário inativo. Acesso bloqueado.',
      });
    }

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      const remaining = res.getHeader('RateLimit-Remaining');
      const msg = remaining !== undefined && Number(remaining) <= 3
        ? `Credenciais inválidas. ${remaining} tentativa${Number(remaining) !== 1 ? 's' : ''} restante${Number(remaining) !== 1 ? 's' : ''} antes do bloqueio.`
        : 'Credenciais inválidas.';
      return res.status(401).json({ message: msg, remaining: Number(remaining) });
    }

    // Access token (4h) + Refresh token (7 dias)
    const token = jwt.sign(
      { id: user._id, email: user.email, profile: user.profile },
      process.env.JWT_SECRET,
      { expiresIn: '4h' },
    );

    const refreshToken = jwt.sign(
      { id: user._id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.status(200).json({
      message: 'Login realizado com sucesso.',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        active: user.active,
        themePreference: user.themePreference || 'light',
      },
    });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({
      message: 'Erro ao realizar o login.',
    });
  }
}

/**
 * POST /auth/refresh
 * Renova o access token usando um refresh token válido.
 */
async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken é obrigatório.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    const user = await User.findById(decoded.id).select('_id email profile active name themePreference');
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Usuário não encontrado ou inativo.' });
    }

    const newToken = jwt.sign(
      { id: user._id, email: user.email, profile: user.profile },
      process.env.JWT_SECRET,
      { expiresIn: '4h' },
    );

    return res.json({ token: newToken });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

module.exports = {
  registerAdmin,
  login,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
};

/**
 * POST /auth/forgot-password
 * Envia email com link de redefinição de senha.
 * Body: { email }
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email é obrigatório.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Verifica se o email existe no sistema
    if (!user) {
      return res.status(404).json({ message: 'Email não encontrado no sistema.' });
    }

    // Gera token de reset (expira em 1h)
    const resetToken = jwt.sign(
      { id: user._id, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Monta o link de reset
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Envia email
    try {
      await sendPasswordResetEmail(user.email, resetLink, user.name);
    } catch (mailErr) {
      console.error('[forgotPassword] Erro ao enviar email:', mailErr.message);
      return res.status(500).json({ message: 'Erro ao enviar email. Tente novamente.' });
    }

    return res.json({ message: 'Se o email estiver cadastrado, você receberá um link de redefinição.' });
  } catch (err) {
    console.error('[forgotPassword]', err.message);
    return res.status(500).json({ message: 'Erro ao processar solicitação.' });
  }
}

/**
 * POST /auth/reset-password
 * Redefine a senha usando o token enviado por email.
 * Body: { token, newPassword }
 */
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }

    // Verifica o token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Link expirado. Solicite um novo.' });
      }
      return res.status(401).json({ message: 'Link inválido.' });
    }

    if (decoded.type !== 'password-reset') {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Atualiza a senha
    user.password = await argon2.hash(newPassword);
    await user.save();

    return res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('[resetPassword]', err.message);
    return res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
}

/**
 * POST /auth/change-password
 * Altera a senha do usuário logado (requer autenticação).
 * Body: { currentPassword, newPassword }
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 8 caracteres.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Verifica senha atual
    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) {
      return res.status(401).json({ message: 'Senha atual incorreta.' });
    }

    // Atualiza
    user.password = await argon2.hash(newPassword);
    await user.save();

    return res.json({ message: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('[changePassword]', err.message);
    return res.status(500).json({ message: 'Erro ao alterar senha.' });
  }
}
