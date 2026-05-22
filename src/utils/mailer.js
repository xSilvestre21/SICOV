const nodemailer = require('nodemailer');

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

  const textContent = [
    `Olá, ${userName}!`,
    '',
    'Recebemos uma solicitação para redefinir sua senha no SICOV.',
    '',
    'Acesse o link abaixo para criar uma nova senha:',
    resetLink,
    '',
    'Este link expira em 1 hora.',
    'Se você não solicitou a redefinição, ignore este email.',
    '',
    '— Equipe SICOV',
  ].join('\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SICOV" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Redefinição de Senha - SICOV',
    text: textContent,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #58706d; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SICOV</h1>
          <p style="color: #d4e4d1; margin: 5px 0 0; font-size: 12px;">Gerenciador de Vendas</p>
        </div>
        <div style="background: #f9f9f4; padding: 30px; border: 1px solid #e3e3d1; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #4b5757; font-size: 16px; margin-top: 0;">Olá, <strong>${userName}</strong>!</p>
          <p style="color: #4b5757; font-size: 14px; line-height: 1.5;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #58706d; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Redefinir Senha</a>
          </div>
          <p style="color: #7c8a6e; font-size: 12px; margin-bottom: 4px;">Este link expira em 1 hora.</p>
          <p style="color: #7c8a6e; font-size: 12px;">Se você não solicitou a redefinição, ignore este email.</p>
          <hr style="border: none; border-top: 1px solid #e3e3d1; margin: 20px 0;" />
          <p style="color: #999; font-size: 11px; text-align: center; margin: 0;">SICOV — Sistema de Controle de Vendas</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
