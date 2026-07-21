const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS, apenasEscrita } = require('../middleware/auth');

const router = express.Router();

// atribui, troca ou remove o professor responsável por uma disciplina numa
// turma -- usado quando a diretora clica num chip da grade de aulas no Painel.
router.patch('/turmas/:turmaId/alocacoes', autenticar, apenasEscrita, async (req, res) => {
  const turmaId = Number(req.params.turmaId);
  const { disciplina_sigla, professor_id } = req.body || {};
  if (!disciplina_sigla) {
    return res.status(400).json({ erro: 'Informe disciplina_sigla' });
  }

  try {
    const turmaRes = await pool.query('SELECT escola_id, ano_escolar FROM turmas WHERE id = $1', [turmaId]);
    const turma = turmaRes.rows[0];
    if (!turma) {
      return res.status(404).json({ erro: 'Turma não encontrada' });
    }
    if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && turma.escola_id !== req.usuario.escolaId) {
      return res.status(403).json({ erro: 'Essa turma não é da sua escola' });
    }

    const discRes = await pool.query('SELECT id FROM disciplinas WHERE sigla = $1', [disciplina_sigla]);
    const disciplinaId = discRes.rows[0] && discRes.rows[0].id;
    if (!disciplinaId) {
      return res.status(404).json({ erro: `Disciplina "${disciplina_sigla}" não encontrada` });
    }

    // sem professor -> remove a alocação (deixa a disciplina como vaga)
    if (!professor_id) {
      await pool.query(
        'DELETE FROM alocacoes WHERE turma_id = $1 AND disciplina_id = $2',
        [turmaId, disciplinaId]
      );
      return res.json({ ok: true, removido: true });
    }

    const profRes = await pool.query('SELECT id FROM professores WHERE id = $1', [professor_id]);
    if (!profRes.rows.length) {
      return res.status(404).json({ erro: 'Professor não encontrado' });
    }

    const periodosRes = await pool.query(
      `SELECT periodos_semana FROM matriz_curricular_global WHERE ano_escolar = $1 AND disciplina_id = $2
       UNION ALL
       SELECT periodos_semana FROM matriz_projetos_escola WHERE escola_id = $3 AND ano_escolar = $1 AND disciplina_id = $2
       LIMIT 1`,
      [turma.ano_escolar, disciplinaId, turma.escola_id]
    );
    const periodos = periodosRes.rows[0] && periodosRes.rows[0].periodos_semana;
    if (!periodos) {
      return res.status(422).json({ erro: 'Não há referência de períodos/semana pra essa disciplina nessa turma' });
    }

    await pool.query(
      `INSERT INTO alocacoes (professor_id, turma_id, disciplina_id, periodos, tipo, ano_letivo)
       VALUES ($1,$2,$3,$4,'regular',2026)
       ON CONFLICT (turma_id, disciplina_id, ano_letivo)
       DO UPDATE SET professor_id = EXCLUDED.professor_id, periodos = EXCLUDED.periodos, atualizado_em = now()`,
      [professor_id, turmaId, disciplinaId, periodos]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar a alocação' });
  }
});

module.exports = router;
