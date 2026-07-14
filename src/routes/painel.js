const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// 1/3 da carga contratual é hora-atividade (sem aula) -- o esperado em
// períodos de aula por semana é os 2/3 restantes.
const PERIODOS_ESPERADOS_POR_CH = { 10: 6, 20: 13, 40: 26 };

function statusCarga(ch, periodosAlocados, temCargoAdministrativo) {
  if (temCargoAdministrativo) return 'administrativo';
  const esperado = PERIODOS_ESPERADOS_POR_CH[ch];
  if (periodosAlocados > esperado) return 'excedida';
  if (periodosAlocados < esperado) return 'faltando';
  return 'correta';
}

router.get('/escolas/:id/painel', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);
  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    const resumoRes = await pool.query(
      `SELECT
         e.nome as escola_nome,
         (SELECT count(*) FROM turmas WHERE escola_id = $1 AND ativo) AS turmas,
         (SELECT count(DISTINCT professor_id) FROM lotacoes WHERE escola_id = $1) AS professores,
         (SELECT count(*) FROM pendencias WHERE escola_id = $1 AND status = 'aberta') AS pendencias_abertas,
         (SELECT count(*) FROM pendencias WHERE escola_id = $1 AND status = 'aberta' AND tipo = 'vaga') AS vagas_abertas
       FROM escolas e
       WHERE e.id = $1`,
      [escolaId]
    );

    const gradeRes = await pool.query(
      `WITH requeridos AS (
         SELECT t.id turma_id, t.ano_escolar, t.turno, t.identificador, d.sigla, m.periodos_semana obrigatorio
         FROM turmas t
         JOIN matriz_curricular_global m ON m.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = m.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar IN ('1','2','3','4','5')
         UNION ALL
         SELECT t.id, t.ano_escolar, t.turno, t.identificador, d.sigla, mp.periodos_semana
         FROM turmas t
         JOIN matriz_projetos_escola mp ON mp.escola_id = t.escola_id AND mp.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = mp.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar IN ('1','2','3','4','5')
         UNION ALL
         SELECT t.id, t.ano_escolar, t.turno, t.identificador, d.sigla, m.periodos_semana
         FROM turmas t
         JOIN matriz_curricular_global m ON m.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = m.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar NOT IN ('1','2','3','4','5')
       ),
       alocado AS (
         SELECT a.turma_id, d.sigla, SUM(a.periodos) periodos_alocados,
                array_agg(DISTINCT p.nome) professores, array_agg(DISTINCT p.id) professor_ids,
                MAX(CASE WHEN cf.id IS NOT NULL THEN 1 ELSE 0 END) tem_administrativo
         FROM alocacoes a
         JOIN disciplinas d ON d.id = a.disciplina_id
         JOIN professores p ON p.id = a.professor_id
         LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
         GROUP BY a.turma_id, d.sigla
       )
       SELECT r.turma_id, r.ano_escolar, r.turno, r.identificador, r.sigla, r.obrigatorio,
              COALESCE(al.periodos_alocados, 0) AS alocado, al.professores, al.professor_ids,
              COALESCE(al.tem_administrativo, 0) AS tem_administrativo
       FROM requeridos r
       LEFT JOIN alocado al ON al.turma_id = r.turma_id AND al.sigla = r.sigla
       ORDER BY r.turno, r.ano_escolar, r.identificador, r.sigla`,
      [escolaId]
    );

    const profRes = await pool.query(
      `SELECT p.id, p.nome, p.matricula, p.carga_horaria_contratual AS ch, cf.nome AS cargo, p.area_concurso,
              COALESCE((
                SELECT SUM(a.periodos) FROM alocacoes a
                JOIN turmas t ON t.id = a.turma_id
                WHERE a.professor_id = p.id AND t.escola_id = $1
              ), 0) AS periodos_alocados
       FROM professores p
       JOIN lotacoes l ON l.professor_id = p.id AND l.escola_id = $1
       LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
       GROUP BY p.id, cf.nome, p.area_concurso
       ORDER BY p.nome`,
      [escolaId]
    );

    const professores = profRes.rows.map((p) => {
      const ch = Number(p.ch);
      const periodosAlocados = Number(p.periodos_alocados);
      return {
        id: p.id,
        nome: p.nome,
        matricula: p.matricula,
        ch,
        cargo: p.cargo,
        area_concurso: p.area_concurso,
        periodos_esperados: PERIODOS_ESPERADOS_POR_CH[ch] ?? null,
        periodos_alocados: periodosAlocados,
        status: statusCarga(ch, periodosAlocados, !!p.cargo),
      };
    });

    res.json({
      resumo: resumoRes.rows[0],
      grade: gradeRes.rows,
      professores,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao montar o painel' });
  }
});

module.exports = router;
