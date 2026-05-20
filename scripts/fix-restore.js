/**
 * Corrige os dados após um restore que converteu ObjectIds para strings.
 * Reconverte _id e campos de referência para ObjectId.
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Campos que devem ser ObjectId em cada collection
const objectIdFields = {
  users: ['_id'],
  clients: ['_id', 'representativeId'],
  suppliers: ['_id', 'allowedRepresentatives'],
  products: ['_id', 'clientId', 'supplierId'],
  orders: ['_id', 'clientId', 'supplierId', 'representativeId', 'sentToSupplierBy', 'lastEditedBy'],
  commissions: ['_id', 'orderId', 'representativeId', 'supplierId', 'parentOrderId'],
  quotations: ['_id', 'clientId', 'supplierId', 'representativeId'],
  settings: ['_id'],
};

function toObjectId(val) {
  if (!val) return val;
  if (val instanceof ObjectId) return val;
  if (typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val)) {
    return new ObjectId(val);
  }
  return val;
}

function convertDoc(doc, fields) {
  const converted = { ...doc };
  for (const field of fields) {
    if (field === 'allowedRepresentatives' && Array.isArray(converted[field])) {
      converted[field] = converted[field].map(toObjectId);
    } else if (converted[field] !== undefined && converted[field] !== null) {
      converted[field] = toObjectId(converted[field]);
    }
  }
  // Handle nested items with productId in orders
  if (converted.items && Array.isArray(converted.items)) {
    converted.items = converted.items.map(item => ({
      ...item,
      productId: toObjectId(item.productId),
    }));
  }
  return converted;
}

async function main() {
  console.log('Conectando...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Conectado. Corrigindo ObjectIds...\n');

  for (const [colName, fields] of Object.entries(objectIdFields)) {
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();
    
    if (docs.length === 0) {
      console.log(`  ${colName}: vazio`);
      continue;
    }

    // Verifica se precisa corrigir
    const firstDoc = docs[0];
    if (firstDoc._id instanceof ObjectId) {
      console.log(`  ${colName}: já está correto (${docs.length} docs)`);
      continue;
    }

    // Apaga e reinsere com ObjectIds corretos
    await col.deleteMany({});
    const converted = docs.map(doc => convertDoc(doc, fields));
    await col.insertMany(converted);
    console.log(`  ${colName}: ${docs.length} docs corrigidos ✓`);
  }

  await mongoose.disconnect();
  console.log('\n✓ Correção concluída! Reinicie o backend e faça login novamente.');
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
