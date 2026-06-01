const express = require('express');
const { transferir } = require('../controllers/transferenciaController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, transferir);

module.exports = router;
