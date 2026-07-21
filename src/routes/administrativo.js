const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS, PERFIS_GESTAO } = require('../middleware/auth');

const router = express.Router();

// Função para gerar senha aleatória
function gerarSenhaAleatoria(tamanho = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

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

  // Apenas admin/secretaria central podem ver acessos; diretor vê apenas sua escola
  if (!PERFIS_GESTAO.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
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

// Resetar senha de um usuário
router.patch('/usuarios/:id/resetar-senha', autenticar, async (req, res) => {
  // Apenas admin/secretaria central podem resetar senha
  if (!PERFIS_GESTAO.has(req.usuario.perfil)) {
    return res.status(403).json({ erro: 'Apenas administrador pode resetar senhas' });
  }

  const usuarioId = Number(req.params.id);

  try {
    // Gerar nova senha
    const novaSenha = gerarSenhaAleatoria();
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar no banco
    const result = await pool.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2 RETURNING id, nome, login',
      [senhaHash, usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({
      usuario: result.rows[0],
      senha_temporaria: novaSenha,
      mensagem: 'Senha resetada com sucesso. Compartilhe a senha temporária com o usuário.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao resetar senha' });
  }
});

const PERFIS_VALIDOS = new Set(['admin', 'secretaria_central', 'diretor', 'visualizacao']);

// Criar novo usuário de acesso
router.post('/usuarios', autenticar, async (req, res) => {
  if (!PERFIS_GESTAO.has(req.usuario.perfil)) {
    return res.status(403).json({ erro: 'Apenas administrador ou secretaria central podem criar usuários' });
  }

  const { nome, login, perfil } = req.body || {};
  if (!nome || !login || !perfil) {
    return res.status(400).json({ erro: 'nome, login e perfil são obrigatórios' });
  }
  if (!PERFIS_VALIDOS.has(perfil)) {
    return res.status(400).json({ erro: `Perfil inválido. Use um de: ${[...PERFIS_VALIDOS].join(', ')}` });
  }

  // só "diretor" é escopado a uma escola -- os demais perfis (admin,
  // secretaria_central, visualizacao) enxergam a rede inteira.
  let escolaId = null;
  if (perfil === 'diretor') {
    escolaId = Number(req.body.escola_id) || null;
    if (!escolaId) {
      return res.status(400).json({ erro: 'escola_id é obrigatório para o perfil diretor' });
    }
  }

  try {
    const existente = await pool.query('SELECT id FROM usuarios WHERE login = $1', [login]);
    if (existente.rows.length) {
      return res.status(409).json({ erro: 'Login já está em uso' });
    }

    const senhaTemporaria = gerarSenhaAleatoria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nome, login, senha_hash, perfil, escola_id, ativo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, nome, login, perfil, escola_id`,
      [nome, login, senhaHash, perfil, escolaId]
    );

    res.status(201).json({
      usuario: result.rows[0],
      senha_temporaria: senhaTemporaria,
      mensagem: 'Usuário criado com sucesso. Compartilhe a senha temporária com o usuário.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

module.exports = router;
