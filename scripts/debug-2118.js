require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Order = require('../src/models/order');
const Product = require('../src/models/product');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const order = await Order.findOne({ orderNumber: 2118 }).lean();
  for (const item of order.items) {
    const snapName = item.productSnapshot?.name;
    console.log(`Snapshot name: [${snapName}] (length: ${snapName?.length})`);
    console.log(`  productId: ${item.productId}`);
    
    // Try to find by productId
    if (item.productId) {
      const p = await Product.findById(item.productId).select('name clientCode supplierCode').lean();
      if (p) {
        console.log(`  Found by ID: [${p.name}] clientCode: "${p.clientCode}" supplierCode: "${p.supplierCode}"`);
      } else {
        console.log(`  NOT FOUND by ID`);
        // Try by name
        const byName = await Product.findOne({ name: snapName }).select('name clientCode supplierCode').lean();
        if (byName) {
          console.log(`  Found by name: clientCode: "${byName.clientCode}" supplierCode: "${byName.supplierCode}"`);
        } else {
          // Try partial match
          const partial = await Product.findOne({ name: { $regex: snapName?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }).select('name clientCode supplierCode').lean();
          console.log(`  Partial match: ${partial ? `"${partial.name}" clientCode: "${partial.clientCode}"` : 'NONE'}`);
        }
      }
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
