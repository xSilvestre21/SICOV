/**
 * Move os dados do banco "test" para "sicov-producao".
 * Copia todas as collections mantendo os dados intactos.
 *
 * Uso: node scripts/rename-database.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient } = require('mongodb');

const baseUri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function main() {
  console.log('Conectando...');
  const client = new MongoClient(baseUri);
  await client.connect();

  const sourceDb = client.db('test');
  const targetDb = client.db('sicov-producao');

  const collections = await sourceDb.listCollections().toArray();
  console.log(`\nCopiando ${collections.length} collections de "test" para "sicov-producao"...\n`);

  for (const col of collections) {
    const name = col.name;
    const docs = await sourceDb.collection(name).find({}).toArray();

    if (docs.length === 0) {
      console.log(`  ${name}: vazio (pulando)`);
      continue;
    }

    // Limpa a collection no destino (caso já exista)
    await targetDb.collection(name).deleteMany({});
    await targetDb.collection(name).insertMany(docs);
    console.log(`  ${name}: ${docs.length} docs copiados ✓`);
  }

  await client.close();
  console.log('\n=== Dados copiados para "sicov-producao" com sucesso! ===');
  console.log('\nAgora altere no .env:');
  console.log('  MONGO_URI=mongodb+srv://xSilvestre21:12345@sicov.2dxrb4l.mongodb.net/sicov-producao?appName=SICOV');
  console.log('  MONGODB_URI=mongodb+srv://xSilvestre21:12345@sicov.2dxrb4l.mongodb.net/sicov-producao?appName=SICOV');
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
