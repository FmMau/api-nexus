const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

// ─── Saldo y datos de cuenta ──────────────────────────────────────────────────
async function obtenerCuenta(req, res) {
  try {
    const db = getDB();

    const cuenta = await db.collection('cuentas').findOne(
      { clienteId: new ObjectId(req.usuario.id) },
      { projection: { _id: 0, numeroCuenta: 1, saldo: 1, estado: 1, fechaApertura: 1 } }
    );

    if (!cuenta) {
      return res.status(404).json({ ok: false, mensaje: 'Cuenta no encontrada' });
    }

    res.json({ ok: true, cuenta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── Historial de movimientos ─────────────────────────────────────────────────
async function obtenerMovimientos(req, res) {
  try {
    const db = getDB();

    const cuenta = await db.collection('cuentas').findOne(
      { clienteId: new ObjectId(req.usuario.id) },
      { projection: { numeroCuenta: 1 } }
    );

    if (!cuenta) {
      return res.status(404).json({ ok: false, mensaje: 'Cuenta no encontrada' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const movimientos = await db
      .collection('transferencias')
      .find({
        $or: [
          { cuentaOrigen: cuenta.numeroCuenta },
          { cuentaDestino: cuenta.numeroCuenta },
        ],
      })
      .sort({ fechaHora: -1 })
      .skip(skip)
      .limit(limit)
      .project({ _id: 0 })
      .toArray();

    const movimientosEnriquecidos = movimientos.map((m) => ({
      ...m,
      tipo: m.cuentaOrigen === cuenta.numeroCuenta ? 'cargo' : 'abono',
    }));

    res.json({ ok: true, numeroCuenta: cuenta.numeroCuenta, movimientos: movimientosEnriquecidos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── Perfil del usuario ───────────────────────────────────────────────────────
async function obtenerPerfil(req, res) {
  try {
    const db = getDB();

    const usuario = await db.collection('clientes').findOne(
      { _id: new ObjectId(req.usuario.id) },
      { projection: { contraseña: 0 } }
    );

    if (!usuario) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const cuenta = await db.collection('cuentas').findOne(
      { clienteId: new ObjectId(req.usuario.id) },
      { projection: { numeroCuenta: 1, saldo: 1, estado: 1 } }
    );

    res.json({ ok: true, usuario, cuenta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── Actualizar perfil ────────────────────────────────────────────────────────
async function actualizarPerfil(req, res) {
  const { nombre, telefono } = req.body || {};

  try {
    const db = getDB();

    const campos = {};
    if (nombre) campos.nombre = nombre;
    if (telefono) campos.telefono = telefono;

    if (Object.keys(campos).length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' });
    }

    await db.collection('clientes').updateOne(
      { _id: new ObjectId(req.usuario.id) },
      { $set: campos }
    );

    await db.collection('auditoria').insertOne({
      fechaHora: new Date(),
      usuarioId: new ObjectId(req.usuario.id),
      accion: 'actualizacion_perfil',
      estado: 'exitoso',
      detalle: { camposActualizados: Object.keys(campos) },
    });

    res.json({ ok: true, mensaje: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { obtenerCuenta, obtenerMovimientos, obtenerPerfil, actualizarPerfil };
