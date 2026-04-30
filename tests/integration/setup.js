const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Garante que o endpoint de registro de admin funciona nos testes
process.env.ADMIN_REGISTER_SECRET = process.env.ADMIN_REGISTER_SECRET || 'test-secret';

let mongod;

/**
 * Inicia o servidor MongoDB em memória e conecta o Mongoose.
 * Deve ser chamado em beforeAll de cada suite de integração.
 */
async function connectDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

/**
 * Limpa todas as collections entre testes.
 * Deve ser chamado em afterEach para garantir isolamento.
 */
async function clearDB() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({})),
  );
}

/**
 * Desconecta e para o servidor MongoDB em memória.
 * Deve ser chamado em afterAll.
 */
async function disconnectDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

module.exports = { connectDB, clearDB, disconnectDB };
