const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Token requerido',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      ok: false,
      mensaje: 'Token inválido',
    });
  }
}

module.exports = authMiddleware;