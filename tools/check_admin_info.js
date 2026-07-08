#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('🔍 Verificando informações administrativas\n');

    // Verificar cargos_funcoes
    console.log('📋 Cargos/Funções cadastrados:');
    const cargosRes = await pool.query(`SELECT id, nome FROM cargos_funcoes ORDER BY nome`);
    cargosRes.rows.forEach(c => {
      console.log(`   • ${c.nome}`);
    });

    console.log('\n');

    // Verificar usuários
    console.log('👤 Usuários cadastrados:');
    const usersRes = await pool.query(`
      SELECT id, nome, login, perfil, escola_id FROM usuarios ORDER BY nome
    `);
    usersRes.rows.forEach(u => {
      const escola = u.escola_id ? `(Escola ${u.escola_id})` : '(Global)';
      console.log(`   • ${u.nome} - ${u.perfil} ${escola}`);
    });

    console.log('\n');

    // Verificar professores com cargo administrativo
    console.log('👨‍💼 Professores/Administrativos:');
    const profRes = await pool.query(`
      SELECT p.nome, p.matricula, cf.nome as cargo, e.nome as escola
      FROM professores p
      LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
      LEFT JOIN lotacoes l ON l.professor_id = p.id
      LEFT JOIN escolas e ON e.id = l.escola_id
      WHERE cf.nome IS NOT NULL OR p.cargo_funcao_id IS NOT NULL
      ORDER BY e.nome, p.nome
    `);

    if (profRes.rows.length === 0) {
      console.log('   (Nenhum professor com cargo administrativo cadastrado)');
    } else {
      profRes.rows.forEach(p => {
        console.log(`   • ${p.nome} - ${p.cargo} (${p.escola || 'N/A'})`);
      });
    }

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

check();
