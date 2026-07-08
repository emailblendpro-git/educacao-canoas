/**
 * Cria (ou reseta a senha de) um usuário de login.
 *
 * Uso:
 *   node tools/criar-usuario.js --nome "Maria Diretora" --login maria.pv --senha "trocar123" --perfil diretor --escola "EMEF Paulo VI"
 *   node tools/criar-usuario.js --nome "Admin" --login admin --senha "trocar123" --perfil admin
 *
 * --escola é obrigatório pra perfis diretor/visualizacao (escopa o login a uma
 * escola); admin/secretaria_central não precisam (enxergam todas).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { nome, login, senha, perfil } = args;
  if (!nome || !login || !senha || !perfil) {
    console.error('Uso: node tools/criar-usuario.js --nome "..." --login "..." --senha "..." --perfil (admin|secretaria_central|diretor|visualizacao) [--escola "nome da escola"]');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    let escolaId = null;
    if (args.escola) {
      const r = await pool.query('SELECT id FROM escolas WHERE lower(nome) = lower($1)', [args.escola]);
      if (!r.rows.length) {
        console.error(`Escola "${args.escola}" não encontrada no banco.`);
        process.exit(1);
      }
      escolaId = r.rows[0].id;
    } else if (perfil === 'diretor' || perfil === 'visualizacao') {
      console.error(`Perfil "${perfil}" precisa de --escola.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(senha, 10);

    const existente = await pool.query('SELECT id FROM usuarios WHERE login = $1', [login]);
    if (existente.rows.length) {
      await pool.query(
        'UPDATE usuarios SET nome=$1, senha_hash=$2, perfil=$3, escola_id=$4, ativo=true WHERE login=$5',
        [nome, hash, perfil, escolaId, login]
      );
      console.log(`Usuário "${login}" atualizado (id=${existente.rows[0].id}).`);
    } else {
      const res = await pool.query(
        'INSERT INTO usuarios (nome, login, senha_hash, perfil, escola_id, ativo) VALUES ($1,$2,$3,$4,$5,true) RETURNING id',
        [nome, login, hash, perfil, escolaId]
      );
      console.log(`Usuário "${login}" criado (id=${res.rows[0].id}).`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
