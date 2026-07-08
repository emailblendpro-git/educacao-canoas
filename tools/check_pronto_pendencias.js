#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('🔍 Procurando "Pronto-socorro" em pendências e dados...\n');

    // Verificar pendências
    const pendResults = await pool.query(
      `SELECT id, tipo, chave_natural, dados FROM pendencias WHERE dados::text ILIKE '%pronto%' LIMIT 5`
    );

    console.log('📋 Pendências com "Pronto":');
    if (pendResults.rows.length === 0) {
      console.log('   ✓ Nenhuma pendência encontrada\n');
    } else {
      pendResults.rows.forEach(p => {
        console.log(`   • Tipo: ${p.tipo}`);
        console.log(`     Dados: ${JSON.stringify(p.dados, null, 2)}`);
      });
    }

    // Verificar alocações
    const alocResults = await pool.query(
      `SELECT a.*, d.nome as disciplina FROM alocacoes a
       LEFT JOIN disciplinas d ON d.id = a.disciplina_id
       WHERE a.disciplina_id NOT IN (SELECT id FROM disciplinas)
       LIMIT 10`
    );

    console.log('\n⚠️  Alocações com disciplina_id inválido:');
    console.log(`   Encontradas ${alocResults.rows.length} alocações`);
    alocResults.rows.slice(0, 3).forEach(a => {
      console.log(`   • ID: ${a.id}, Professor: ${a.professor_id}, Turma: ${a.turma_id}, Disciplina ID: ${a.disciplina_id}`);
    });

    // Verificar turmas
    const turmasResults = await pool.query(
      `SELECT DISTINCT identificador, ano_escolar FROM turmas
       WHERE identificador ILIKE '%5%' OR identificador ILIKE '%5A%' OR identificador ILIKE '%5B%' OR identificador ILIKE '%5C%'
       ORDER BY identificador`
    );

    console.log('\n📚 Turmas de 5º ano:');
    turmasResults.rows.forEach(t => {
      console.log(`   • ${t.ano_escolar}${t.identificador}`);
    });

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

check();
