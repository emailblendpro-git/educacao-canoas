require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/db');

async function setupAdmin() {
  const client = await pool.connect();
  try {
    console.log('Criando/atualizando usuário admin...');

    const senhaHash = await bcrypt.hash('trocar123', 10);

    // Tenta atualizar primeiro
    const updateRes = await client.query(
      `UPDATE usuarios
       SET senha_hash = $1, ativo = true
       WHERE login = 'admin'
       RETURNING id, login, nome, perfil`
    , [senhaHash]);

    if (updateRes.rowCount > 0) {
      console.log('✅ Usuário admin atualizado');
      console.log('   Login: admin');
      console.log('   Senha: admin');
      return;
    }

    // Se não existe, insere
    const insertRes = await client.query(
      `INSERT INTO usuarios (login, senha_hash, nome, perfil, ativo)
       VALUES ('admin', $1, 'Administrador', 'admin', true)
       RETURNING id, login, nome, perfil`
    , [senhaHash]);

    console.log('✅ Usuário admin criado');
    console.log('   Login: admin');
    console.log('   Senha: admin');
    console.log('   Perfil:', insertRes.rows[0].perfil);

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupAdmin();
