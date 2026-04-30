const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API do gerenciador de vendas rodando!' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);

module.exports = app;
