/**
 * Atualiza os productSnapshot dos pedidos e orçamentos existentes
 * com os códigos atuais dos produtos (supplierCode, clientCode).
 * 
 * Uso: node scripts/update-snapshots.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Order = require('../src/models/order');
const Quotation = require('../src/models/quotation');
const Product = require('../src/models/product');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB');

  const products = await Product.find({}).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  // Atualiza pedidos
  const orders = await Order.find({});
  let orderUpdates = 0;
  for (const order of orders) {
    let changed = false;
    for (const item of order.items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      if (product.supplierCode && item.productSnapshot.supplierCode !== product.supplierCode) {
        item.productSnapshot.supplierCode = product.supplierCode;
        changed = true;
      }
      if (product.clientCode && item.productSnapshot.clientCode !== product.clientCode) {
        item.productSnapshot.clientCode = product.clientCode;
        changed = true;
      }
    }
    if (changed) {
      await order.save();
      orderUpdates++;
    }
  }
  console.log(`Pedidos atualizados: ${orderUpdates}`);

  // Atualiza orçamentos
  const quotations = await Quotation.find({});
  let quotationUpdates = 0;
  for (const quotation of quotations) {
    let changed = false;
    for (const item of quotation.items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      if (product.supplierCode && item.productSnapshot.supplierCode !== product.supplierCode) {
        item.productSnapshot.supplierCode = product.supplierCode;
        changed = true;
      }
      if (product.clientCode && item.productSnapshot.clientCode !== product.clientCode) {
        item.productSnapshot.clientCode = product.clientCode;
        changed = true;
      }
    }
    if (changed) {
      await quotation.save();
      quotationUpdates++;
    }
  }
  console.log(`Orçamentos atualizados: ${quotationUpdates}`);

  await mongoose.disconnect();
  console.log('Concluído!');
}

run().catch((err) => { console.error(err); process.exit(1); });
