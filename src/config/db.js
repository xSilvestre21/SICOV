const mongoose = require('mongoose');
const dns = require('dns');

// Usa Google/Cloudflare DNS para evitar problemas com DNS de provedores (ex: Vivo)
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB conectado com sucesso!');
  } catch (err) {
    console.error('Erro ao conectar no MongoDB: ', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
