/**
 * Script de migração: popula o campo deliveryDate nas comissões existentes
 * a partir do pedido vinculado.
 *
 * Uso: node migrate_commission_dates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Commission = require('./src/models/commission');
const Order = require('./src/models/order');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB');

  const commissions = await Commission.find({ deliveryDate: { $exists: false } });
  console.log(`${commissions.length} comissões para atualizar`);

  let updated = 0;
  for (const c of commissions) {
    const order = await Order.findById(c.orderId).select('deliveryDate');
    if (order && order.deliveryDate) {
      c.deliveryDate = order.deliveryDate;
      await c.save();
      updated++;
    }
  }

  console.log(`${updated} comissões atualizadas com deliveryDate`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
