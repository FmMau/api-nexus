const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

async function registrarAuditoria({ usuarioId, accion, estado, detalle }) {
  try {
    const db = getDB();

    await db.collection('auditoria').insertOne({
      fechaHora: new Date(),
      usuarioId: usuarioId ? new ObjectId(usuarioId) : null,
      accion,
      estado,
      detalle,
    });
  } catch (err) {
    console.error('Error al registrar auditoría:', err);
  }
}

module.exports = registrarAuditoria;
