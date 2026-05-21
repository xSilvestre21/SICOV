const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const quotationRoutes = require('./src/routes/quotationRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const commissionRoutes = require('./src/routes/commissionRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

const app = express();

// ── Segurança: headers HTTP ──────────────────────────────────────────────────
app.use(helmet());

// ── CORS: restringir origens permitidas ──────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: Postman, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Rate limiting: proteção contra brute force e abuso ───────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Conta bloqueada temporariamente. Tente novamente em 15 minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'production' ? 200 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Limite de requisições atingido. Tente novamente em breve.' },
  skip: () => process.env.NODE_ENV !== 'production',
});

app.use(globalLimiter);

// ── Body parser: limite de tamanho para evitar DoS ──────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rotas ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'API do gerenciador de vendas rodando!' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Servir frontend em produção ──────────────────────────────────────────────
const frontendPath = path.join(__dirname, 'SICOV-WEB', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    // Se não é uma rota da API, serve o index.html (SPA fallback)
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      next();
    }
  });
}

// ── Middleware de erro centralizado ──────────────────────────────────────────
// Captura erros não tratados e evita vazar detalhes internos
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Erro de CORS gerado acima
  if (err.message && err.message.startsWith('Origem não permitida')) {
    return res.status(403).json({ message: err.message });
  }

  const logger = require('./src/utils/logger');
  logger.error({ method: req.method, path: req.path, error: err.message }, 'Unhandled error');

  return res.status(err.status || 500).json({
    message: err.status ? err.message : 'Erro interno do servidor.',
    ...(isDev && { detail: err.message }),
  });
});

module.exports = app;
