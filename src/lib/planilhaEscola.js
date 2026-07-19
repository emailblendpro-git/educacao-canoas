/**
 * Motor de parsing + import de planilhas de organização escolar (formato "Quadro de
 * Organização Administrativa e Pedagógica" usado pela rede).
 *
 * Usado tanto pelo CLI (tools/parse-planilha.js) quanto pela rota de API
 * (src/routes/importacao.js) — nenhuma das funções aqui lê arquivo do disco,
 * escreve em disco, cria Pool ou chama process.exit; tudo recebe workbook/pool
 * já prontos e devolve dados.
 *
 * Abas esperadas (mesmos nomes usados pela rede):
 *   - "Equipe Diretiva - Vagas"   -> cargos/funções administrativas
 *   - "RH e Carga Horária"       -> cadastro mestre de professores (nome, matrícula, CH, lotação)
 *   - "Professoresdisciplina 2026" -> grade turma x disciplina x professor
 *   - "Turmas"                   -> contagem de turmas por ano/turno (conferência)
 *   - "Grade Curricular"         -> matriz curricular (periodos/semana por disciplina e ano)
 */

const path = require('path');
const ExcelJS = require('exceljs');

// ---------------------------------------------------------------------------
// Normalização e matching de nomes
// ---------------------------------------------------------------------------

const PREPOSICOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(s) {
  return stripAccents(String(s || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// remove sufixos comuns de cobertura/assessoria e anotações que não fazem parte do nome
function cleanName(raw) {
  let s = String(raw || '');
  if (/^[\sx*\-]+$/i.test(s)) return ''; // placeholders tipo "x-x-x-x-x", "****"
  s = s.replace(/\*+/g, '');
  // qualquer coisa depois do primeiro hífen é anotação (assessora, AP FIXA, etc.), não faz parte do nome
  const hifenIdx = s.search(/[-–]/);
  if (hifenIdx > 0) s = s.slice(0, hifenIdx);
  s = s.replace(/\(\s*assessora?\s*\)/gi, '');
  s = s.replace(/\bM[ªº]\.?(?=\s|$)/gi, 'Maria'); // abreviação comum: "Mª Cristina" / "Mº Cristina" -> "Maria Cristina"
  return s.trim();
}

function tokens(s) {
  return normalize(s)
    .split(' ')
    .filter(t => t && !PREPOSICOES.has(t));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Resolve um nome "solto" (vindo da grade ou da equipe diretiva) para uma
 * matrícula do roster (RH e Carga Horária). Nunca "chuta": se não achar uma
 * correspondência confiável, retorna null e quem chamou deve registrar como
 * pendência.
 */
function matchProfessor(rawName, roster) {
  const cleaned = cleanName(rawName);
  if (!cleaned || /^vaga$/i.test(cleaned)) return { status: 'vaga' };

  const normTarget = normalize(cleaned);
  const tokTarget = new Set(tokens(cleaned));
  if (tokTarget.size === 0) return { status: 'vazio' };

  // 1. match exato
  const exact = roster.find(p => normalize(p.nome) === normTarget);
  if (exact) return { status: 'ok', professor: exact, metodo: 'exato' };

  // 2. subset de tokens (em qualquer direção) - cobre nomes abreviados/completos.
  // uma "inicial" (token de 1 letra, ex: nome do meio abreviado "K") satisfaz
  // qualquer token do outro lado que comece com a mesma letra.
  const tokenSatisfied = (tok, setTokens) => {
    if (setTokens.has(tok)) return true;
    if (tok.length === 1) return [...setTokens].some(x => x[0] === tok);
    return false;
  };
  const subsetMatches = roster.filter(p => {
    const tokP = new Set(tokens(p.nome));
    const targetSubsetOfP = [...tokTarget].every(t => tokenSatisfied(t, tokP));
    const pSubsetOfTarget = [...tokP].every(t => tokenSatisfied(t, tokTarget));
    return targetSubsetOfP || pSubsetOfTarget;
  });
  if (subsetMatches.length === 1) {
    return { status: 'ok', professor: subsetMatches[0], metodo: 'subset' };
  }
  if (subsetMatches.length > 1) {
    return { status: 'ambiguo', candidatos: subsetMatches, raw: rawName };
  }

  // 3. fuzzy match (erro de digitação) - só aceita se muito próximo e sem empate
  const scored = roster
    .map(p => ({ p, score: similarity(normTarget, normalize(p.nome)) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score >= 0.82 && (!scored[1] || scored[0].score - scored[1].score >= 0.05)) {
    return { status: 'ok', professor: scored[0].p, metodo: `fuzzy(${scored[0].score.toFixed(2)})` };
  }

  return { status: 'nao_encontrado', raw: rawName, melhoresCandidatos: scored.slice(0, 3) };
}

// ---------------------------------------------------------------------------
// Leitura de células
// ---------------------------------------------------------------------------

function cellText(cell) {
  let v = cell.value;
  if (v && typeof v === 'object' && v.richText) v = v.richText.map(t => t.text).join('');
  if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
  return v == null ? '' : String(v).trim();
}

function fillColor(cell) {
  const f = cell.fill;
  return (f && f.fgColor && f.fgColor.argb) || '';
}

// ---------------------------------------------------------------------------
// Resolução de abas (nomes variam entre escolas: "Equipe Diretiva - Vagas" vs
// "PROJEÇÃO 2026 Equipe Diretiva -", "Professoresdisciplina 2026" vs
// "PROFESSORESDISCIPLINA 2026", às vezes com abas duplicadas/divergentes)
// ---------------------------------------------------------------------------

const SHEET_ROLES = {
  equipe: (n) => n.includes('equipe diretiva'),
  rh: (n) => n.includes('carga horaria') || (n.includes('rh') && n.includes('carga')),
  grade: (n) => n.includes('professoresdisciplina') || (n.includes('professores') && n.includes('disciplina')),
  turmas: (n) => n === 'turmas',
  matriz: (n) => n.includes('grade curricular'),
};

function resolveSheets(wb) {
  const resolved = {};
  const avisos = [];
  for (const [role, test] of Object.entries(SHEET_ROLES)) {
    const candidatos = wb.worksheets.filter(ws => test(normalize(ws.name)));
    if (candidatos.length === 0) { resolved[role] = null; continue; }
    if (candidatos.length === 1) { resolved[role] = candidatos[0]; continue; }
    // múltiplas abas pro mesmo papel: prefere a que tem "2026" no nome, depois a com mais linhas
    const com2026 = candidatos.filter(ws => normalize(ws.name).includes('2026'));
    const pool = com2026.length ? com2026 : candidatos;
    const escolhida = pool.reduce((a, b) => (b.rowCount > a.rowCount ? b : a));
    resolved[role] = escolhida;
    avisos.push({
      tipo: 'aba_ambigua',
      papel: role,
      candidatas: candidatos.map(c => `${c.name} (${c.rowCount} linhas)`),
      escolhida: escolhida.name,
      motivo: 'Havia mais de uma aba candidata para este papel; os dados podem divergir entre elas — vale confirmar com a escola qual é a versão correta.',
    });
  }
  return { resolved, avisos };
}

// ---------------------------------------------------------------------------
// Parse: RH e Carga Horária (roster mestre)
// ---------------------------------------------------------------------------

// "Desdobro" é um período extra (10h ou 20h) somado ao vínculo principal --
// pode ser NO MESMO turno do vínculo principal ou num turno diferente (ex.:
// "20h + 20h desdobro /M" = 20h base + 20h extra especificamente na manhã).
// Não assume que o extra é sempre igual ao valor base -- captura os dois
// números do texto (o 1º é a base, o 2º é o extra, quando vier escrito).
function parseCH(raw) {
  const s = String(raw || '');
  const numeros = [...s.matchAll(/(\d+)/g)].map(m => parseInt(m[1], 10));
  const valor = numeros[0] ?? null;
  const desdobro = /desdobro/i.test(s);

  let desdobroExtra = null;
  let desdobroTurno = null;
  if (desdobro) {
    desdobroExtra = numeros.length > 1 ? numeros[1] : valor;
    if (/\/\s*m\b/i.test(s) || /manh[aã]/i.test(s)) desdobroTurno = 'manha';
    else if (/\/\s*t\b/i.test(s) || /tarde/i.test(s)) desdobroTurno = 'tarde';
    else if (/\/\s*n\b/i.test(s) || /noite/i.test(s)) desdobroTurno = 'noite';
  }

  return { valor, desdobro, desdobroExtra, desdobroTurno, raw: s };
}

// LOTAÇÃO aparece em formatos bem diferentes entre escolas:
//   "( X )LOTAÇÃO", "( x ) CCH - EMEF HILDO MENEGUETTI", "Contratada",
//   "PROFESSOR PERMUTADO-SAPUCAIA DO SUL", "EMEF Santos Dumont"...
// Em vez de depender de um formato fixo, procura palavras-chave.
function inferLotacao(lotacaoRaw) {
  const norm = normalize(lotacaoRaw);
  const tipoVinculo = norm.includes('contrat') ? 'contratado' : 'concursado';
  let tipoLotacao = 'principal';
  let escolaOrigemCch = null;

  // formato com duas caixas na mesma célula: "( X )LOTAÇÃO (  ) CCH - EMEF: X"
  // -- precisa achar QUAL caixa tem o X, não só procurar a palavra "cch" no texto
  // (senão o rótulo da opção não marcada faz todo mundo virar CCH por engano).
  const grupos = [...lotacaoRaw.matchAll(/\(\s*([xX]?)\s*\)\s*([^(]*)/g)];
  if (grupos.length >= 2) {
    const marcado = grupos.find(g => g[1].toLowerCase() === 'x');
    if (marcado && /cch/i.test(marcado[2])) {
      tipoLotacao = 'cch';
      const m = marcado[2].match(/cch[^a-zA-Z0-9]*-?\s*:?\s*(.+)/i);
      escolaOrigemCch = m ? m[1].trim() : null;
    }
  } else if (norm.includes('cch')) {
    // formato antigo, uma opção só na célula: "( x ) CCH - EMEF HILDO MENEGUETTI"
    tipoLotacao = 'cch';
    const m = lotacaoRaw.match(/cch[^a-zA-Z0-9]*-?\s*:?\s*(.+)/i);
    escolaOrigemCch = m ? m[1].trim() : null;
  }

  const reducaoDeCarga = /redu[cç][aã]o/.test(norm);
  return { tipoVinculo, tipoLotacao, escolaOrigemCch, reducaoDeCarga };
}

function parseRH(ws) {
  const roster = [];
  const pendencias = [];
  let headerRow = null;
  let atuacaoCols = []; // [{turno, col}] - detectado dinamicamente (pode ter Manhã/Tarde ou +Noite)

  ws.eachRow((row, rowNum) => {
    const nome = cellText(row.getCell(1));
    if (!nome) return;

    // âncora do cabeçalho: normalmente col1 diz "Nome", mas já vimos planilha com
    // erro de digitação ali (ex.: "mat"). Coluna 2 = "Matrícula" é mais confiável.
    const col2 = normalize(cellText(row.getCell(2)));
    if (normalize(nome) === 'nome' || col2 === 'matricula') {
      headerRow = rowNum;
      const seen = new Set();
      for (let c = 6; c <= ws.columnCount; c++) {
        const t = normalize(cellText(row.getCell(c)));
        if (['manha', 'tarde', 'noite'].includes(t)) {
          if (seen.has(t)) break; // início do bloco "Sobra de carga horária" (turnos repetidos)
          seen.add(t);
          atuacaoCols.push({ turno: t, col: c });
        } else if (atuacaoCols.length > 0) {
          break;
        }
      }
      return;
    }
    if (!headerRow || rowNum <= headerRow) return;
    // linha de sub-cabeçalho tipo "LOTAÇÃO - EMEF: ... CCH - EMEF:" sem matrícula real
    const matriculaRaw = cellText(row.getCell(2));
    if (!matriculaRaw && /lota[cç][aã]o/i.test(cellText(row.getCell(5)))) return;

    const area = cellText(row.getCell(3));
    const chRaw = cellText(row.getCell(4));
    const lotacaoRaw = cellText(row.getCell(5));
    const atuacao = {};
    for (const { turno, col } of atuacaoCols) atuacao[turno] = cellText(row.getCell(col));

    const ch = parseCH(chRaw);
    const isEstagiario = /estagi/i.test(normalize(area)) || /estagi/i.test(normalize(nome));
    const matricula = matriculaRaw.replace(/\D/g, '');

    if (isEstagiario || !matricula) {
      pendencias.push({
        tipo: 'professor_sem_matricula_valida',
        nome, area, ch: chRaw, motivo: isEstagiario ? 'estagiário (sem vínculo concursado/contratado no schema)' : 'matrícula ausente/inválida',
      });
      return;
    }
    if (ch.valor === null || ![10, 20, 40].includes(ch.valor)) {
      pendencias.push({ tipo: 'ch_invalido', nome, matricula, ch: chRaw, motivo: 'CH não reconhecido ou fora de (10,20,40)' });
      return;
    }

    const { tipoVinculo, tipoLotacao, escolaOrigemCch, reducaoDeCarga } = inferLotacao(lotacaoRaw);

    roster.push({
      nome, matricula, area, ch: ch.valor, chDesdobro: ch.desdobro,
      desdobroExtra: ch.desdobroExtra, desdobroTurno: ch.desdobroTurno, chRaw,
      tipoVinculo, tipoLotacao, escolaOrigemCch, reducaoDeCarga,
      atuacao, lotacaoRaw,
    });

    if (tipoLotacao === 'cch') {
      pendencias.push({
        tipo: 'cch_escola_origem_nao_cadastrada', nome, matricula,
        motivo: `Lotação principal em "${escolaOrigemCch || '?'}" — carga total só pode ser validada quando essa escola for cadastrada no banco`,
      });
    }
  });
  return { roster, pendencias };
}

// ---------------------------------------------------------------------------
// Parse: Equipe Diretiva - Vagas (cargos/funções administrativas)
// ---------------------------------------------------------------------------

const LABEL_TO_CARGO = {
  'direcao': 'Diretor',
  'vice-direcao': 'Vice-Diretor',
  'supervisao': 'Supervisor',
  'orientacao': 'Orientador',
  'secretaria': 'Secretaria',
  'readaptacao de cargo - auxiliar secretaria': 'Readaptado',
  'readaptacao de cargo - biblioteca': 'Biblioteca',
  'laboratorio de aprendizagem': 'Laboratório de Aprendizagem',
  'sala de recursos': 'Sala de Recursos',
  'assessoria pedagogica': 'Assessor Pedagógico',
  'pll/biblioteca': 'Biblioteca',
  'teb': 'TEB',
  'estagiario': 'Estagiário',
};

function parseEquipeDiretiva(ws) {
  const atribuicoes = []; // { nomeRaw, cargoLabel, turno, corFundo }
  ws.eachRow((row) => {
    const label = cellText(row.getCell(1));
    if (!label) return;
    const cargo = LABEL_TO_CARGO[normalize(label)];
    if (!cargo) return;
    for (const [turno, col] of [['manha', 2], ['tarde', 3]]) {
      const cell = row.getCell(col);
      const nome = cellText(cell);
      if (!nome || /^vaga$/i.test(nome)) continue;
      atribuicoes.push({ nomeRaw: nome, cargo, turno, cor: fillColor(cell) });
    }
  });
  return atribuicoes;
}

// ---------------------------------------------------------------------------
// Parse: Grade Curricular (matriz)
// ---------------------------------------------------------------------------

function parseGradeCurricular(ws) {
  // bloco esquerdo: anos iniciais (1º-5º) colunas LP ER M C H G PPA PLL TICs A EF
  // bloco direito: anos finais (6º-9º) colunas LP LI M C H G EF ER A
  const iniciais = {};
  const finais = {};
  const headerRow = ws.getRow(2);
  const colsEsq = [];
  for (let c = 2; c <= 12; c++) colsEsq.push(cellText(headerRow.getCell(c)));
  const colsDir = [];
  for (let c = 16; c <= 24; c++) colsDir.push(cellText(headerRow.getCell(c)));

  for (let r = 3; r <= 7; r++) {
    const row = ws.getRow(r);
    const anoEsq = cellText(row.getCell(1)).replace(/[^\d]/g, '');
    if (anoEsq && anoEsq.length <= 2) {
      iniciais[anoEsq] = {};
      for (let i = 0; i < colsEsq.length; i++) {
        const v = parseInt(cellText(row.getCell(2 + i)), 10);
        if (colsEsq[i] && !isNaN(v)) iniciais[anoEsq][colsEsq[i]] = v;
      }
    }
    const anoDir = cellText(row.getCell(15)).replace(/[^\d]/g, '');
    if (anoDir && anoDir.length <= 2) {
      finais[anoDir] = {};
      for (let i = 0; i < colsDir.length; i++) {
        const v = parseInt(cellText(row.getCell(16 + i)), 10);
        if (colsDir[i] && !isNaN(v)) finais[anoDir][colsDir[i]] = v;
      }
    }
  }
  return { iniciais, finais };
}

// ---------------------------------------------------------------------------
// EJA: turmas não seguem o código "1A"/"6C" -- são rótulos livres tipo
// "ALFA E PÓS ALFA", "M3 Ed. Cidadã". Mapeia pro enum ano_escolar do banco
// (eja_alfa, eja_pos, eja_alfa_pos, eja_m1..eja_m4, eja_m1_m2) sem chutar
// quando a combinação não é uma das que o banco aceita.
function mapEjaTurmaLabel(raw) {
  const n = normalize(raw);
  const temAlfa = /\balfa\b/.test(n);
  const temPos = /\bpos\b/.test(n);
  if (temAlfa && temPos) return 'eja_alfa_pos';
  if (temAlfa) return 'eja_alfa';
  if (temPos) return 'eja_pos';

  const ms = new Set([...n.matchAll(/\bm\s?(\d)\b/g)].map(m => m[1]));
  if (ms.size === 1) return `eja_m${[...ms][0]}`;
  if (ms.size === 2 && [...ms].sort().join('') === '12') return 'eja_m1_m2';
  return null; // não deu pra mapear com confiança
}

const EJA_DISCIPLINAS = new Set(['LP', 'LI', 'M', 'C', 'H', 'G', 'EF', 'ER', 'A']);

// cabeçalhos usam nomes por extenso às vezes ("ARTES (1)") em vez da sigla
// que o banco usa ("A") -- sem isso a coluna nunca casa com `disciplinas.sigla`
// e a alocação é silenciosamente descartada na hora de gravar.
const SIGLA_ALIASES = { ARTES: 'A' };
function normalizarSigla(raw) {
  return SIGLA_ALIASES[raw] || raw;
}

// colunas do bloco EJA às vezes vêm com período "(N)" (Paulo VI) e às vezes
// sem (Santos Dumont) -- aceita pelo nome da disciplina direto, ignorando
// colunas que não são disciplina curricular (ex.: "Assessor Pedagógico",
// "Articuladora", que aparecem juntas na mesma tabela em algumas escolas).
function parseColunasEja(row, maxCol) {
  const colunas = [];
  for (let c = 2; c <= maxCol; c++) {
    const raw = cellText(row.getCell(c));
    if (!raw) continue;
    const sigla = raw.replace(/\(.*\)/, '').trim();
    if (EJA_DISCIPLINAS.has(sigla)) colunas.push({ col: c, sigla });
  }
  return colunas;
}

// ---------------------------------------------------------------------------
// Parse: Professoresdisciplina (grade turma x disciplina)
// ---------------------------------------------------------------------------

function parseGrade(ws) {
  const turmas = []; // { turma, anoEscolar, turno, identificador, etapa, papeis: { sigla: nomeRaw } }
  const ejaNaoMapeadas = []; // rótulos de turma EJA que não bateram com nenhum ano_escolar conhecido
  let turno = null;
  let etapa = null; // iniciais | finais | eja
  let colunas = null; // [{col, sigla}]

  ws.eachRow((row, rowNum) => {
    const a1 = cellText(row.getCell(1));
    if (!a1) return;
    const norm = normalize(a1);

    if (norm === 'eja') { etapa = 'eja'; colunas = null; return; }
    if (norm.includes('noite') && !norm.includes('anos')) { return; } // marcador de bloco, turno da EJA é fixo 'noite'
    if (norm.includes('manha') && !norm.includes('anos')) { turno = 'manha'; return; }
    if (norm.includes('tarde') && !norm.includes('anos')) { turno = 'tarde'; return; }
    if (norm.includes('anos iniciais')) { etapa = 'iniciais'; colunas = null; return; }
    if (norm.includes('anos finais')) { etapa = 'finais'; colunas = null; return; }

    if (norm === 'turmas') {
      if (etapa === 'eja') {
        colunas = parseColunasEja(row, 13);
      } else {
        colunas = [];
        for (let c = 2; c <= 10; c++) {
          const raw = cellText(row.getCell(c));
          // só aceita colunas reais de disciplina, no formato "Nome(N)" -- descarta
          // colunas de legenda/anotação (ex.: "VAGA", células vazias) que ficam
          // soltas no mesmo bloco de cabeçalho.
          if (!/\(\d+\)/.test(raw)) continue;
          const sigla = normalizarSigla(raw.replace(/\(.*\)/, '').trim());
          if (sigla) colunas.push({ col: c, sigla });
        }
      }
      return;
    }

    if (!colunas) return;

    if (etapa === 'eja') {
      const anoEscolar = mapEjaTurmaLabel(a1);
      if (!anoEscolar) { ejaNaoMapeadas.push(a1); return; }
      const papeis = {};
      for (const { col, sigla } of colunas) {
        const cell = row.getCell(col);
        papeis[sigla] = { nomeRaw: cellText(cell), cor: fillColor(cell) };
      }
      turmas.push({ turma: a1, anoEscolar, identificador: 'A', turno: 'noite', etapa, papeis });
      return;
    }

    // linha de dados: código de turma tipo "1A", "6C"
    const m = a1.match(/^(\d+)([A-Za-z]+)$/);
    if (m) {
      const papeis = {};
      for (const { col, sigla } of colunas) {
        const cell = row.getCell(col);
        const nome = cellText(cell);
        papeis[sigla] = { nomeRaw: nome, cor: fillColor(cell) };
      }
      turmas.push({ turma: a1, anoEscolar: m[1], identificador: m[2], turno, etapa, papeis });
    }
  });

  // linhas EJA duplicadas mapeando pro mesmo ano_escolar (mesma escola já viu isso
  // acontecer com conteúdo divergente entre as duas cópias) -- não dá pra saber
  // qual é a correta, então exclui as duas do import e sinaliza.
  const porChave = {};
  for (const t of turmas.filter(t => t.etapa === 'eja')) {
    (porChave[`${t.anoEscolar}|${t.turno}`] ||= []).push(t);
  }
  const duplicadas = Object.entries(porChave).filter(([, ts]) => ts.length > 1);
  const chavesDuplicadas = new Set(duplicadas.map(([k]) => k));
  const turmasFinal = turmas.filter(t => t.etapa !== 'eja' || !chavesDuplicadas.has(`${t.anoEscolar}|${t.turno}`));

  return { turmas: turmasFinal, ejaNaoMapeadas, ejaDuplicadas: duplicadas.map(([, ts]) => ts.map(t => t.turma)) };
}

// ---------------------------------------------------------------------------
// Devolutiva em Excel (relatório amigável pra escola revisar e corrigir)
// ---------------------------------------------------------------------------

const DEVOLUTIVA_RENDER = {
  aba_ambigua: (p) => ({
    categoria: 'Estrutura da planilha',
    onde: `Aba: ${p.papel}`,
    problema: `Havia mais de uma aba candidata (${p.candidatas.join(' | ')}). Usei "${p.escolhida}".`,
    oQueFazer: 'Confirmar qual aba é a versão correta e apagar/renomear a duplicada.',
  }),
  professor_sem_matricula_valida: (p) => ({
    categoria: 'Cadastro de professor',
    onde: p.nome,
    problema: p.motivo,
    oQueFazer: 'Preencher matrícula válida na aba "RH e Carga Horária" (ou remover a linha se for estagiário/função sem vínculo formal).',
  }),
  ch_invalido: (p) => ({
    categoria: 'Cadastro de professor',
    onde: `${p.nome} (matrícula ${p.matricula})`,
    problema: `CH informada: "${p.ch}" — ${p.motivo}`,
    oQueFazer: 'Corrigir a carga horária para 10h, 20h ou 40h.',
  }),
  cch_escola_origem_nao_cadastrada: (p) => ({
    categoria: 'CCH (outra escola)',
    onde: `${p.nome} (matrícula ${p.matricula})`,
    problema: p.motivo,
    oQueFazer: 'Nenhuma ação da escola por enquanto — depende de cadastrarmos a escola de origem no sistema.',
  }),
  cargo_nome_nao_identificado: (p) => ({
    categoria: 'Cargo/função',
    onde: `"${p.nomeRaw}" (cargo: ${p.cargo})`,
    problema: 'Nome não encontrado na aba "RH e Carga Horária".',
    oQueFazer: 'Adicionar essa pessoa na aba RH com matrícula e CH, ou corrigir o nome se for erro de digitação.',
  }),
  grade_nome_nao_identificado: (p) => ({
    categoria: 'Grade de aulas',
    onde: `Turma ${p.turma} (${p.turno}) — ${p.sigla}`,
    problema: p.detalhe.status === 'ambiguo'
      ? `Nome "${p.nomeRaw}" corresponde a mais de uma pessoa no cadastro: ${p.detalhe.candidatos.map(c => c.nome).join(' / ')}`
      : `Nome "${p.nomeRaw}" não foi encontrado na aba "RH e Carga Horária".`,
    oQueFazer: 'Informar o nome completo (com sobrenome) da pessoa responsável por essa aula.',
  }),
  vaga: (p) => ({
    categoria: 'Vaga em aberto',
    onde: `Turma ${p.turma} (${p.turno}) — ${p.sigla}`,
    problema: 'Sem professor alocado nessa disciplina/turma.',
    oQueFazer: 'Preencher com o nome do professor responsável, ou confirmar que a vaga segue em aberto.',
  }),
  matricula_duplicada: (p) => ({
    categoria: 'Cadastro de professor',
    onde: `Matrícula ${p.matricula}`,
    problema: `Usada por mais de uma pessoa: ${p.nomes.join(' / ')}`,
    oQueFazer: 'Corrigir a matrícula de uma das pessoas — matrícula tem que ser única.',
  }),
  eja_turma_nao_mapeada: (p) => ({
    categoria: 'EJA',
    onde: `Turma EJA "${p.rotulo}"`,
    problema: p.motivo,
    oQueFazer: 'Renomear a turma para um dos rótulos reconhecidos (Alfa, Pós-Alfa, Alfa e Pós-Alfa, M1, M2, M1 e M2, M3, M4) ou confirmar qual nível ela representa.',
  }),
  eja_turma_duplicada: (p) => ({
    categoria: 'EJA',
    onde: `Turmas: ${p.turmas.join(' / ')}`,
    problema: p.motivo,
    oQueFazer: 'Unificar as duas linhas em uma só na planilha, mantendo os dados corretos.',
  }),
};

function renderPendencia(p) {
  const render = DEVOLUTIVA_RENDER[p.tipo];
  return render ? render(p) : null;
}

async function gerarDevolutivaBuffer(pendencias) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pendências');
  ws.columns = [
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'Onde', key: 'onde', width: 38 },
    { header: 'Problema', key: 'problema', width: 55 },
    { header: 'O que fazer', key: 'oQueFazer', width: 55 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDBDBD' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of pendencias) {
    const row = renderPendencia(p);
    if (!row) continue;
    ws.addRow(row);
  }
  for (const row of ws.getRows(2, ws.rowCount - 1) || []) {
    row.alignment = { wrapText: true, vertical: 'top' };
  }

  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Import (grava no banco)
// ---------------------------------------------------------------------------

function nomeEscolaFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  let s = base.replace(/^\d+\s*/, '').replace(/2026/g, '').trim();
  const idx = s.toUpperCase().indexOf('EMEF');
  if (idx >= 0) s = s.slice(idx);
  s = s.replace(/\s*-\s*quadro\s*$/i, '').trim().replace(/\s{2,}/g, ' ');
  const ROMANOS = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
  const PREP = new Set(['de', 'da', 'do', 'dos', 'das']);
  return s.split(' ').map((w, i) => {
    const up = w.toUpperCase();
    if (up === 'EMEF' || ROMANOS.has(up)) return up;
    if (i > 0 && PREP.has(w.toLowerCase())) return w.toLowerCase();
    return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
  }).join(' ');
}

const AREA_PARA_DISCIPLINA = [
  [/l[íi]ngua\s*portugu|(?:^|\W)lp(?:\W|$)/i, 'LP'],
  [/l[íi]ngua\s*ingl|(?:^|\W)li(?:\W|$)/i, 'LI'],
  [/matem[áa]t|(?:^|\W)mat(?:\W|$)/i, 'M'],
  [/ci[êe]ncias|(?:^|\W)cien(?:\W|$)/i, 'C'],
  [/hist[óo]ria|(?:^|\W)h(?:\W|$)/i, 'H'],
  [/geografia|(?:^|\W)geo(?:\W|$)/i, 'G'],
  [/ed\.?\s*f[íi]sica|educa[çc][ãa]o\s*f[íi]sica|(?:^|\W)ef(?:\W|$)/i, 'EF'],
  [/ensino\s*religioso|(?:^|\W)er(?:\W|$)/i, 'ER'],
  [/\barte\b/i, 'A'],
];
function inferDisciplinaPrincipal(area, discId) {
  for (const [re, sigla] of AREA_PARA_DISCIPLINA) {
    if (re.test(area) && discId[sigla]) return discId[sigla];
  }
  return null;
}

function turnosComConteudo(atuacao) {
  const placeholder = /^[\sx*\-]+$/i;
  return Object.entries(atuacao || {})
    .filter(([, v]) => v && !placeholder.test(v))
    .map(([turno]) => turno);
}

// Decide em quantos turnos o professor tem lotação e com que carga em cada um,
// a partir das colunas de Atuação (Manhã/Tarde/Noite) da aba RH.
//
// "Desdobro" é um período extra (10h ou 20h) somado ao vínculo principal --
// tanto concursado quanto contratado podem ter isso, sem ganhar matrícula
// nova. Pode cair no MESMO turno do vínculo principal ou em outro (o sufixo
// "/M"/"/T"/"/N" na CH indica qual turno recebe o extra). Vira uma linha
// separada com tipo='desdobro' -- por isso a unique key da tabela inclui
// `tipo` (permite 2 linhas pro mesmo professor+turno: principal e desdobro).
function buildLotacoes(p) {
  const turnosAtivos = turnosComConteudo(p.atuacao);

  if (p.chDesdobro) {
    const turnoDesdobro = p.desdobroTurno || turnosAtivos[1] || turnosAtivos[0] || 'integral';
    const turnoPrincipal = turnosAtivos.find((t) => t !== turnoDesdobro) || turnosAtivos[0] || turnoDesdobro;
    return [
      { turno: turnoPrincipal, carga_horaria: p.ch, tipo: p.tipoLotacao },
      { turno: turnoDesdobro, carga_horaria: p.desdobroExtra || p.ch, tipo: 'desdobro' },
    ];
  }
  if (turnosAtivos.length === 1) {
    return [{ turno: turnosAtivos[0], carga_horaria: p.ch, tipo: p.tipoLotacao }];
  }
  return [{ turno: 'integral', carga_horaria: p.ch, tipo: p.tipoLotacao }];
}

// chave que identifica a "mesma" pendência entre rodadas do parser -- usada
// pra não recriar como aberta algo que a escola já resolveu pela tela.
function chaveNatural(p) {
  switch (p.tipo) {
    case 'vaga':
    case 'grade_nome_nao_identificado':
      return `${p.dados.turno}|${p.dados.ano_escolar}|${p.dados.identificador}|${p.dados.sigla}`;
    case 'cargo_nome_nao_identificado':
      return `${normalize(p.nomeRaw)}|${p.cargo}`;
    case 'matricula_duplicada':
      return p.matricula;
    case 'ch_invalido':
    case 'professor_sem_matricula_valida':
      return normalize(p.nome);
    case 'cch_escola_origem_nao_cadastrada':
      return p.matricula;
    case 'aba_ambigua':
      return p.papel;
    case 'eja_turma_nao_mapeada':
      return normalize(p.rotulo);
    case 'eja_turma_duplicada':
      return [...p.turmas].sort().join('|');
    default:
      return JSON.stringify(p).slice(0, 200);
  }
}

async function salvarPendencias(client, escolaId, pendencias) {
  let novas = 0;
  for (const p of pendencias) {
    const res = await client.query(
      `INSERT INTO pendencias (escola_id, tipo, chave_natural, dados, ano_letivo)
       VALUES ($1,$2,$3,$4,2026)
       ON CONFLICT (escola_id, tipo, chave_natural, ano_letivo) DO NOTHING
       RETURNING id`,
      [escolaId, p.tipo, chaveNatural(p), JSON.stringify(p)]
    );
    if (res.rows.length) novas++;
  }
  return novas;
}

// Import idempotente: cada linha só é gravada se ainda não existir (checada pela
// chave natural equivalente à constraint UNIQUE da tabela). Rodar de novo sobre
// uma escola já importada não duplica nem apaga nada — só acrescenta o que a
// planilha atual tem e o banco ainda não (ex.: turmas de EJA adicionadas depois).
async function importar(pool, nomeEscola, { rosterValido, cargoPorMatricula, grade, alocacoesResolvidas, matriz, pendencias }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const discRes = await client.query('SELECT id, sigla FROM disciplinas');
    const discId = {};
    for (const r of discRes.rows) discId[r.sigla] = r.id;

    const cargoRes = await client.query('SELECT id, nome FROM cargos_funcoes');
    const cargoId = {};
    for (const r of cargoRes.rows) cargoId[r.nome] = r.id;

    const turnoManha = grade.some(t => t.turno === 'manha');
    const turnoTarde = grade.some(t => t.turno === 'tarde');
    const turnoNoite = grade.some(t => t.turno === 'noite');
    const possuiEja = grade.some(t => t.etapa === 'eja');

    const existe = await client.query('SELECT id FROM escolas WHERE lower(nome) = lower($1)', [nomeEscola]);
    let escolaId, escolaJaExistia;
    if (existe.rows.length) {
      escolaId = existe.rows[0].id;
      escolaJaExistia = true;
      // não sobrescreve nada -- só liga as flags que porventura a planilha atual
      // tenha e o cadastro anterior não tinha (ex.: seção EJA adicionada depois).
      await client.query(
        `UPDATE escolas SET turno_manha = turno_manha OR $2, turno_tarde = turno_tarde OR $3,
           turno_noite = turno_noite OR $4, possui_eja = possui_eja OR $5 WHERE id = $1`,
        [escolaId, turnoManha, turnoTarde, turnoNoite, possuiEja]
      );
    } else {
      const escolaRes = await client.query(
        `INSERT INTO escolas (nome, turno_manha, turno_tarde, turno_noite, possui_eja, ativo)
         VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
        [nomeEscola, turnoManha, turnoTarde, turnoNoite, possuiEja]
      );
      escolaId = escolaRes.rows[0].id;
      escolaJaExistia = false;
    }

    // matrícula é única no banco inteiro (não só nesta escola) -- se essa pessoa já
    // foi cadastrada por outra escola (comum em CCH) ou numa importação anterior
    // desta mesma escola, reaproveita o id em vez de duplicar.
    const existingRes = await client.query(
      'SELECT id, matricula FROM professores WHERE matricula = ANY($1)',
      [rosterValido.map(p => p.matricula)]
    );
    const profId = {};
    for (const r of existingRes.rows) profId[r.matricula] = r.id;

    let novosProfessores = 0;
    for (const p of rosterValido) {
      if (profId[p.matricula]) continue;
      const disciplinaId = inferDisciplinaPrincipal(p.area, discId);
      const cargoNome = cargoPorMatricula[p.matricula] || null;
      const cId = cargoNome ? cargoId[cargoNome] : null;
      let status = 'ativo';
      if (cargoNome === 'Readaptado' || /readapt/i.test(p.area) || /readapt/i.test(p.lotacaoRaw)) status = 'readaptado';
      else if (p.reducaoDeCarga) status = 'reducao_de_carga';

      const res = await client.query(
        `INSERT INTO professores (matricula, nome, area_concurso, cargo_funcao_id, disciplina_principal_id, carga_horaria_contratual, tipo_vinculo, status, ano_letivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2026) RETURNING id`,
        [p.matricula, p.nome, p.area, cId, disciplinaId, p.ch, p.tipoVinculo, status]
      );
      profId[p.matricula] = res.rows[0].id;
      novosProfessores++;
    }

    const turmaExistenteRes = await client.query(
      'SELECT id, ano_escolar, turno, identificador FROM turmas WHERE escola_id = $1 AND ano_letivo = 2026',
      [escolaId]
    );
    const turmaId = {}; // chave "codigo|turno" -- mesmo código pode existir em turnos diferentes
    const turmaJaExiste = new Set(turmaExistenteRes.rows.map(r => `${r.ano_escolar}|${r.turno}|${r.identificador}`));
    // turmas já existentes: precisamos do id delas também, pra alocações poderem apontar pra cá
    for (const r of turmaExistenteRes.rows) {
      const t = grade.find(t => t.anoEscolar === r.ano_escolar && t.turno === r.turno && t.identificador === r.identificador);
      if (t) turmaId[`${t.turma}|${t.turno}`] = r.id;
    }

    let novasTurmas = 0;
    for (const t of grade) {
      const chave = `${t.anoEscolar}|${t.turno}|${t.identificador}`;
      if (turmaJaExiste.has(chave)) continue; // já veio de uma importação anterior
      const res = await client.query(
        `INSERT INTO turmas (escola_id, ano_escolar, turno, identificador, ativo, ano_letivo)
         VALUES ($1,$2,$3,$4,true,2026) RETURNING id`,
        [escolaId, t.anoEscolar, t.turno, t.identificador]
      );
      turmaId[`${t.turma}|${t.turno}`] = res.rows[0].id;
      novasTurmas++;
    }

    let lotacoesCount = 0;
    for (const p of rosterValido) {
      for (const l of buildLotacoes(p)) {
        const jaTem = await client.query(
          'SELECT id FROM lotacoes WHERE professor_id = $1 AND turno = $2 AND tipo = $3 AND ano_letivo = 2026',
          [profId[p.matricula], l.turno, l.tipo]
        );
        if (jaTem.rows.length) continue;
        await client.query(
          `INSERT INTO lotacoes (professor_id, escola_id, carga_horaria, tipo, turno, ativo, ano_letivo)
           VALUES ($1,$2,$3,$4,$5,true,2026)`,
          [profId[p.matricula], escolaId, l.carga_horaria, l.tipo, l.turno]
        );
        lotacoesCount++;
      }
    }

    let mpeCount = 0;
    for (const [ano, cols] of Object.entries(matriz.iniciais)) {
      for (const sigla of ['PPA', 'PLL', 'TICs', 'A']) {
        if (cols[sigla] && discId[sigla]) {
          const jaTem = await client.query(
            'SELECT id FROM matriz_projetos_escola WHERE escola_id=$1 AND ano_escolar=$2 AND disciplina_id=$3 AND ano_letivo=2026',
            [escolaId, ano, discId[sigla]]
          );
          if (jaTem.rows.length) continue;
          await client.query(
            `INSERT INTO matriz_projetos_escola (escola_id, ano_escolar, disciplina_id, periodos_semana, ano_letivo)
             VALUES ($1,$2,$3,$4,2026)`,
            [escolaId, ano, discId[sigla], cols[sigla]]
          );
          mpeCount++;
        }
      }
    }

    let alocCount = 0;
    const inserirAlocacaoSeNova = async (pId, tId, dId, periodos) => {
      const jaTem = await client.query(
        'SELECT id FROM alocacoes WHERE turma_id=$1 AND disciplina_id=$2 AND ano_letivo=2026',
        [tId, dId]
      );
      if (jaTem.rows.length) return false;
      await client.query(
        `INSERT INTO alocacoes (professor_id, turma_id, disciplina_id, periodos, tipo, ano_letivo) VALUES ($1,$2,$3,$4,'regular',2026)`,
        [pId, tId, dId, periodos]
      );
      return true;
    };

    for (const a of alocacoesResolvidas) {
      const tId = turmaId[`${a.turma}|${a.turno}`];
      const pId = profId[a.matricula];
      if (!tId || !pId) continue;

      if (a.sigla === 'Regente') {
        for (const sub of ['LP', 'ER', 'M', 'C', 'H', 'G']) {
          const periodos = (matriz.iniciais[a.anoEscolar] || {})[sub];
          if (!periodos || !discId[sub]) continue;
          if (await inserirAlocacaoSeNova(pId, tId, discId[sub], periodos)) alocCount++;
        }
        continue;
      }

      const tabela = a.etapa === 'iniciais' ? matriz.iniciais : a.etapa === 'finais' ? matriz.finais : matriz.eja;
      const periodos = (tabela[a.anoEscolar] || {})[a.sigla];
      const dId = discId[a.sigla];
      if (!periodos || !dId) continue; // sem referência confiável de período -- não inventa número
      if (await inserirAlocacaoSeNova(pId, tId, dId, periodos)) alocCount++;
    }

    const pendenciasNovas = await salvarPendencias(client, escolaId, pendencias);

    await client.query('COMMIT');
    return { escolaId, escolaJaExistia, novosProfessores, novasTurmas, lotacoesCount, mpeCount, alocCount, pendenciasNovas };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Orquestração de parse (dry-run) — usada tanto pelo CLI quanto pela API
// ---------------------------------------------------------------------------

/**
 * Faz todo o parsing + matching de uma planilha já carregada (ExcelJS
 * Workbook), sem gravar nada no banco. `pool` só é usado para consultar a
 * matriz curricular de referência da EJA (`matriz_curricular_global`) e para
 * derivar disciplinas/cargos, que já existem como cadastro fixo do sistema.
 *
 * Lança erro se alguma aba obrigatória não for encontrada.
 */
async function parseTudo(pool, wb, nomeArquivo) {
  const { resolved, avisos: avisosAbas } = resolveSheets(wb);
  const { equipe: wsEquipe, rh: wsRH, grade: wsGrade, matriz: wsMatriz } = resolved;

  const faltando = [];
  if (!wsEquipe) faltando.push('equipe diretiva');
  if (!wsRH) faltando.push('RH e carga horária');
  if (!wsGrade) faltando.push('professores x disciplina');
  if (!wsMatriz) faltando.push('grade curricular');
  if (faltando.length) {
    const err = new Error(`Abas esperadas não encontradas neste arquivo: ${faltando.join(', ')}. Abas disponíveis: ${wb.worksheets.map(w => w.name).join(', ')}`);
    err.tipo = 'abas_faltando';
    throw err;
  }

  const abasUsadas = { equipe: wsEquipe.name, rh: wsRH.name, grade: wsGrade.name, matriz: wsMatriz.name };

  const { roster, pendencias: pendRoster } = parseRH(wsRH);
  const atribuicoesCargo = parseEquipeDiretiva(wsEquipe);
  const matriz = parseGradeCurricular(wsMatriz);
  const { turmas: grade, ejaNaoMapeadas, ejaDuplicadas } = parseGrade(wsGrade);

  // períodos/semana da EJA não vêm da planilha (a aba "Grade Curricular" só tem
  // anos iniciais/finais) -- vêm da matriz de referência já cadastrada no banco.
  const ejaRes = await pool.query(`
    SELECT m.ano_escolar, d.sigla, m.periodos_semana
    FROM matriz_curricular_global m JOIN disciplinas d ON d.id = m.disciplina_id
    WHERE m.etapa = 'eja'
  `);
  matriz.eja = {};
  for (const r of ejaRes.rows) (matriz.eja[r.ano_escolar] ||= {})[r.sigla] = r.periodos_semana;

  const pendencias = [...avisosAbas, ...pendRoster];

  // matrícula é UNIQUE no banco -- se duas pessoas diferentes da planilha caírem
  // na mesma matrícula, não dá pra saber qual delas é a correta. Exclui as duas
  // do roster utilizável e sinaliza para a escola resolver.
  const porMatricula = {};
  for (const p of roster) (porMatricula[p.matricula] ||= []).push(p);
  const matriculasDuplicadas = Object.entries(porMatricula).filter(([, ps]) => ps.length > 1);
  for (const [matricula, ps] of matriculasDuplicadas) {
    pendencias.push({
      tipo: 'matricula_duplicada', matricula, nomes: ps.map(p => p.nome),
      pessoas: ps.map(p => ({ nome: p.nome, area: p.area, ch: p.ch, tipoVinculo: p.tipoVinculo })),
      motivo: 'Mesma matrícula usada por pessoas diferentes na planilha — nenhuma das duas será importada até a escola corrigir.',
    });
  }
  const matriculasInvalidas = new Set(matriculasDuplicadas.map(([m]) => m));
  const rosterValido = roster.filter(p => !matriculasInvalidas.has(p.matricula));

  for (const rotulo of ejaNaoMapeadas) {
    pendencias.push({
      tipo: 'eja_turma_nao_mapeada', rotulo,
      motivo: `Rótulo de turma EJA "${rotulo}" não corresponde a nenhuma das opções conhecidas (Alfa, Pós-Alfa, Alfa e Pós-Alfa, M1, M2, M1 e M2, M3, M4).`,
    });
  }
  for (const grupo of ejaDuplicadas) {
    pendencias.push({
      tipo: 'eja_turma_duplicada', turmas: grupo,
      motivo: `Mais de uma linha da EJA mapeia pro mesmo nível (${grupo.join(' / ')}) com dados possivelmente diferentes entre si — nenhuma das duas foi importada.`,
    });
  }

  // ---- resolve cargos administrativos contra o roster ----
  const cargoPorMatricula = {};
  for (const at of atribuicoesCargo) {
    const r = matchProfessor(at.nomeRaw, rosterValido);
    if (r.status === 'ok') {
      cargoPorMatricula[r.professor.matricula] = at.cargo;
    } else if (r.status !== 'vaga' && r.status !== 'vazio') {
      pendencias.push({ tipo: 'cargo_nome_nao_identificado', nomeRaw: at.nomeRaw, cargo: at.cargo, detalhe: r });
    }
  }

  // dados estruturados que a resolução via tela precisa pra gravar a alocação
  // sem ter que reabrir a planilha nem reconsultar a matriz curricular.
  function dadosResolucao(t, sigla) {
    const dados = { ano_escolar: t.anoEscolar, identificador: t.identificador, turno: t.turno, sigla, turma_label: t.turma };
    if (sigla === 'Regente') {
      dados.subdisciplinas = ['LP', 'ER', 'M', 'C', 'H', 'G']
        .map(sub => ({ sigla: sub, periodos: (matriz.iniciais[t.anoEscolar] || {})[sub] }))
        .filter(s => s.periodos);
    } else {
      const tabela = t.etapa === 'iniciais' ? matriz.iniciais : t.etapa === 'finais' ? matriz.finais : matriz.eja;
      dados.periodos = (tabela[t.anoEscolar] || {})[sigla] || null;
    }
    return dados;
  }

  // ---- resolve grade turma x disciplina contra o roster ----
  const alocacoesResolvidas = [];
  for (const t of grade) {
    for (const [sigla, { nomeRaw }] of Object.entries(t.papeis)) {
      if (!nomeRaw) continue;
      const r = matchProfessor(nomeRaw, rosterValido);
      if (r.status === 'ok') {
        alocacoesResolvidas.push({ turma: t.turma, anoEscolar: t.anoEscolar, turno: t.turno, etapa: t.etapa, sigla, matricula: r.professor.matricula, metodo: r.metodo });
      } else if (r.status === 'vaga') {
        pendencias.push({ tipo: 'vaga', turma: t.turma, turno: t.turno, sigla, motivo: 'Sem professor alocado (VAGA na planilha)', dados: dadosResolucao(t, sigla) });
      } else {
        pendencias.push({ tipo: 'grade_nome_nao_identificado', turma: t.turma, turno: t.turno, sigla, nomeRaw, detalhe: r, dados: dadosResolucao(t, sigla) });
      }
    }
  }

  const nomeEscola = nomeEscolaFromFilename(nomeArquivo);

  return {
    nomeEscola, abasUsadas, roster, rosterValido, grade, matriz,
    cargoPorMatricula, alocacoesResolvidas, pendencias,
  };
}

module.exports = {
  normalize,
  matchProfessor,
  resolveSheets,
  parseRH,
  parseEquipeDiretiva,
  parseGradeCurricular,
  parseGrade,
  parseColunasEja,
  nomeEscolaFromFilename,
  inferDisciplinaPrincipal,
  buildLotacoes,
  DEVOLUTIVA_RENDER,
  renderPendencia,
  gerarDevolutivaBuffer,
  parseTudo,
  importar,
};
