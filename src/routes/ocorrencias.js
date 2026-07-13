const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// Criar observação para professor
router.post('/professores/:id/observacoes', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const { data, texto, escolaId } = req.body;

  if (!escolaId || !data || !texto) {
    return res.status(400).json({ erro: 'data, texto e escolaId são obrigatórios' });
  }

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO observacoes_professores (professor_id, escola_id, data, texto, status, criado_por)
       VALUES ($1, $2, $3, $4, 'aberta', $5)
       RETURNING id, professor_id, data, texto, status, criado_em`,
      [professorId, escolaId, data, texto, req.usuario.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar observação' });
  }
});

// Listar observações de um professor (abertas e encerradas)
router.get('/professores/:id/observacoes', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const { escolaId } = req.query;

  if (!escolaId) {
    return res.status(400).json({ erro: 'escolaId é obrigatório' });
  }

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `SELECT
         id, professor_id, data, texto, status, criado_em, encerrado_em,
         (SELECT nome FROM usuarios WHERE id = criado_por) as criado_por_nome
       FROM observacoes_professores
       WHERE professor_id = $1 AND escola_id = $2
       ORDER BY data DESC, criado_em DESC`,
      [professorId, escolaId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar observações' });
  }
});

// Contar observações abertas de um professor
router.get('/professores/:id/observacoes/contar/abertas', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const { escolaId } = req.query;

  if (!escolaId) {
    return res.status(400).json({ erro: 'escolaId é obrigatório' });
  }

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total
       FROM observacoes_professores
       WHERE professor_id = $1 AND escola_id = $2 AND status = 'aberta'`,
      [professorId, escolaId]
    );

    res.json({ abertas: parseInt(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao contar observações' });
  }
});

// Encerrar observação (muda status para 'encerrada')
router.patch('/professores/:id/observacoes/:obsId/encerrar', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const obsId = Number(req.params.obsId);
  const { escolaId } = req.query;

  if (!escolaId) {
    return res.status(400).json({ erro: 'escolaId é obrigatório' });
  }

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `UPDATE observacoes_professores
       SET status = 'encerrada', encerrado_em = NOW(), atualizado_em = NOW()
       WHERE id = $1 AND professor_id = $2 AND escola_id = $3
       RETURNING id, professor_id, data, texto, status, criado_em, encerrado_em`,
      [obsId, professorId, escolaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Observação não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao encerrar observação' });
  }
});

// Deletar observação (apenas se for do mesmo diretor/secretário)
router.delete('/professores/:id/observacoes/:obsId', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const obsId = Number(req.params.obsId);
  const { escolaId } = req.query;

  if (!escolaId) {
    return res.status(400).json({ erro: 'escolaId é obrigatório' });
  }

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    await pool.query(
      `DELETE FROM observacoes_professores
       WHERE id = $1 AND professor_id = $2 AND escola_id = $3`,
      [obsId, professorId, escolaId]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar observação' });
  }
});

module.exports = router;
