function validarCuenta(cuenta) {
  return /^\d{10}$/.test(cuenta);
}

function validarMonto(monto) {
  const n = Number(monto);
  return !isNaN(n) && n > 0 && isFinite(n);
}

module.exports = { validarCuenta, validarMonto };
