const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const { validarCuenta } = require('../utils/validators');
const registrarAuditoria = require('../utils/auditoria');

// ─── Listar beneficiarios del usuario ─────────────────────────────────────────
async function obtenerBeneficiarios(req, res) {
  try {
    const db = getDB();

    const beneficiarios = await db
      .collection('beneficiarios')
      .find({ clienteId: new ObjectId(req.usuario.id) })
      .project({ _id: 1, numeroCuentaDestino: 1, alias: 1, fechaRegistro: 1 })
      .sort({ alias: 1 })
      .toArray();

    res.json({ ok: true, beneficiarios });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── Agregar beneficiario ─────────────────────────────────────────────────────
async function agregarBeneficiario(req, res) {
  const { numeroCuentaDestino, alias } = req.body || {};

  if (!validarCuenta(numeroCuentaDestino)) {
    return res.status(400).json({ ok: false, mensaje: 'Número de cuenta destino inválido' });
  }

  if (!alias || alias.trim().length === 0) {
    return res.status(400).json({ ok: false, mensaje: 'El alias es requerido' });
  }

  try {
    const db = getDB();

    // Verificar que la cuenta destino existe
    const cuentaExiste = await db.collection('cuentas').findOne({ numeroCuenta: numeroCuentaDestino });
    if (!cuentaExiste) {
      return res.status(404).json({ ok: false, mensaje: 'La cuenta destino no existe' });
    }

    // Evitar agregar la propia cuenta como beneficiario
    const miCuenta = await db.collection('cuentas').findOne({ clienteId: new ObjectId(req.usuario.id) });
    if (miCuenta && miCuenta.numeroCuenta === numeroCuentaDestino) {
      return res.status(400).json({ ok: false, mensaje: 'No puedes agregarte a ti mismo como beneficiario' });
    }

    // Evitar duplicados
    const yaExiste = await db.collection('beneficiarios').findOne({
      clienteId: new ObjectId(req.usuario.id),
      numeroCuentaDestino,
    });
    if (yaExiste) {
      return res.status(409).json({ ok: false, mensaje: 'Este beneficiario ya está registrado' });
    }

    const result = await db.collection('beneficiarios').insertOne({
      clienteId: new ObjectId(req.usuario.id),
      numeroCuentaDestino,
      alias: alias.trim(),
      fechaRegistro: new Date(),
    });

    await registrarAuditoria({
      usuarioId: req.usuario.id,
      accion: 'alta_beneficiario',
      estado: 'exitoso',
      detalle: { numeroCuentaDestino, alias: alias.trim() },
    });

    res.status(201).json({ ok: true, mensaje: 'Beneficiario agregado correctamente', id: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── Eliminar beneficiario ────────────────────────────────────────────────────
async function eliminarBeneficiario(req, res) {
  const { id } = req.params;

  try {
    const db = getDB();

    const resultado = await db.collection('beneficiarios').deleteOne({
      _id: new ObjectId(id),
      clienteId: new ObjectId(req.usuario.id), // solo puede borrar los suyos
    });

    if (resultado.deletedCount === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Beneficiario no encontrado' });
    }

    res.json({ ok: true, mensaje: 'Beneficiario eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { obtenerBeneficiarios, agregarBeneficiario, eliminarBeneficiario };
