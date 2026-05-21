/**
 * Cria um novo usuário admin.
 * Uso: node scripts/create-admin.js email senha nome
 * Exemplo: node scripts/create-admin.js gustavo@sicov.com MinhaSenh4 "Gustavo Silva"
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const argon2 = require('argon2');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4];

if (!email || !password || !name) {
  console.log('Uso: node scripts/create-admin.js email senha nome');
  console.log('Exemplo: node scripts/create-admin.js gustavo@sicov.com MinhaSenh4 "Gustavo Silva"');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // Verifica se já existe
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`✗ Já existe um usuário com o email "${email}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Cria o admin
  const hashedPassword = await argon2.hash(password);
  await db.collection('users').insertOne({
    _id: new mongoose.Types.ObjectId(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    profile: 'admin',
    active: true,
    defaultCommissionPercentage: 0,
    themePreference: 'light',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`✓ Admin criado: ${name} (${email})`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
