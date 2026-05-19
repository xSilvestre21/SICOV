/**
 * Script de Backup Automático — SICOV
 *
 * Exporta todas as collections do MongoDB em JSON compactado (.gz).
 * Não requer mongodump — usa Mongoose diretamente.
 *
 * Configuração via .env:
 *   MONGODB_URI ou MONGO_URI — URI do MongoDB
 *   BACKUP_LOCAL_DIR         — Pasta de destino (padrão: ./backups)
 *   BACKUP_RETENTION_DAYS    — Dias para manter backups (padrão: 7)
 *
 * Uso:
 *   node scripts/backup.js           — Executa backup
 *   node scripts/backup.js --cleanup — Apenas limpa backups antigos
 *
 * Agendar no Windows (Task Scheduler):
 *   Programa: node
 *   Argumentos: "C:\Users\gustt\Desktop\SICOV\SICOV-APP\scripts\backup.js"
 *   Iniciar em: C:\Users\gustt\Desktop\SICOV\SICOV-APP
 *   Frequência: Diária às 18:30
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Configuração ────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 7;
const LOCAL_DIR = process.env.BACKUP_LOCAL_DIR || path.join(__dirname, '..', 'backups');
const CLEANUP_ONLY = process.argv.includes('--cleanup');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}h${pad(now.getMinutes())}`;
}

// ─── Limpeza de backups antigos ──────────────────────────────────────────────

function cleanupOldBackups() {
  if (!fs.existsSync(LOCAL_DIR)) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const files = fs.readdirSync(LOCAL_DIR).filter((f) => f.startsWith('sicov-backup-'));
  let removed = 0;

  for (const file of files) {
    const filePath = path.join(LOCAL_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
      removed++;
    }
  }

  if (removed > 0) {
    log(`${removed} backup(s) antigo(s) removido(s).`);
  } else {
    log('Nenhum backup antigo para remover.');
  }
}

// ─── Backup via Mongoose ─────────────────────────────────────────────────────

async function backupDatabase() {
  log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI);
  log('Conectado.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  log(`Exportando ${collections.length} collections...`);

  const backupData = {};

  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({}).toArray();
    backupData[name] = docs;
    log(`  ${name}: ${docs.length} documentos`);
  }

  await mongoose.disconnect();
  log('Desconectado do MongoDB.');

  return backupData;
}

// ─── Salvar arquivo compactado ───────────────────────────────────────────────

function saveBackup(data, filePath) {
  const json = JSON.stringify(data);
  const compressed = zlib.gzipSync(json);
  fs.writeFileSync(filePath, compressed);
  const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
  log(`Backup salvo: ${filePath} (${sizeMB} MB)`);
}

// ─── Execução principal ──────────────────────────────────────────────────────

async function main() {
  log('=== SICOV Backup ===');

  if (!MONGODB_URI) {
    log('ERRO: MONGODB_URI ou MONGO_URI não definida no .env');
    process.exit(1);
  }

  // Cria diretório se não existe
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    log(`Pasta criada: ${LOCAL_DIR}`);
  }

  // Modo cleanup-only
  if (CLEANUP_ONLY) {
    cleanupOldBackups();
    log('Limpeza concluída.');
    return;
  }

  // 1. Exportar dados
  const data = await backupDatabase();

  // 2. Salvar compactado
  const timestamp = getTimestamp();
  const filename = `sicov-backup-${timestamp}.json.gz`;
  const filePath = path.join(LOCAL_DIR, filename);
  saveBackup(data, filePath);

  // 3. Limpar backups antigos
  cleanupOldBackups();

  log(`=== Backup concluído! Arquivo: ${filename} ===`);
  log(`Pasta: ${LOCAL_DIR}`);
  log(`Retenção: ${RETENTION_DAYS} dias`);
}

main().catch((err) => {
  log(`ERRO: ${err.message}`);
  process.exit(1);
});
