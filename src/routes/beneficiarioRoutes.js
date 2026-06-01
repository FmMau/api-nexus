const express = require('express');
const {
  obtenerBeneficiarios,
  agregarBeneficiario,
  eliminarBeneficiario,
} = require('../controllers/beneficiarioController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', obtenerBeneficiarios);
router.post('/', agregarBeneficiario);
router.delete('/:id', eliminarBeneficiario);

module.exports = router;
