const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) {
    return res.status(400).json({ erro: 'Informe login e senha' });
  }

  try {
    console.log('[AUTH] Tentando login com:', login);
    const result = await pool.query(
      'SELECT id, nome, senha_hash, perfil, escola_id, ativo FROM usuarios WHERE login = $1',
      [login]
    );
    console.log('[AUTH] Usuário encontrado:', result.rows.length > 0);
    const usuario = result.rows[0];
    if (!usuario || !usuario.ativo) {
      console.log('[AUTH] Usuário não encontrado ou inativo');
      return res.status(401).json({ erro: 'Login ou senha inválidos' });
    }

    console.log('[AUTH] Comparando senhas...');
    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    console.log('[AUTH] Senha correta?', senhaOk);
    if (!senhaOk) {
      return res.status(401).json({ erro: 'Login ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil, escolaId: usuario.escola_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil, escolaId: usuario.escola_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao autenticar' });
  }
});

module.exports = router;
