const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// Categorias de profissionais
const CATEGORIAS = {
  gestores: ['Diretor', 'Vice-Diretor', 'Supervisor', 'Orientador'],
  administrativo: ['Secretaria', 'Readaptação / Auxiliar de secretaria'],
  pedagogicos: ['Sala de Recursos', 'Assessor Pedagógico', 'TEB Técnico Ensino Especial', 'Laboratório', 'Estagiário', 'Biblioteca', 'Readaptado / Auxiliar biblioteca'],
};

function categorizarProfissional(cargo) {
  if (!cargo) return 'outros';
  if (CATEGORIAS.gestores.some(c => cargo.includes(c))) return 'gestores';
  if (CATEGORIAS.administrativo.some(c => cargo.includes(c))) return 'administrativo';
  if (CATEGORIAS.pedagogicos.some(c => cargo.includes(c))) return 'pedagogicos';
  return 'outros';
}

router.get('/escolas/:id/gestao-escolar', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);
  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    const result = await pool.query(
      `SELECT
         e.nome as escola_nome,
         p.nome,
         p.matricula,
         cf.nome as cargo,
         l.carga_horaria,
         COUNT(DISTINCT a.id) as alocacoes
       FROM escolas e
       JOIN lotacoes l ON l.escola_id = e.id
       JOIN professores p ON p.id = l.professor_id
       LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
       LEFT JOIN alocacoes a ON a.professor_id = p.id
       WHERE e.id = $1 AND cf.nome IS NOT NULL
       GROUP BY e.id, e.nome, p.id, p.nome, p.matricula, cf.nome, l.carga_horaria
       ORDER BY
         CASE cf.nome
           WHEN 'Diretor' THEN 1
           WHEN 'Vice-Diretor' THEN 2
           WHEN 'Supervisor' THEN 3
           WHEN 'Orientador' THEN 4
           WHEN 'Secretaria' THEN 5
           WHEN 'Readaptação / Auxiliar de secretaria' THEN 6
           WHEN 'Sala de Recursos' THEN 7
           WHEN 'Assessor Pedagógico' THEN 8
           WHEN 'TEB Técnico Ensino Especial' THEN 9
           WHEN 'Laboratório' THEN 10
           WHEN 'Estagiário' THEN 11
           WHEN 'Biblioteca' THEN 12
           WHEN 'Readaptado / Auxiliar biblioteca' THEN 13
           ELSE 99
         END,
         p.nome`,
      [escolaId]
    );

    // Agrupar por categoria
    const profissionaisPorCategoria = {
      gestores: [],
      administrativo: [],
      pedagogicos: [],
      outros: []
    };

    result.rows.forEach(prof => {
      const categoria = categorizarProfissional(prof.cargo);
      profissionaisPorCategoria[categoria].push(prof);
    });

    res.json({
      escola_nome: result.rows[0]?.escola_nome || '',
      profissionais: profissionaisPorCategoria
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar dados de gestão escolar' });
  }
});

// Listar usuários/acessos por escola
router.get('/escolas/:id/acessos', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);

  // Apenas admin pode ver todos; diretor vê apenas sua escola
  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    const result = await req.usuario.perfil === 'admin'
      ? await pool.query(
          `SELECT u.id, u.nome, u.login, u.perfil, u.ativo, u.criado_em, e.nome as escola_nome
           FROM usuarios u
           LEFT JOIN escolas e ON e.id = u.escola_id
           WHERE u.escola_id = $1 OR (u.perfil = 'secretaria_central' AND $1::int IS NOT NULL)
           ORDER BY u.perfil, u.nome`,
          [escolaId]
        )
      : await pool.query(
          `SELECT u.id, u.nome, u.login, u.perfil, u.ativo, u.criado_em, e.nome as escola_nome
           FROM usuarios u
           LEFT JOIN escolas e ON e.id = u.escola_id
           WHERE u.escola_id = $1
           ORDER BY u.perfil, u.nome`,
          [escolaId]
        );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar acessos' });
  }
});

module.exports = router;
