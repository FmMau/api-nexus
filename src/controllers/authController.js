const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDB, client } = require('../config/db');
const registrarAuditoria = require('../utils/auditoria');

const SALT_ROUNDS = 10;

// ─── Algoritmo de número de cuenta  ───────────────────────
function generarNumeroCuenta(idSecuencial) {
  const base = `180${String(idSecuencial).padStart(6, '0')}`;
  const suma = base.split('').reduce((acc, d) => acc + Number(d), 0);
  const digitoVerificador = suma % 10;
  return `${base}${digitoVerificador}`;
}

// ─── Registro ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { nombre, correo, contraseña, curp, telefono } = req.body || {};

  if (!nombre || !correo || !contraseña) {
    return res.status(400).json({ ok: false, mensaje: 'nombre, correo y contraseña son requeridos' });
  }

  const session = client.startSession();

  try {
    let clienteId;
    let numeroCuenta;

    await session.withTransaction(async () => {
      const db = getDB();

      // Verificar correo duplicado
      const existe = await db.collection('clientes').findOne({ correo }, { session });
      if (existe) {
        throw Object.assign(new Error('El correo ya está registrado'), { statusCode: 409 });
      }

      // Determinar ID secuencial basado en el total de cuentas existentes
      const totalCuentas = await db.collection('cuentas').countDocuments({}, { session });
      const idSecuencial = totalCuentas + 1;
      numeroCuenta = generarNumeroCuenta(idSecuencial);

      const contraseñaHash = await bcrypt.hash(contraseña, SALT_ROUNDS);

      const resultCliente = await db.collection('clientes').insertOne(
        {
          nombre,
          correo,
          contraseña: contraseñaHash,
          curp: curp || null,
          telefono: telefono || null,
          fechaRegistro: new Date(),
        },
        { session }
      );

      clienteId = resultCliente.insertedId;

      await db.collection('cuentas').insertOne(
        {
          clienteId,
          numeroCuenta,
          saldo: 0,
          estado: 'activa',
          fechaApertura: new Date(),
        },
        { session }
      );
    });

    await registrarAuditoria({
      usuarioId: clienteId,
      accion: 'alta_cuenta',
      estado: 'exitoso',
      detalle: { numeroCuenta },
    });

    res.status(201).json({ ok: true, mensaje: 'Cliente registrado correctamente', numeroCuenta });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ ok: false, mensaje: error.message });
  } finally {
    await session.endSession();
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { correo, contraseña } = req.body || {};

  try {
    const db = getDB();

    const usuario = await db.collection('clientes').findOne({ correo });

    if (!usuario) {
      await registrarAuditoria({
        usuarioId: null,
        accion: 'login_fallido',
        estado: 'fallido',
        detalle: { correo, motivo: 'usuario_no_encontrado' },
      });
      // Mensaje genérico para no revelar si el correo existe
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const passwordCorrecta = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!passwordCorrecta) {
      await registrarAuditoria({
        usuarioId: usuario._id,
        accion: 'login_fallido',
        estado: 'fallido',
        detalle: { correo, motivo: 'contraseña_incorrecta' },
      });
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario._id, correo: usuario.correo },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await registrarAuditoria({
      usuarioId: usuario._id,
      accion: 'login_exitoso',
      estado: 'exitoso',
      detalle: { correo },
    });

    res.json({ ok: true, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

module.exports = { login, register };
