const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ erro: 'Token não informado' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.id, perfil: payload.perfil, escolaId: payload.escolaId };
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// perfis com visão de todas as escolas (admin/secretaria central); os demais
// (diretor, visualizacao) ficam presos à própria escola.
const PERFIS_GLOBAIS = new Set(['admin', 'secretaria_central']);

module.exports = { autenticar, PERFIS_GLOBAIS };
