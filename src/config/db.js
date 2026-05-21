const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERRO: MONGO_URI não definida nas variáveis de ambiente.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('MongoDB conectado com sucesso!');
  } catch (err) {
    console.error('Erro ao conectar no MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
