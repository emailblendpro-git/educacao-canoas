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

// perfis com visão de todas as escolas (escopo); diretor fica preso à própria
// escola. "visualizacao" também é global, mas sem permissão de escrita --
// ver `apenasEscrita` e `PERFIS_GESTAO` abaixo.
const PERFIS_GLOBAIS = new Set(['admin', 'secretaria_central', 'visualizacao']);

// perfis com permissão de gerenciar usuários (criar, resetar senha, ver a
// lista de acessos) -- mais restrito que PERFIS_GLOBAIS, que agora inclui
// "visualizacao" (só enxerga todas as escolas, não administra usuários).
const PERFIS_GESTAO = new Set(['admin', 'secretaria_central']);

// bloqueia qualquer rota de escrita para o perfil "visualizacao" (somente
// consulta, em qualquer escola).
function apenasEscrita(req, res, next) {
  if (req.usuario.perfil === 'visualizacao') {
    return res.status(403).json({ erro: 'Perfil de consulta não pode editar dados' });
  }
  next();
}

module.exports = { autenticar, PERFIS_GLOBAIS, PERFIS_GESTAO, apenasEscrita };
