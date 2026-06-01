const express = require('express');
const {
  obtenerCuenta,
  obtenerMovimientos,
  obtenerPerfil,
  actualizarPerfil,
} = require('../controllers/cuentaController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/saldo', obtenerCuenta);
router.get('/movimientos', obtenerMovimientos);
router.get('/perfil', obtenerPerfil);
router.put('/perfil', actualizarPerfil);

module.exports = router;
