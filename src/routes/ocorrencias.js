const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// Criar ocorrência para professor
router.post('/professores/:id/ocorrencias', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const { titulo, descricao, tipo, escolaId } = req.body;

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ocorrencias_professores (professor_id, escola_id, titulo, descricao, tipo, data_ocorrencia, criado_por)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING id, professor_id, titulo, descricao, tipo, data_ocorrencia`,
      [professorId, escolaId, titulo, descricao, tipo || 'geral', req.usuario.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar ocorrência' });
  }
});

// Listar ocorrências de um professor
router.get('/professores/:id/ocorrencias', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const { escolaId } = req.query;

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    const result = await pool.query(
      `SELECT
         id, professor_id, titulo, descricao, tipo, data_ocorrencia,
         (SELECT nome FROM usuarios WHERE id = criado_por) as criado_por_nome
       FROM ocorrencias_professores
       WHERE professor_id = $1 AND escola_id = $2
       ORDER BY data_ocorrencia DESC`,
      [professorId, escolaId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar ocorrências' });
  }
});

// Deletar ocorrência
router.delete('/professores/:id/ocorrencias/:ocorrenciaId', autenticar, async (req, res) => {
  const professorId = Number(req.params.id);
  const ocorrenciaId = Number(req.params.ocorrenciaId);
  const { escolaId } = req.query;

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && Number(escolaId) !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Acesso não autorizado' });
  }

  try {
    await pool.query(
      `DELETE FROM ocorrencias_professores
       WHERE id = $1 AND professor_id = $2 AND escola_id = $3`,
      [ocorrenciaId, professorId, escolaId]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar ocorrência' });
  }
});

module.exports = router;
