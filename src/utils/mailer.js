const nodemailer = require('nodemailer');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

/**
 * Cria o transporter de email.
 * Configuração via .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envia email de redefinição de senha.
 * @param {string} to - Email do destinatário
 * @param {string} resetLink - Link completo para redefinir a senha
 * @param {string} userName - Nome do usuário
 */
async function sendPasswordResetEmail(to, resetLink, userName) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SICOV" <${process.env.SMTP_USER}>`,
    to,
    subject: 'SICOV — Redefinição de Senha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #58706d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SICOV</h1>
        </div>
        <div style="background: #f5f5ee; padding: 30px; border-radius: 0 0 12px 12px;">
          <p style="color: #4b5757; font-size: 16px;">Olá, <strong>${userName}</strong>!</p>
          <p style="color: #4b5757; font-size: 14px;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #58706d; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Redefinir Senha</a>
          </div>
          <p style="color: #7c8a6e; font-size: 12px;">Este link expira em 1 hora.</p>
          <p style="color: #7c8a6e; font-size: 12px;">Se você não solicitou a redefinição, ignore este email.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
