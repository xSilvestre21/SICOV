/**
 * Força atualização dos códigos em TODOS os pedidos,
 * fazendo match por nome do produto quando o productId não encontra.
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Order = require('../src/models/order');
const Product = require('../src/models/product');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB');

  const products = await Product.find({}).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));
  const productByName = new Map();
  products.forEach((p) => {
    if (p.name) productByName.set(p.name.trim(), p);
  });

  const orders = await Order.find({});
  let updated = 0;

  for (const order of orders) {
    let changed = false;
    for (const item of order.items) {
      // Tenta encontrar o produto por ID ou por nome
      let product = null;
      if (item.productId) {
        product = productById.get(item.productId.toString());
      }
      if (!product && item.productSnapshot?.name) {
        product = productByName.get(item.productSnapshot.name.trim());
      }
      if (!product) continue;

      const ps = item.productSnapshot || {};
      if (product.clientCode && (ps.clientCode || '') !== product.clientCode) {
        if (!item.productSnapshot) item.productSnapshot = {};
        item.productSnapshot.clientCode = product.clientCode;
        changed = true;
      }
      if (product.supplierCode && (ps.supplierCode || '') !== product.supplierCode) {
        if (!item.productSnapshot) item.productSnapshot = {};
        item.productSnapshot.supplierCode = product.supplierCode;
        changed = true;
      }
    }
    if (changed) {
      await order.save();
      updated++;
      console.log(`  Atualizado pedido #${order.orderNumber}`);
    }
  }

  console.log(`\nTotal: ${updated} pedidos atualizados`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
