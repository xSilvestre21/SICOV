/**
 * Corrige campos de data que foram salvos como string após restore.
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const dateFields = {
  orders: ['createdAt', 'updatedAt', 'deliveryDate', 'sentToSupplierAt', 'lastEditedAt'],
  commissions: ['createdAt', 'updatedAt', 'deliveryDate', 'dueDate', 'realDeliveryDate'],
  quotations: ['createdAt', 'updatedAt', 'deliveryDate'],
  clients: ['createdAt', 'updatedAt'],
  users: ['createdAt', 'updatedAt'],
  suppliers: ['createdAt', 'updatedAt'],
  products: ['createdAt', 'updatedAt'],
};

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Conectado. Corrigindo datas...\n');

  for (const [colName, fields] of Object.entries(dateFields)) {
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();
    let fixed = 0;

    for (const doc of docs) {
      const update = {};
      for (const field of fields) {
        if (doc[field] && typeof doc[field] === 'string') {
          update[field] = new Date(doc[field]);
        }
      }
      if (Object.keys(update).length > 0) {
        await col.updateOne({ _id: doc._id }, { $set: update });
        fixed++;
      }
    }
    console.log(`  ${colName}: ${fixed} docs corrigidos`);
  }

  await mongoose.disconnect();
  console.log('\n✓ Datas corrigidas! Reinicie o backend.');
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
