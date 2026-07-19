/**
 * CLI para parsear/importar planilhas de organização escolar. Toda a lógica de
 * parsing/matching/import vive em src/lib/planilhaEscola.js (reaproveitada
 * também pela rota de API de importação via upload); este arquivo só cuida de
 * orquestração de terminal: ler argv, ler o arquivo do disco, imprimir
 * relatório e escrever a devolutiva em disco.
 *
 * Uso:
 *   node tools/parse-planilha.js "<arquivo.xlsx>"              -> gera relatório (dry-run, não grava no banco)
 *   node tools/parse-planilha.js "<arquivo.xlsx>" --import     -> além do relatório, importa os dados válidos
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const { normalize, gerarDevolutivaBuffer, parseTudo, importar } = require('../src/lib/planilhaEscola');

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const doImport = args.includes('--import');

  if (!filePath) {
    console.error('Uso: node tools/parse-planilha.js "<arquivo.xlsx>" [--import]');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let dados;
  try {
    dados = await parseTudo(pool, wb, filePath);
  } catch (e) {
    console.error(e.message);
    if (e.tipo !== 'abas_faltando') console.error(e);
    await pool.end();
    process.exit(1);
  }

  const { nomeEscola, abasUsadas, roster, grade, alocacoesResolvidas, pendencias, matriz } = dados;

  console.log('Abas usadas:', abasUsadas);

  console.log('\n=========== RESUMO ===========');
  console.log('Professores no roster (RH):', roster.length);
  console.log('Turmas identificadas na grade:', grade.length);
  console.log('Alocações resolvidas (professor identificado):', alocacoesResolvidas.length);
  console.log('Pendências encontradas:', pendencias.length);

  console.log('\n=========== PENDÊNCIAS (por tipo) ===========');
  const porTipo = {};
  for (const p of pendencias) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  console.table(porTipo);

  console.log('\n=========== DETALHE DAS PENDÊNCIAS ===========');
  console.log(JSON.stringify(pendencias, null, 2));

  console.log('\n=========== MATRIZ CURRICULAR LIDA DO ARQUIVO ===========');
  console.log('Iniciais:', JSON.stringify(matriz.iniciais, null, 2));
  console.log('Finais:', JSON.stringify(matriz.finais, null, 2));

  const slug = normalize(nomeEscola).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const devolutivaPath = path.join(__dirname, '..', 'relatorios', `${slug}-pendencias.xlsx`);
  const buffer = await gerarDevolutivaBuffer(pendencias);
  await fs.promises.mkdir(path.dirname(devolutivaPath), { recursive: true });
  await fs.promises.writeFile(devolutivaPath, buffer);
  console.log(`\nDevolutiva gerada: ${devolutivaPath} (${pendencias.length} pendência(s))`);

  if (!doImport) {
    console.log('\n(modo relatório — nada foi gravado no banco. Rode com --import para gravar.)');
    await pool.end();
    return;
  }

  try {
    const resultado = await importar(pool, nomeEscola, dados);
    console.log(`\n[import] OK — escola "${nomeEscola}" (id=${resultado.escolaId})${resultado.escolaJaExistia ? ' [já existia, dados adicionados]' : ' [nova]'}:`);
    console.log(`  professores novos: ${resultado.novosProfessores} | turmas novas: ${resultado.novasTurmas} | lotações novas: ${resultado.lotacoesCount} | matriz_projetos_escola novas: ${resultado.mpeCount} | alocações novas: ${resultado.alocCount} | pendências novas: ${resultado.pendenciasNovas}`);
  } catch (e) {
    console.error('[import] ERRO — rollback executado, nada foi gravado:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
