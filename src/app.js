require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const cuentaRoutes = require('./routes/cuentaRoutes');
const beneficiarioRoutes = require('./routes/beneficiarioRoutes');
const transferenciaRoutes = require('./routes/transferenciaRoutes');

const app = express();

// CORS restringido al origen del frontend
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/cuenta', cuentaRoutes);
app.use('/api/beneficiarios', beneficiarioRoutes);
app.use('/api/transferencia', transferenciaRoutes);

app.get('/', (_req, res) => {
  res.json({ ok: true, mensaje: 'Banco Nexus API funcionando' });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});
