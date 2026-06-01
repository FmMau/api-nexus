const { getDB, client } = require('../config/db');
const registrarAuditoria = require('../utils/auditoria');
const { validarCuenta, validarMonto } = require('../utils/validators');
const { ObjectId } = require('mongodb');

async function transferir(req, res) {
  const { cuentaOrigen, cuentaDestino, monto, concepto } = req.body || {};
  const session = client.startSession();

  try {
    if (!validarCuenta(cuentaDestino)) {
      return res.status(400).json({ ok: false, mensaje: 'Cuenta destino inválida' });
    }

    if (!validarCuenta(cuentaOrigen)) {
      return res.status(400).json({ ok: false, mensaje: 'Cuenta origen inválida' });
    }

    if (!validarMonto(monto)) {
      return res.status(400).json({ ok: false, mensaje: 'Monto inválido' });
    }

    if (cuentaOrigen === cuentaDestino) {
      return res.status(400).json({ ok: false, mensaje: 'Las cuentas origen y destino no pueden ser iguales' });
    }

    const montoNum = Number(monto);
    const db = getDB();

    await session.withTransaction(async () => {
      const cuentas = db.collection('cuentas');

      const origen = await cuentas.findOne({ numeroCuenta: cuentaOrigen }, { session });
      const destino = await cuentas.findOne({ numeroCuenta: cuentaDestino }, { session });

      if (!origen || !destino) {
        throw new Error('Cuenta no encontrada');
      }

      // Verificar que la cuenta origen pertenece al usuario autenticado
      if (origen.clienteId.toString() !== req.usuario.id.toString()) {
        throw Object.assign(new Error('No autorizado para operar con esta cuenta'), { statusCode: 403 });
      }

      if (origen.saldo < montoNum) {
        // Auditoría de rechazo por saldo insuficiente (dentro de la transacción)
        await db.collection('auditoria').insertOne(
          {
            fechaHora: new Date(),
            usuarioId: new ObjectId(req.usuario.id),
            accion: 'transferencia_rechazada',
            estado: 'fallido',
            detalle: { cuentaOrigen, cuentaDestino, monto: montoNum, motivo: 'saldo_insuficiente' },
          },
          { session }
        );
        throw new Error('Saldo insuficiente');
      }

      await cuentas.updateOne(
        { numeroCuenta: cuentaOrigen },
        { $inc: { saldo: -montoNum } },
        { session }
      );

      await cuentas.updateOne(
        { numeroCuenta: cuentaDestino },
        { $inc: { saldo: montoNum } },
        { session }
      );

      await db.collection('transferencias').insertOne(
        {
          cuentaOrigen,
          cuentaDestino,
          monto: montoNum,
          concepto: concepto || '',
          fechaHora: new Date(),
          estado: 'aprobada',
        },
        { session }
      );

      // Auditoría DENTRO de la transacción para garantizar consistencia
      await db.collection('auditoria').insertOne(
        {
          fechaHora: new Date(),
          usuarioId: new ObjectId(req.usuario.id),
          accion: 'transferencia_aprobada',
          estado: 'exitoso',
          detalle: { cuentaOrigen, cuentaDestino, monto: montoNum },
        },
        { session }
      );
    });

    res.json({ ok: true, mensaje: 'Transferencia realizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 400).json({ ok: false, mensaje: error.message });
  } finally {
    await session.endSession();
  }
}

module.exports = { transferir };
