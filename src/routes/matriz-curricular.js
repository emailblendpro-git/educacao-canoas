const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// Buscar matriz curricular da escola
router.get('/escolas/:id/matriz-curricular', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);
  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    // Buscar matriz de projetos (customizada por escola)
    const matrizRes = await pool.query(
      `SELECT
         mpe.ano_escolar,
         mpe.disciplina_id,
         d.nome as disciplina_nome,
         d.sigla,
         mpe.periodos_semana
       FROM matriz_projetos_escola mpe
       JOIN disciplinas d ON d.id = mpe.disciplina_id
       WHERE mpe.escola_id = $1
       ORDER BY mpe.ano_escolar, d.nome`,
      [escolaId]
    );

    // Agrupar por ano escolar
    const matrizPorAno = {};
    matrizRes.rows.forEach(row => {
      if (!matrizPorAno[row.ano_escolar]) {
        matrizPorAno[row.ano_escolar] = [];
      }
      matrizPorAno[row.ano_escolar].push({
        disciplina_id: row.disciplina_id,
        disciplina_nome: row.disciplina_nome,
        sigla: row.sigla,
        periodos_semana: row.periodos_semana
      });
    });

    res.json({
      matrizPorAno
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar matriz curricular' });
  }
});

// Atualizar períodos de uma disciplina na matriz
router.patch('/escolas/:id/matriz-curricular/:anoEscolar/:disciplinaId', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);
  const anoEscolar = req.params.anoEscolar;
  const disciplinaId = Number(req.params.disciplinaId);
  const { periodos_semana } = req.body;

  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    await pool.query(
      `UPDATE matriz_projetos_escola
       SET periodos_semana = $1, atualizado_em = NOW()
       WHERE escola_id = $2 AND ano_escolar = $3 AND disciplina_id = $4`,
      [periodos_semana, escolaId, anoEscolar, disciplinaId]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar matriz curricular' });
  }
});

module.exports = router;
