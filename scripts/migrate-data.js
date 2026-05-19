/**
 * Script de migração de dados — roda uma vez para:
 * 1. Preencher representativeName em comissões antigas que não têm
 * 2. Definir themePreference: 'light' em usuários que não têm o campo
 *
 * Uso: node scripts/migrate-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Commission = require('../src/models/commission');
const User = require('../src/models/user');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI não definida no .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado ao MongoDB');

  // 1. Preencher representativeName em comissões
  console.log('\n--- Migrando representativeName nas comissões ---');
  const commissionsWithoutName = await Commission.find({
    representativeName: { $in: [null, '', undefined] },
    representativeId: { $ne: null },
  }).select('_id representativeId');

  console.log(`Comissões sem representativeName: ${commissionsWithoutName.length}`);

  if (commissionsWithoutName.length > 0) {
    const repIds = [...new Set(commissionsWithoutName.map((c) => c.representativeId.toString()))];
    const users = await User.find({ _id: { $in: repIds } }).select('_id name').lean();
    const nameMap = new Map(users.map((u) => [u._id.toString(), u.name]));

    let updated = 0;
    for (const comm of commissionsWithoutName) {
      const name = nameMap.get(comm.representativeId.toString());
      if (name) {
        await Commission.updateOne({ _id: comm._id }, { representativeName: name });
        updated++;
      }
    }
    console.log(`Comissões atualizadas: ${updated}`);
  }

  // 2. Definir themePreference em usuários
  console.log('\n--- Migrando themePreference nos usuários ---');
  const result = await User.updateMany(
    { themePreference: { $exists: false } },
    { $set: { themePreference: 'light' } },
  );
  console.log(`Usuários atualizados: ${result.modifiedCount}`);

  console.log('\n✓ Migração concluída!');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
