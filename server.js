require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// ─────────────────────────────────────────────────────────────
// Configuración MongoDB Replica Set
// ─────────────────────────────────────────────────────────────

const URI =
  process.env.MONGO_URI ||
  'mongodb://localhost:27017,localhost:27018,localhost:27019/BancoNexus?replicaSet=rsBanco';

const DB_NAME = 'BancoNexus';

let db;
let client;

// ─────────────────────────────────────────────────────────────
// Conexión MongoDB Replica Set
// ─────────────────────────────────────────────────────────────

async function conectarDB() {
  try {
    client = new MongoClient(URI, {
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();

    db = client.db(DB_NAME);

    console.log('Conectado al Replica Set MongoDB');

    // Verificar estado del nodo
    const admin = db.admin();

    const estado = await admin.command({ hello: 1 });

    console.log('Nodo conectado:', estado.me);

    if (estado.isWritablePrimary) {
      console.log('Estado del nodo: PRIMARY');
    } else {
      console.log('Estado del nodo: SECONDARY');
    }
  } catch (error) {
    console.error('Error conectando Replica Set:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('Uno o más nodos no están disponibles');
    }

    if (error.message.includes('ReplicaSetNoPrimary')) {
      console.error('No hay nodo PRIMARY disponible');
    }

    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// Obtener colección
// ─────────────────────────────────────────────────────────────

function coleccion(nombre) {
  if (!db) {
    throw new Error('Base de datos no disponible');
  }

  return db.collection(nombre);
}

// ─────────────────────────────────────────────────────────────
// Respuesta reutilizable de error
// ─────────────────────────────────────────────────────────────

function respuestaError(res, status, mensaje) {
  return res.status(status).json({
    ok: false,
    mensaje,
  });
}

// ─────────────────────────────────────────────────────────────
// Validaciones
// ─────────────────────────────────────────────────────────────

function validarCuenta(cuenta) {
  return typeof cuenta === 'string' && cuenta.trim().length > 0;
}

function validarMonto(monto) {
  return typeof monto === 'number' && monto > 0;
}

function validarSucursal(sucursal) {
  return typeof sucursal === 'string' && sucursal.trim().length > 0;
}

// ─────────────────────────────────────────────────────────────
// Ruta principal
// ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'API Banco Nexus funcionando correctamente',
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/cuenta/:cuenta
// Obtener datos de cuenta
// ─────────────────────────────────────────────────────────────

app.get('/api/cuenta/:cuenta', async (req, res) => {
  try {
    const numeroCuenta = req.params.cuenta;

    if (!validarCuenta(numeroCuenta)) {
      return respuestaError(res, 400, 'Número de cuenta inválido');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      numeroCuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    const clienteDoc = await coleccion('clientes').findOne({
      _id: new ObjectId(cuentaDoc.clienteId),
    });

    res.json({
      ok: true,
      cuenta: {
        numeroCuenta: cuentaDoc.numeroCuenta,
        tipo: cuentaDoc.tipo,
        saldo: cuentaDoc.saldo,
        status: cuentaDoc.status,
        fechaApertura: cuentaDoc.fechaApertura,
      },
      cliente: clienteDoc
        ? {
            nombre: clienteDoc.nombre,
            curp: clienteDoc.curp,
            correo: clienteDoc.correo,
            telefono: clienteDoc.telefono,
          }
        : null,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/historial/:cuenta
// Obtener historial de transacciones
// ─────────────────────────────────────────────────────────────

app.get('/api/historial/:cuenta', async (req, res) => {
  try {
    const numeroCuenta = req.params.cuenta;

    if (!validarCuenta(numeroCuenta)) {
      return respuestaError(res, 400, 'Número de cuenta inválido');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      numeroCuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    const movimientos = await coleccion('transacciones')
      .find({
        cuentaId: cuentaDoc._id,
      })
      .sort({ fecha: -1 })
      .toArray();

    res.json({
      ok: true,
      total: movimientos.length,
      movimientos,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/deposito
// Realizar depósito
// ─────────────────────────────────────────────────────────────

app.post('/api/deposito', async (req, res) => {
  try {
    const { cuenta, monto, sucursal } = req.body;

    // Validaciones

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

    if (!validarSucursal(sucursal)) {
      return respuestaError(res, 400, 'Sucursal inválida');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      numeroCuenta: cuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    if (cuentaDoc.status !== 'activa') {
      return respuestaError(res, 400, 'La cuenta está inactiva');
    }

    // Actualizar saldo

    await coleccion('cuentas').updateOne(
      {
        numeroCuenta: cuenta,
      },
      {
        $inc: { saldo: monto },
      }
    );

    // Obtener saldo actualizado

    const cuentaActualizada = await coleccion('cuentas').findOne({
      numeroCuenta: cuenta,
    });

    // Registrar transacción

    await coleccion('transacciones').insertOne({
      cuentaId: cuentaDoc._id,
      monto,
      tipo: 'deposito',
      concepto: 'Deposito realizado desde API',
      sucursal,
      fecha: new Date(),
    });

    res.json({
      ok: true,
      mensaje: 'Depósito realizado correctamente',
      sucursal,
      saldoActual: cuentaActualizada.saldo,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/retiro
// Realizar retiro
// ─────────────────────────────────────────────────────────────

app.post('/api/retiro', async (req, res) => {
  try {
    const { cuenta, monto, sucursal } = req.body;

    // Validaciones

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

    if (!validarSucursal(sucursal)) {
      return respuestaError(res, 400, 'Sucursal inválida');
    }

    const cuentaDoc = await coleccion('cuentas').findOne({
      numeroCuenta: cuenta,
    });

    if (!cuentaDoc) {
      return respuestaError(res, 404, 'Cuenta no encontrada');
    }

    if (cuentaDoc.status !== 'activa') {
      return respuestaError(res, 400, 'La cuenta está inactiva');
    }

    if (cuentaDoc.saldo < monto) {
      return respuestaError(res, 400, 'Saldo insuficiente');
    }

    // Actualizar saldo

    await coleccion('cuentas').updateOne(
      {
        numeroCuenta: cuenta,
      },
      {
        $inc: { saldo: -monto },
      }
    );

    // Obtener saldo actualizado

    const cuentaActualizada = await coleccion('cuentas').findOne({
      numeroCuenta: cuenta,
    });

    // Registrar transacción

    await coleccion('transacciones').insertOne({
      cuentaId: cuentaDoc._id,
      monto,
      tipo: 'retiro',
      concepto: 'Retiro realizado desde API',
      sucursal,
      fecha: new Date(),
    });

    res.json({
      ok: true,
      mensaje: 'Retiro realizado correctamente',
      sucursal,
      saldoActual: cuentaActualizada.saldo,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/cuentas
// Listar cuentas
// ─────────────────────────────────────────────────────────────

app.get('/api/cuentas', async (req, res) => {
  try {
    const cuentas = await coleccion('cuentas')
      .aggregate([
        {
          $lookup: {
            from: 'clientes',
            localField: 'clienteId',
            foreignField: '_id',
            as: 'clienteInfo',
          },
        },
        {
          $unwind: {
            path: '$clienteInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            cuenta: '$numeroCuenta',
            tipo: 1,
            saldo: 1,
            status: 1,
            cliente: '$clienteInfo.nombre',
          },
        },
      ])
      .toArray();

    res.json({
      ok: true,
      total: cuentas.length,
      cuentas,
    });
  } catch (error) {
    console.error(error);

    respuestaError(res, 500, 'Error interno del servidor');
  }
});

// ─────────────────────────────────────────────────────────────
// Ruta de prueba Replica Set
// ─────────────────────────────────────────────────────────────

app.get('/api/replica-status', async (req, res) => {
  try {
    const admin = db.admin();

    const estado = await admin.command({ replSetGetStatus: 1 });

    const miembros = estado.members.map((member) => ({
      nombre: member.name,
      estado: member.stateStr,
      uptime: member.uptime,
    }));

    res.json({
      ok: true,
      replicaSet: estado.set,
      miembros,
    });
  } catch (error) {
    console.error(error);

    respuestaError(
      res,
      500,
      'Error obteniendo estado del Replica Set'
    );
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