const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// busca professores lotados numa escola -- alimenta o campo de busca da tela
// de resolução de pendências (escolher quem vai dar aquela aula).
router.get('/professores', autenticar, async (req, res) => {
  try {
    let escolaId = req.query.escola_id ? Number(req.query.escola_id) : null;
    if (!PERFIS_GLOBAIS.has(req.usuario.perfil)) {
      escolaId = req.usuario.escolaId;
    }
    if (!escolaId) {
      return res.status(400).json({ erro: 'Informe escola_id' });
    }

    const busca = (req.query.busca || '').trim();
    const params = [escolaId];
    let filtroBusca = '';
    if (busca) {
      params.push(`%${busca}%`);
      filtroBusca = `AND p.nome ILIKE $${params.length}`;
    }

    const result = await pool.query(
      `SELECT DISTINCT p.id, p.nome, p.matricula, p.area_concurso, cf.nome as cargo
       FROM professores p
       JOIN lotacoes l ON l.professor_id = p.id
       LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
       WHERE l.escola_id = $1 ${filtroBusca}
       ORDER BY p.nome
       LIMIT 20`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar professores' });
  }
});

// lista onde um professor está atuando (turma/turno/disciplina/períodos),
// escopado pela escola -- alimenta o "clicar no professor" do Painel.
router.get('/professores/:id/alocacoes', autenticar, async (req, res) => {
  try {
    let escolaId = req.query.escola_id ? Number(req.query.escola_id) : null;
    if (!PERFIS_GLOBAIS.has(req.usuario.perfil)) {
      escolaId = req.usuario.escolaId;
    }
    if (!escolaId) {
      return res.status(400).json({ erro: 'Informe escola_id' });
    }

    const result = await pool.query(
      `SELECT t.ano_escolar, t.turno, t.identificador, d.sigla, d.nome AS disciplina, a.periodos
       FROM alocacoes a
       JOIN turmas t ON t.id = a.turma_id
       JOIN disciplinas d ON d.id = a.disciplina_id
       WHERE a.professor_id = $1 AND t.escola_id = $2
       ORDER BY t.turno, t.ano_escolar, t.identificador, d.sigla`,
      [req.params.id, escolaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar alocações do professor' });
  }
});

module.exports = router;
