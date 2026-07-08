#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function comparar() {
  try {
    console.log('🏫 COMPARAÇÃO DE CONFIGURAÇÕES ENTRE ESCOLAS\n');

    // Buscar todas as escolas
    const escolasRes = await pool.query(`SELECT id, nome FROM escolas ORDER BY nome`);
    const escolas = escolasRes.rows;

    console.log('📊 RESUMO POR ESCOLA:\n');

    for (const escola of escolas) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 ${escola.nome}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Turmas
      const turmasRes = await pool.query(
        `SELECT COUNT(*) as total, COUNT(DISTINCT turno) as turnos,
                STRING_AGG(DISTINCT turno, ', ') as lista_turnos
         FROM turmas WHERE escola_id = $1 AND ativo = true`,
        [escola.id]
      );
      const turmas = turmasRes.rows[0];

      // Professores
      const profRes = await pool.query(
        `SELECT COUNT(DISTINCT professor_id) as total FROM lotacoes WHERE escola_id = $1`,
        [escola.id]
      );

      // Vagas
      const vagasRes = await pool.query(
        `SELECT COUNT(*) as total FROM turmas t
         WHERE t.escola_id = $1 AND NOT EXISTS (
           SELECT 1 FROM alocacoes a WHERE a.turma_id = t.id
         )`,
        [escola.id]
      );

      // Pendências
      const pendRes = await pool.query(
        `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'aberta' THEN 1 END) as abertas
         FROM pendencias WHERE escola_id = $1`,
        [escola.id]
      );

      console.log(`\n✓ Turmas: ${turmas.total}`);
      console.log(`  Turnos: ${turmas.lista_turnos}`);

      console.log(`\n✓ Professores: ${profRes.rows[0].total}`);

      console.log(`\n⚠️  Vagas (sem professor): ${vagasRes.rows[0].total}`);

      console.log(`\n⚠️  Pendências: ${pendRes.rows[0].total} (${pendRes.rows[0].abertas} abertas)`);

      // Matriz curricular
      const matrizRes = await pool.query(
        `SELECT COUNT(*) as total FROM matriz_projetos_escola WHERE escola_id = $1`,
        [escola.id]
      );
      console.log(`\n✓ Registros em Matriz de Projetos: ${matrizRes.rows[0].total}`);

      // Disciplinas por escola
      const discRes = await pool.query(
        `SELECT COUNT(DISTINCT disciplina_id) as total FROM matriz_projetos_escola WHERE escola_id = $1`,
        [escola.id]
      );
      console.log(`✓ Disciplinas configuradas: ${discRes.rows[0].total}`);

      // Carga horária média
      const cargaRes = await pool.query(
        `SELECT
          AVG(l.carga_horaria)::int as media_ch,
          MIN(l.carga_horaria) as min_ch,
          MAX(l.carga_horaria) as max_ch
         FROM lotacoes l WHERE l.escola_id = $1`,
        [escola.id]
      );
      const carga = cargaRes.rows[0];
      console.log(`\n✓ Carga Horária (média/mín/máx): ${carga.media_ch}h / ${carga.min_ch}h / ${carga.max_ch}h`);

      // Problemas
      console.log(`\n🔴 POSSÍVEIS PROBLEMAS:`);

      // Turmas sem professor
      const semaProf = await pool.query(
        `SELECT COUNT(*) as total FROM turmas t
         WHERE t.escola_id = $1 AND NOT EXISTS (SELECT 1 FROM alocacoes a WHERE a.turma_id = t.id)`,
        [escola.id]
      );

      if (semaProf.rows[0].total > 0) {
        console.log(`   ⚠️  ${semaProf.rows[0].total} turma(s) SEM PROFESSOR`);
      }

      // Disciplinas de turmas sem alocação
      const discSemAloc = await pool.query(
        `SELECT COUNT(DISTINCT
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM alocacoes a
            WHERE a.turma_id = t.id AND a.disciplina_id = m.disciplina_id
          ) THEN 1 END
        ) as total
         FROM turmas t
         JOIN matriz_projetos_escola m ON m.escola_id = t.escola_id AND m.ano_escolar = t.ano_escolar
         WHERE t.escola_id = $1`,
        [escola.id]
      );

      if (discSemAloc.rows[0].total > 0) {
        console.log(`   ⚠️  ${discSemAloc.rows[0].total} disciplina(s) SEM ALOCAÇÃO em turmas`);
      }

      // Professores sem cargo
      const semCargo = await pool.query(
        `SELECT COUNT(*) as total FROM lotacoes l
         JOIN professores p ON p.id = l.professor_id
         WHERE l.escola_id = $1 AND p.cargo_funcao_id IS NULL`,
        [escola.id]
      );

      if (semCargo.rows[0].total > 0) {
        console.log(`   ⚠️  ${semCargo.rows[0].total} professor(es) SEM CARGO definido`);
      }

      // Discrepâncias de turnos
      const turnoRes = await pool.query(
        `SELECT turno, COUNT(*) as qtd FROM turmas WHERE escola_id = $1 AND ativo = true GROUP BY turno ORDER BY turno`,
        [escola.id]
      );

      console.log(`\n📊 Distribuição por Turno:`);
      turnoRes.rows.forEach(t => {
        console.log(`   • ${t.turno}: ${t.qtd} turmas`);
      });
    }

    // COMPARAÇÃO ENTRE ESCOLAS
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📈 COMPARAÇÃO CONSOLIDADA`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const compRes = await pool.query(`
      SELECT
        e.nome,
        COUNT(DISTINCT t.id) as turmas,
        COUNT(DISTINCT l.professor_id) as professores,
        COUNT(DISTINCT CASE WHEN NOT EXISTS (SELECT 1 FROM alocacoes a WHERE a.turma_id = t.id) THEN t.id END) as vagas_abertas,
        COUNT(DISTINCT p.id) as pendencias
      FROM escolas e
      LEFT JOIN turmas t ON t.escola_id = e.id
      LEFT JOIN lotacoes l ON l.escola_id = e.id
      LEFT JOIN pendencias p ON p.escola_id = e.id
      GROUP BY e.id, e.nome
      ORDER BY e.nome
    `);

    console.log('\n┌─ Escola ─────────────┬─ Turmas ─┬─ Profs ─┬─ Vagas ─┬─ Pendências ─┐');
    compRes.rows.forEach(row => {
      const nome = row.nome.padEnd(20);
      const turmas = String(row.turmas).padStart(8);
      const profs = String(row.professores).padStart(7);
      const vagas = String(row.vagas_abertas || 0).padStart(7);
      const pend = String(row.pendencias || 0).padStart(12);
      console.log(`│ ${nome} │${turmas} │${profs} │${vagas} │${pend} │`);
    });
    console.log('└──────────────────────┴─────────┴────────┴────────┴──────────────┘');

    console.log('\n✅ Comparação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

comparar();
