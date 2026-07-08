#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const query = async (sql) => {
  const res = await pool.query(sql);
  return res.rows;
};

async function diagnostico() {
  try {
    console.log('🔍 Iniciando diagnóstico completo...\n');

    // 1. CONTAR REGISTROS
    console.log('1️⃣  CONTANDO REGISTROS...\n');
    const countResults = await query(`
      SELECT
        (SELECT COUNT(*) FROM professores) as total_professores,
        (SELECT COUNT(*) FROM turmas) as total_turmas,
        (SELECT COUNT(*) FROM alocacoes) as total_alocacoes,
        (SELECT COUNT(*) FROM lotacoes) as total_lotacoes,
        (SELECT COUNT(DISTINCT id) FROM escolas) as total_escolas;
    `);

    const counts = countResults[0];
    console.log(`   ✓ Total de Professores: ${counts.total_professores}`);
    console.log(`   ✓ Total de Turmas: ${counts.total_turmas}`);
    console.log(`   ✓ Total de Alocações: ${counts.total_alocacoes}`);
    console.log(`   ✓ Total de Lotações: ${counts.total_lotacoes}`);
    console.log(`   ✓ Total de Escolas: ${counts.total_escolas}\n`);

    // 2. VALIDAR INTEGRIDADE
    console.log('2️⃣  VALIDANDO INTEGRIDADE...\n');
    const integridadeResults = await query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IS NOT NULL AND status != '' THEN 1 ELSE 0 END) as com_status,
        SUM(CASE WHEN matricula IS NOT NULL AND matricula != '' THEN 1 ELSE 0 END) as com_matricula,
        SUM(CASE WHEN cargo_funcao_id IS NOT NULL THEN 1 ELSE 0 END) as com_cargo,
        SUM(CASE WHEN disciplina_principal_id IS NOT NULL THEN 1 ELSE 0 END) as com_disciplina
      FROM professores;
    `);

    const integridade = integridadeResults[0];
    const pctStatus = ((integridade.com_status / integridade.total) * 100).toFixed(1);
    const pctMatricula = ((integridade.com_matricula / integridade.total) * 100).toFixed(1);
    const pctCargo = ((integridade.com_cargo / integridade.total) * 100).toFixed(1);
    const pctDisciplina = ((integridade.com_disciplina / integridade.total) * 100).toFixed(1);

    console.log(`   ✓ Com STATUS: ${integridade.com_status}/${integridade.total} (${pctStatus}%)`);
    console.log(`   ✓ Com MATRÍCULA: ${integridade.com_matricula}/${integridade.total} (${pctMatricula}%)`);
    console.log(`   ✓ Com CARGO_FUNÇÃO: ${integridade.com_cargo}/${integridade.total} (${pctCargo}%)`);
    console.log(`   ✓ Com DISCIPLINA_PRINCIPAL: ${integridade.com_disciplina}/${integridade.total} (${pctDisciplina}%)\n`);

    // Distribuição de status
    const statusResults = await query(`
      SELECT status, COUNT(*) as quantidade
      FROM professores
      GROUP BY status
      ORDER BY quantidade DESC;
    `);

    console.log(`   📊 Distribuição de STATUS:`);
    statusResults.forEach(s => {
      console.log(`      • ${s.status}: ${s.quantidade}`);
    });
    console.log();

    // 3. VALIDAR ALOCAÇÕES - CONFLITOS E VAGAS
    console.log('3️⃣  VALIDANDO ALOCAÇÕES...\n');

    // Professores em 2+ turmas no mesmo turno
    const conflitosResults = await query(`
      SELECT
        p.id,
        p.nome,
        COUNT(DISTINCT a.turma_id) as turmas_no_turno,
        STRING_AGG(DISTINCT t.identificador, ', ') as ids_turmas,
        STRING_AGG(DISTINCT t.turno, ', ') as turnos
      FROM professores p
      JOIN alocacoes a ON p.id = a.professor_id
      JOIN turmas t ON a.turma_id = t.id
      GROUP BY p.id, p.nome
      HAVING COUNT(DISTINCT a.turma_id) > 1
      ORDER BY COUNT(DISTINCT a.turma_id) DESC;
    `);

    console.log(`   ⚠️  Professores em 2+ turmas: ${conflitosResults.length}`);
    conflitosResults.slice(0, 5).forEach((c, i) => {
      console.log(`      ${i+1}. ${c.nome}: ${c.turmas_no_turno} turmas (${c.ids_turmas})`);
    });
    console.log();

    // Turmas sem professor
    const vagasResults = await query(`
      SELECT
        t.id,
        t.identificador,
        t.ano_escolar,
        e.nome as escola,
        t.turno
      FROM turmas t
      JOIN escolas e ON t.escola_id = e.id
      WHERE NOT EXISTS (
        SELECT 1 FROM alocacoes a WHERE a.turma_id = t.id
      )
      ORDER BY e.nome, t.identificador;
    `);

    console.log(`   🚫 Turmas SEM professor (VAGAS): ${vagasResults.length}`);
    vagasResults.slice(0, 5).forEach((v, i) => {
      console.log(`      ${i+1}. ${v.identificador} - ${v.ano_escolar} (${v.escola} - ${v.turno})`);
    });
    console.log();

    // Professores com afastamento
    const afastamentosResults = await query(`
      SELECT
        p.id,
        p.nome,
        p.status,
        p.data_inicio_afastamento,
        p.data_fim_afastamento,
        COUNT(DISTINCT a.id) as alocacoes
      FROM professores p
      LEFT JOIN alocacoes a ON p.id = a.professor_id
      WHERE p.status IN ('afastado', 'redução_de_carga')
      GROUP BY p.id, p.nome, p.status, p.data_inicio_afastamento, p.data_fim_afastamento
      ORDER BY p.nome;
    `);

    console.log(`   ⏸️  Professores AFASTADOS ou EM REDUÇÃO: ${afastamentosResults.length}`);
    afastamentosResults.slice(0, 5).forEach((a, i) => {
      console.log(`      ${i+1}. ${a.nome} (${a.status}): ${a.alocacoes} alocações`);
    });
    console.log();

    // 4. VALIDAR CARGA HORÁRIA
    console.log('4️⃣  VALIDANDO CARGA HORÁRIA...\n');

    const cargaHorariaResults = await query(`
      SELECT
        e.nome as escola,
        p.id,
        p.nome,
        p.carga_horaria_contratual,
        COUNT(DISTINCT a.periodos) as total_periodos,
        SUM(a.periodos) as periodos_somados,
        CASE
          WHEN SUM(a.periodos) > p.carga_horaria_contratual THEN 'SOBRECARGA'
          WHEN SUM(a.periodos) < p.carga_horaria_contratual AND p.status = 'ativo' THEN 'SUBCARGA'
          ELSE 'OK'
        END as status_carga
      FROM professores p
      LEFT JOIN alocacoes a ON p.id = a.professor_id
      JOIN lotacoes l ON p.id = l.professor_id
      JOIN escolas e ON l.escola_id = e.id
      WHERE p.status = 'ativo'
      GROUP BY e.nome, p.id, p.nome, p.carga_horaria_contratual
      ORDER BY e.nome, p.nome;
    `);

    const sobrecarga = cargaHorariaResults.filter(c => c.status_carga === 'SOBRECARGA').length;
    const subcarga = cargaHorariaResults.filter(c => c.status_carga === 'SUBCARGA').length;

    console.log(`   ⚠️  SOBRECARGA (mais períodos que contratado): ${sobrecarga}`);
    cargaHorariaResults.filter(c => c.status_carga === 'SOBRECARGA').slice(0, 5).forEach((c, i) => {
      console.log(`      ${i+1}. ${c.nome} (${c.escola}): ${c.periodos_somados}/${c.carga_horaria_contratual}`);
    });
    console.log();

    console.log(`   ⚠️  SUBCARGA (menos períodos que contratado): ${subcarga}`);
    cargaHorariaResults.filter(c => c.status_carga === 'SUBCARGA').slice(0, 5).forEach((c, i) => {
      console.log(`      ${i+1}. ${c.nome} (${c.escola}): ${c.periodos_somados}/${c.carga_horaria_contratual}`);
    });
    console.log();

    // 5. RESUMO POR ESCOLA
    console.log('5️⃣  RESUMO POR ESCOLA...\n');

    const escolasResults = await query(`
      SELECT
        e.id,
        e.nome,
        COUNT(DISTINCT l.professor_id) as total_professores,
        COUNT(DISTINCT t.id) as total_turmas,
        COUNT(DISTINCT a.id) as total_alocacoes,
        COUNT(DISTINCT l.id) as total_lotacoes
      FROM escolas e
      LEFT JOIN lotacoes l ON e.id = l.escola_id
      LEFT JOIN turmas t ON e.id = t.escola_id
      LEFT JOIN alocacoes a ON t.id = a.turma_id
      GROUP BY e.id, e.nome
      ORDER BY e.nome;
    `);

    escolasResults.forEach(escola => {
      console.log(`   📍 ${escola.nome}:`);
      console.log(`      • Professores: ${escola.total_professores}`);
      console.log(`      • Turmas: ${escola.total_turmas}`);
      console.log(`      • Alocações: ${escola.total_alocacoes}`);
      console.log(`      • Lotações: ${escola.total_lotacoes}`);
    });
    console.log();

    // 6. PENDÊNCIAS
    console.log('6️⃣  ANALISANDO PENDÊNCIAS...\n');

    const pendenciasResults = await query(`
      SELECT
        p.tipo,
        COUNT(*) as quantidade,
        SUM(CASE WHEN p.status = 'pendente' THEN 1 ELSE 0 END) as pendentes
      FROM pendencias p
      GROUP BY p.tipo
      ORDER BY quantidade DESC;
    `);

    console.log(`   📋 Pendências por tipo:`);
    pendenciasResults.forEach(pend => {
      console.log(`      • ${pend.tipo}: ${pend.quantidade} (${pend.pendentes} pendentes)`);
    });
    console.log();

    // 7. GERAR RELATÓRIOS
    console.log('7️⃣  GERANDO RELATÓRIOS...\n');

    const relatorio = {
      timestamp: new Date().toISOString(),
      resumo: {
        total_professores: counts.total_professores,
        total_turmas: counts.total_turmas,
        total_alocacoes: counts.total_alocacoes,
        total_lotacoes: counts.total_lotacoes,
        total_escolas: counts.total_escolas
      },
      integridade: {
        com_status_pct: parseFloat(pctStatus),
        com_matricula_pct: parseFloat(pctMatricula),
        com_cargo_pct: parseFloat(pctCargo),
        com_disciplina_pct: parseFloat(pctDisciplina),
        distribuicao_status: statusResults
      },
      problemas: {
        professores_multiplas_turmas: conflitosResults.length,
        turmas_sem_professor: vagasResults.length,
        professores_afastados: afastamentosResults.length,
        sobrecarga: sobrecarga,
        subcarga: subcarga
      },
      escolas: escolasResults,
      detalhes: {
        conflitos: conflitosResults.slice(0, 10),
        vagas: vagasResults.slice(0, 10),
        afastamentos: afastamentosResults.slice(0, 10),
        sobrecarga: cargaHorariaResults.filter(c => c.status_carga === 'SOBRECARGA').slice(0, 10),
        subcarga: cargaHorariaResults.filter(c => c.status_carga === 'SUBCARGA').slice(0, 10),
        pendencias: pendenciasResults
      }
    };

    // Salvar JSON
    fs.writeFileSync(
      'relatorio_diagnostico.json',
      JSON.stringify(relatorio, null, 2)
    );
    console.log('   ✓ Salvo: relatorio_diagnostico.json');

    // Salvar CSV detalhado
    let csv = 'Tipo de Problema,Quantidade,Categoria,Criticidade\n';
    csv += `Professores em múltiplas turmas,${conflitosResults.length},Alocação,Alta\n`;
    csv += `Turmas SEM professor,${vagasResults.length},Alocação,Crítica\n`;
    csv += `Professores afastados/redução,${afastamentosResults.length},Afastamento,Média\n`;
    csv += `Sobrecarga de períodos,${sobrecarga},Carga Horária,Alta\n`;
    csv += `Subcarga de períodos,${subcarga},Carga Horária,Alta\n`;
    csv += `Sem STATUS,${integridade.total - integridade.com_status},Integridade,Média\n`;
    csv += `Sem MATRÍCULA,${integridade.total - integridade.com_matricula},Integridade,Baixa\n`;
    csv += `Sem CARGO_FUNÇÃO,${integridade.total - integridade.com_cargo},Integridade,Média\n`;
    csv += `Sem DISCIPLINA_PRINCIPAL,${integridade.total - integridade.com_disciplina},Integridade,Média\n`;

    fs.writeFileSync('relatorio_diagnostico.csv', csv);
    console.log('   ✓ Salvo: relatorio_diagnostico.csv');

    // RANKING DE PROBLEMAS
    const ranking = [
      { tipo: 'Turmas SEM professor', count: vagasResults.length, criticidade: 'CRÍTICA' },
      { tipo: 'Subcarga', count: subcarga, criticidade: 'ALTA' },
      { tipo: 'Sobrecarga', count: sobrecarga, criticidade: 'ALTA' },
      { tipo: 'Professores em múltiplas turmas', count: conflitosResults.length, criticidade: 'ALTA' },
      { tipo: 'Sem STATUS', count: integridade.total - integridade.com_status, criticidade: 'MÉDIA' },
      { tipo: 'Sem CARGO', count: integridade.total - integridade.com_cargo, criticidade: 'MÉDIA' },
      { tipo: 'Sem DISCIPLINA', count: integridade.total - integridade.com_disciplina, criticidade: 'MÉDIA' },
      { tipo: 'Sem MATRÍCULA', count: integridade.total - integridade.com_matricula, criticidade: 'BAIXA' }
    ].sort((a, b) => b.count - a.count);

    console.log('\n🏆 RANKING DE PROBLEMAS:\n');
    ranking.forEach((item, i) => {
      if (item.count > 0) {
        const icon = item.criticidade === 'CRÍTICA' ? '🔴' : item.criticidade === 'ALTA' ? '🟠' : item.criticidade === 'MÉDIA' ? '🟡' : '🟢';
        console.log(`   ${icon} ${i+1}. ${item.tipo}: ${item.count} (${item.criticidade})`);
      }
    });

    console.log('\n✅ Diagnóstico concluído! Relatórios salvos.\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

diagnostico();
