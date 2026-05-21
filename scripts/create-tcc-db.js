/**
 * Cria database sicov-tcc com dados ficticios para apresentacao do TCC.
 * Uso: node scripts/create-tcc-db.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient, ObjectId } = require('mongodb');
const argon2 = require('argon2');

const baseUri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function main() {
  console.log('Conectando...');
  const client = new MongoClient(baseUri);
  await client.connect();
  const db = client.db('sicov-tcc');

  // Limpa
  const cols = await db.listCollections().toArray();
  for (const c of cols) await db.collection(c.name).deleteMany({});

  const adminPwd = await argon2.hash('admin123');
  const repPwd = await argon2.hash('rep12345');

  const adminId = new ObjectId();
  const rep1Id = new ObjectId();
  const rep2Id = new ObjectId();
  const sup1Id = new ObjectId();
  const sup2Id = new ObjectId();
  const cli1Id = new ObjectId();
  const cli2Id = new ObjectId();
  const cli3Id = new ObjectId();
  const prod1Id = new ObjectId();
  const prod2Id = new ObjectId();
  const order1Id = new ObjectId();
  const order2Id = new ObjectId();

  await db.collection('users').insertMany([
    { _id: adminId, name: 'Administrador', email: 'admin@sicov.com', password: adminPwd, profile: 'admin', active: true, defaultCommissionPercentage: 0, themePreference: 'light', createdAt: new Date(), updatedAt: new Date() },
    { _id: rep1Id, name: 'Joao Representante', email: 'joao@sicov.com', password: repPwd, profile: 'representative', active: true, defaultCommissionPercentage: 30, themePreference: 'light', createdAt: new Date(), updatedAt: new Date() },
    { _id: rep2Id, name: 'Maria Representante', email: 'maria@sicov.com', password: repPwd, profile: 'representative', active: true, defaultCommissionPercentage: 25, themePreference: 'light', createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('suppliers').insertMany([
    { _id: sup1Id, name: 'Plasticos Brasil Ltda', tradeName: 'PlastBR', cnpj: '12345678000100', ipi: 10, active: true, currentOrderNumber: 100, priceTable: [{ material: 'PEAD', density: 0.95, factorKg: 12 }, { material: 'PEBD', density: 0.92, factorKg: 10 }], allowedRepresentatives: [rep1Id, rep2Id], createdAt: new Date(), updatedAt: new Date() },
    { _id: sup2Id, name: 'Embalagens Nacional SA', tradeName: 'EmbaNac', cnpj: '98765432000100', ipi: 5, active: true, currentOrderNumber: 50, priceTable: [{ material: 'PP', density: 0.90, factorKg: 15 }], allowedRepresentatives: [rep1Id], createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('clients').insertMany([
    { _id: cli1Id, name: 'Supermercado Bom Preco Ltda', tradeName: 'Bom Preco', cnpj: '11222333000144', representativeId: rep1Id, active: true, city: 'Sao Paulo', state: 'SP', phone: '11999998888', email: 'compras@bompreco.com', paymentTerm: '30/60 dias', createdAt: new Date(), updatedAt: new Date() },
    { _id: cli2Id, name: 'Industria Alimentos Sabor SA', tradeName: 'Sabor', cnpj: '44555666000177', representativeId: rep1Id, active: true, city: 'Campinas', state: 'SP', phone: '19988887777', email: 'compras@sabor.com', paymentTerm: '28 dias', createdAt: new Date(), updatedAt: new Date() },
    { _id: cli3Id, name: 'Distribuidora Central Ltda', tradeName: 'Central', cnpj: '77888999000100', representativeId: rep2Id, active: true, city: 'Rio de Janeiro', state: 'RJ', phone: '21977776666', email: 'pedidos@central.com', paymentTerm: '30 dias', createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('products').insertMany([
    { _id: prod1Id, name: '100x48x0,1 PEAD', clientId: cli1Id, supplierId: sup1Id, calculationMode: 'dimensions_density_factor', saleMode: 'thousand', productType: 'plastic_bag', material: 'PEAD', technicalData: { measurements: { width: 100, length: 48, thickness: 0.1 } }, commercialData: { density: 0.95, factorKg: 12, basePrice: 54.72 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { _id: prod2Id, name: 'Bobina Stretch 500mm', clientId: cli2Id, supplierId: sup2Id, calculationMode: 'weight_times_price_per_kg', saleMode: 'kg', productType: 'stretch', material: 'PP', technicalData: { measurements: {} }, commercialData: { basePrice: 15 }, active: true, createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('orders').insertMany([
    { _id: order1Id, orderNumber: 101, clientId: cli1Id, supplierId: sup1Id, representativeId: adminId, status: 'active', subtotal: 54720, ipiValue: 5472, total: 60192, deliveryDate: new Date('2026-06-15'), sentToSupplier: true, sentToSupplierAt: new Date(), items: [{ productId: prod1Id, productSnapshot: { name: '100x48x0,1 PEAD', unitLabel: 'ML' }, quantity: 1000, unitPrice: 54.72, subtotal: 54720 }], clientSnapshot: { name: 'Supermercado Bom Preco Ltda', tradeName: 'Bom Preco' }, supplierSnapshot: { name: 'Plasticos Brasil Ltda', tradeName: 'PlastBR', ipi: 10 }, paymentTerm: '30/60 dias', sellerName: 'Administrador', createdAt: new Date(), updatedAt: new Date() },
    { _id: order2Id, orderNumber: 51, clientId: cli3Id, supplierId: sup2Id, representativeId: rep2Id, status: 'active', subtotal: 7500, ipiValue: 375, total: 7875, deliveryDate: new Date('2026-07-01'), sentToSupplier: false, items: [{ productId: prod2Id, productSnapshot: { name: 'Bobina Stretch 500mm', unitLabel: 'KG' }, quantity: 500, unitPrice: 15, subtotal: 7500 }], clientSnapshot: { name: 'Distribuidora Central Ltda', tradeName: 'Central' }, supplierSnapshot: { name: 'Embalagens Nacional SA', tradeName: 'EmbaNac', ipi: 5 }, paymentTerm: '30 dias', sellerName: 'Administrador', createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('commissions').insertMany([
    { _id: new ObjectId(), orderId: order1Id, representativeId: rep1Id, representativeName: 'Joao Representante', orderValueWithoutIpi: 54720, orderNumber: 101, supplierId: sup1Id, supplierName: 'PlastBR', pool: 2736, representativePercentage: 30, adminPercentage: 5, representativeCommission: 820.80, adminCommission: 1915.20, period: { month: 6, year: 2026 }, status: 'active', projected: false, createdAt: new Date(), updatedAt: new Date() },
    { _id: new ObjectId(), orderId: order2Id, representativeId: rep2Id, representativeName: 'Maria Representante', orderValueWithoutIpi: 7500, orderNumber: 51, supplierId: sup2Id, supplierName: 'EmbaNac', pool: 375, representativePercentage: 25, adminPercentage: 5, representativeCommission: 93.75, adminCommission: 281.25, period: { month: 7, year: 2026 }, status: 'active', projected: false, createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.collection('settings').insertOne({
    _id: new ObjectId(), singleton: true, defaultObservations: 'Condicoes de pagamento conforme negociado.\nFrete por conta do comprador.', defaultSellerName: 'Administrador', createdAt: new Date(), updatedAt: new Date(),
  });

  await client.close();
  console.log('\n=== Banco sicov-tcc criado! ===');
  console.log('\nCredenciais:');
  console.log('  Admin: admin@sicov.com / admin123');
  console.log('  Rep 1: joao@sicov.com / rep12345');
  console.log('  Rep 2: maria@sicov.com / rep12345');
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
