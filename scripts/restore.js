/**
 * Script de Restauração de Backup — SICOV
 *
 * Restaura um backup .json.gz gerado pelo script backup.js.
 * ATENÇÃO: Isso SUBSTITUI todos os dados atuais do banco!
 *
 * Uso:
 *   node scripts/restore.js "C:\Users\gustt\OneDrive\SICOV-Backups\sicov-backup-2026-05-20-09h33.json.gz"
 *
 * O script vai:
 *   1. Perguntar confirmação (para não restaurar por acidente)
 *   2. Conectar no MongoDB
 *   3. Limpar todas as collections existentes
 *   4. Inserir os dados do backup
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

// ─── Configuração ────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const backupFile = process.argv[2];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function askConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

// ─── Execução principal ──────────────────────────────────────────────────────

async function main() {
  log('=== SICOV Restore ===');

  // Validações
  if (!backupFile) {
    console.log('\nUso: node scripts/restore.js <caminho-do-arquivo.json.gz>\n');
    console.log('Exemplo:');
    console.log('  node scripts/restore.js "C:\\Users\\gustt\\OneDrive\\SICOV-Backups\\sicov-backup-2026-05-20-09h33.json.gz"');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    log(`ERRO: Arquivo não encontrado: ${backupFile}`);
    process.exit(1);
  }

  if (!MONGODB_URI) {
    log('ERRO: MONGODB_URI ou MONGO_URI não definida no .env');
    process.exit(1);
  }

  // Confirmação
  console.log('\n⚠️  ATENÇÃO: Isso vai SUBSTITUIR todos os dados atuais do banco!');
  console.log(`   Arquivo: ${backupFile}`);
  console.log(`   Banco:   ${MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@')}\n`);

  const answer = await askConfirmation('Tem certeza? Digite "sim" para confirmar: ');
  if (answer !== 'sim') {
    log('Restauração cancelada.');
    process.exit(0);
  }

  // 1. Ler e descompactar o backup
  log('Lendo arquivo de backup...');
  const compressed = fs.readFileSync(backupFile);
  const json = zlib.gunzipSync(compressed).toString('utf-8');
  const data = JSON.parse(json);

  const collectionNames = Object.keys(data);
  const totalDocs = collectionNames.reduce((sum, name) => sum + data[name].length, 0);
  log(`Backup contém ${collectionNames.length} collections, ${totalDocs} documentos total.`);

  // 2. Conectar no MongoDB
  log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  log('Conectado.');

  // 3. Limpar collections existentes e inserir dados do backup
  for (const name of collectionNames) {
    const docs = data[name];
    if (docs.length === 0) {
      log(`  ${name}: vazio (pulando)`);
      continue;
    }

    // Limpa a collection
    try {
      await db.collection(name).deleteMany({});
    } catch {
      // Collection pode não existir ainda
    }

    // Converte _id e campos de referência para ObjectId antes de inserir
    const fixedDocs = docs.map(doc => {
      const fixed = { ...doc };
      // Converte _id
      if (fixed._id && typeof fixed._id === 'string' && /^[0-9a-fA-F]{24}$/.test(fixed._id)) {
        fixed._id = new mongoose.Types.ObjectId(fixed._id);
      }
      // Converte campos comuns de referência
      const refFields = ['clientId', 'supplierId', 'representativeId', 'orderId', 'sentToSupplierBy', 'lastEditedBy', 'parentOrderId'];
      for (const field of refFields) {
        if (fixed[field] && typeof fixed[field] === 'string' && /^[0-9a-fA-F]{24}$/.test(fixed[field])) {
          fixed[field] = new mongoose.Types.ObjectId(fixed[field]);
        }
      }
      // Converte productId em items
      if (Array.isArray(fixed.items)) {
        fixed.items = fixed.items.map(item => {
          if (item.productId && typeof item.productId === 'string' && /^[0-9a-fA-F]{24}$/.test(item.productId)) {
            return { ...item, productId: new mongoose.Types.ObjectId(item.productId) };
          }
          return item;
        });
      }
      // Converte allowedRepresentatives
      if (Array.isArray(fixed.allowedRepresentatives)) {
        fixed.allowedRepresentatives = fixed.allowedRepresentatives.map(id =>
          typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) ? new mongoose.Types.ObjectId(id) : id
        );
      }
      return fixed;
    });

    // Insere os documentos
    await db.collection(name).insertMany(fixedDocs);
    log(`  ${name}: ${docs.length} documentos restaurados`);
  }

  await mongoose.disconnect();
  log('=== Restauração concluída com sucesso! ===');
}

main().catch((err) => {
  log(`ERRO: ${err.message}`);
  process.exit(1);
});
