const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const quotationRoutes = require('./src/routes/quotationRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');

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
  max: process.env.NODE_ENV === 'test' ? 0 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'test' ? 0 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Limite de requisições atingido. Tente novamente em breve.' },
  skip: () => process.env.NODE_ENV === 'test',
});

app.use(globalLimiter);

// ── Body parser: limite de tamanho para evitar DoS ──────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rotas ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'API do gerenciador de vendas rodando!' });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/quotations', quotationRoutes);
app.use('/settings', settingsRoutes);

// ── Middleware de erro centralizado ──────────────────────────────────────────
// Captura erros não tratados e evita vazar detalhes internos
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Erro de CORS gerado acima
  if (err.message && err.message.startsWith('Origem não permitida')) {
    return res.status(403).json({ message: err.message });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} —`, err.message);

  return res.status(err.status || 500).json({
    message: err.status ? err.message : 'Erro interno do servidor.',
    ...(isDev && { detail: err.message }),
  });
});

module.exports = app;
