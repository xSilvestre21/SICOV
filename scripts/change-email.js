/**
 * Troca o email de um usuário.
 * Uso: node scripts/change-email.js email-atual@gmail.com novo-email@gmail.com
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const oldEmail = process.argv[2];
const newEmail = process.argv[3];

if (!oldEmail || !newEmail) {
  console.log('Uso: node scripts/change-email.js email-atual novo-email');
  console.log('Exemplo: node scripts/change-email.js valquiria@gmail.com valquiria@sicov.com');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: oldEmail.toLowerCase() },
    { $set: { email: newEmail.toLowerCase() } }
  );

  if (result.modifiedCount === 1) {
    console.log(`✓ Email alterado: ${oldEmail} → ${newEmail}`);
  } else {
    console.log(`✗ Email "${oldEmail}" não encontrado no sistema.`);
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
