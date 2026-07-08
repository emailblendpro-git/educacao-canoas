#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('🔍 Procurando "Pronto-socorro" no banco...\n');

    // 1. Verificar se existe a disciplina
    const discResults = await pool.query(
      `SELECT id, nome, sigla FROM disciplinas WHERE nome ILIKE '%pronto%' OR sigla ILIKE '%pronto%'`
    );

    console.log('📋 Disciplinas encontradas:');
    if (discResults.rows.length === 0) {
      console.log('   ✓ Nenhuma disciplina com "Pronto" encontrada\n');
    } else {
      discResults.rows.forEach(d => {
        console.log(`   ⚠️  ID: ${d.id}, Nome: ${d.nome}, Sigla: ${d.sigla}`);
      });
      console.log();

      // 2. Verificar matriz global
      console.log('📊 Na matriz curricular global:');
      const matrizGlobalResults = await pool.query(
        `SELECT m.*, d.nome FROM matriz_curricular_global m
         JOIN disciplinas d ON d.id = m.disciplina_id
         WHERE m.disciplina_id IN (${discResults.rows.map(r => r.id).join(',')})`
      );
      console.log(`   Encontrados ${matrizGlobalResults.rows.length} registros`);
      matrizGlobalResults.rows.forEach(r => {
        console.log(`   • Etapa: ${r.etapa}, Ano: ${r.ano_escolar}, Disciplina: ${r.nome}, Períodos: ${r.periodos_semana}`);
      });
      console.log();

      // 3. Verificar matriz de projetos
      console.log('📊 Na matriz de projetos da escola:');
      const matrizProjetoResults = await pool.query(
        `SELECT m.*, d.nome, e.nome as escola FROM matriz_projetos_escola m
         JOIN disciplinas d ON d.id = m.disciplina_id
         JOIN escolas e ON e.id = m.escola_id
         WHERE m.disciplina_id IN (${discResults.rows.map(r => r.id).join(',')})`
      );
      console.log(`   Encontrados ${matrizProjetoResults.rows.length} registros`);
      matrizProjetoResults.rows.forEach(r => {
        console.log(`   • Escola: ${r.escola}, Ano: ${r.ano_escolar}, Disciplina: ${r.nome}, Períodos: ${r.periodos_semana}`);
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
