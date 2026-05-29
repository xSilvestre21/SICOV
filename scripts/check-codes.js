require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Product = require('../src/models/product');
const Order = require('../src/models/order');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Check products with codes
  const products = await Product.find({ $or: [{ clientCode: { $exists: true, $ne: '' } }, { supplierCode: { $exists: true, $ne: '' } }] }).select('name clientCode supplierCode').lean();
  console.log(`Produtos com código: ${products.length}`);
  products.forEach(p => console.log(`  ${p.name} | clientCode: "${p.clientCode || ''}" | supplierCode: "${p.supplierCode || ''}"`));

  // Check order 2118 specifically
  const order = await Order.findOne({ orderNumber: 2118 }).lean();
  if (order) {
    console.log(`\nPedido 2118 - items:`);
    order.items.forEach((item, i) => {
      const ps = item.productSnapshot || {};
      console.log(`  Item ${i+1}: ${ps.name} | clientCode: "${ps.clientCode || ''}" | supplierCode: "${ps.supplierCode || ''}"`);
    });
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
