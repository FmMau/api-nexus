require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// ─────────────────────────────────────────────────────────────
// Configuración MongoDB
// ─────────────────────────────────────────────────────────────
const URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'banco_nexus';

let db;

// Conectar a MongoDB
async function conectarDB() {
  try {
    const client = new MongoClient(URI);

    await client.connect();

    db = client.db(DB_NAME);

    console.log(`MongoDB conectado → ${DB_NAME}`);
  } catch (error) {
    console.error('Error conectando MongoDB:', error.message);
    process.exit(1);
  }
}

// Obtener colección
function coleccion(nombre) {
  if (!db) {
    throw new Error('Base de datos no disponible');
  }

  return db.collection(nombre);
}

// Respuesta de error reutilizable
function respuestaError(res, status, mensaje) {
  return res.status(status).json({
    error: mensaje,
  });
}

// Validar cuenta
function validarCuenta(cuenta) {
  return typeof cuenta === 'string' && cuenta.trim().length > 0;
}

// Validar monto
function validarMonto(monto) {
  return typeof monto === 'number' && monto > 0;
}

// ─────────────────────────────────────────────────────────────
// Ruta principal
// ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Banco Nexus funcionando correctamente',
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/cuenta/:cuenta
// Obtiene saldo y datos del cliente
// ─────────────────────────────────────────────────────────────
app.get('/api/cuenta/:cuenta', async (req, res) => {
  try {
    const numeroCuenta = req.params.cuenta;

    if (!validarCuenta(numeroCuenta)) {
      return respuestaError(res, 400, 'Número de cuenta inválido');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      cuenta: numeroCuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    const clienteDoc = await coleccion('clientes').findOne({
      curp: cuentaDoc.cliente,
    });

    res.json({
      cuenta: cuentaDoc.cuenta,
      saldo: cuentaDoc.saldo,
      cliente: clienteDoc ? clienteDoc.nombre : 'Desconocido',
      curp: cuentaDoc.cliente,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/historial/:cuenta
// Obtiene historial de transacciones
// ─────────────────────────────────────────────────────────────
app.get('/api/historial/:cuenta', async (req, res) => {
  try {
    const numeroCuenta = req.params.cuenta;

    if (!validarCuenta(numeroCuenta)) {
      return respuestaError(res, 400, 'Número de cuenta inválido');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      cuenta: numeroCuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    const movimientos = await coleccion('transacciones')
      .find({ cuenta: numeroCuenta })
      .sort({ fecha: -1 })
      .toArray();

    res.json(movimientos);
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/deposito
// ─────────────────────────────────────────────────────────────
app.post('/api/deposito', async (req, res) => {
  try {
    const { cuenta, monto } = req.body;

    if (!validarCuenta(cuenta)) {
      return respuestaError(res, 400, 'Cuenta inválida');
    }

    if (!validarMonto(monto)) {
      return respuestaError(
        res,
        400,
        'El monto debe ser un número positivo'
      );
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      cuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    await coleccion('cuentas').updateOne(
      { cuenta },
      {
        $inc: { saldo: monto },
      }
    );

    const cuentaActualizada = await coleccion('cuentas').findOne({
      cuenta,
    });

    await coleccion('transacciones').insertOne({
      cuenta,
      tipo: 'deposito',
      monto,
      saldo: cuentaActualizada.saldo,
      fecha: new Date(),
    });

    res.json({
      mensaje: 'Depósito realizado con éxito',
      saldo: cuentaActualizada.saldo,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/retiro
// ─────────────────────────────────────────────────────────────
app.post('/api/retiro', async (req, res) => {
  try {
    const { cuenta, monto } = req.body;

    if (!validarCuenta(cuenta)) {
      return respuestaError(res, 400, 'Cuenta inválida');
    }

    if (!validarMonto(monto)) {
      return respuestaError(
        res,
        400,
        'El monto debe ser un número positivo'
      );
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      cuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    if (cuentaDoc.saldo < monto) {
      return respuestaError(res, 400, 'Saldo insuficiente');
    }

    await coleccion('cuentas').updateOne(
      { cuenta },
      {
        $inc: { saldo: -monto },
      }
    );

    const cuentaActualizada = await coleccion('cuentas').findOne({
      cuenta,
    });

    await coleccion('transacciones').insertOne({
      cuenta,
      tipo: 'retiro',
      monto,
      saldo: cuentaActualizada.saldo,
      fecha: new Date(),
    });

    res.json({
      mensaje: 'Retiro realizado con éxito',
      saldo: cuentaActualizada.saldo,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// Iniciar servidor
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

conectarDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});