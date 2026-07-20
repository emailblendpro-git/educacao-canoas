const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

const CORES = {
  cabecalho: 'FF1F4E78',
  titulo: 'FF4472C4',
  subtitulo: 'FFD9E1F2',
  sucesso: 'FF70AD47',
  parcial: 'FFFFC000',
  erro: 'FFC0504D',
  total: 'FFBDD7EE',
};

function formatarCelula(cell, style) {
  cell.font = style.font || { name: 'Calibri', size: 11 };
  cell.alignment = style.alignment || { horizontal: 'center', vertical: 'center', wrapText: true };
  cell.border = style.border || {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };
  if (style.fill) cell.fill = style.fill;
  if (style.numFmt) cell.numFmt = style.numFmt;
}

router.get('/escolas/:id/exportar', autenticar, async (req, res) => {
  const escolaId = Number(req.params.id);
  if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && escolaId !== req.usuario.escolaId) {
    return res.status(403).json({ erro: 'Essa escola não é a sua' });
  }

  try {
    // Buscar nome da escola
    const escolaRes = await pool.query('SELECT nome FROM escolas WHERE id = $1', [escolaId]);
    const escolaNome = escolaRes.rows[0]?.nome || 'Escola';

    // Criar workbook
    const workbook = new ExcelJS.Workbook();

    // ===== ABA 1: PAINEL =====
    const abaPainel = workbook.addWorksheet('Painel');

    // Cabeçalho
    abaPainel.mergeCells('A1:F1');
    const header = abaPainel.getCell('A1');
    header.value = escolaNome;
    formatarCelula(header, { font: { bold: true, size: 14 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cabecalho } }, alignment: { horizontal: 'center' } });
    header.font.color = { argb: 'FFFFFFFF' };

    abaPainel.mergeCells('A2:F2');
    const subheader = abaPainel.getCell('A2');
    subheader.value = 'PAINEL DE AULAS';
    formatarCelula(subheader, { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } }, alignment: { horizontal: 'center' } });
    subheader.font.color = { argb: 'FFFFFFFF' };

    // Resumo
    const resumoRes = await pool.query(
      `SELECT
         COUNT(DISTINCT t.id) as turmas,
         COUNT(DISTINCT l.professor_id) as professores,
         COUNT(DISTINCT a.id) as alocacoes
       FROM turmas t
       LEFT JOIN lotacoes l ON l.escola_id = t.escola_id
       LEFT JOIN alocacoes a ON a.turma_id = t.id
       WHERE t.escola_id = $1`,
      [escolaId]
    );
    const resumo = resumoRes.rows[0];

    abaPainel.getCell('A4').value = 'RESUMO';
    formatarCelula(abaPainel.getCell('A4'), { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.subtitulo } } });

    const labels = ['Turmas', 'Professores', 'Alocações'];
    const valores = [resumo.turmas, resumo.professores, resumo.alocacoes];

    labels.forEach((label, i) => {
      abaPainel.getCell(`A${5 + i}`).value = label;
      abaPainel.getCell(`B${5 + i}`).value = valores[i];
      formatarCelula(abaPainel.getCell(`A${5 + i}`), { font: { bold: true } });
      formatarCelula(abaPainel.getCell(`B${5 + i}`), { alignment: { horizontal: 'center' } });
    });

    // Professores e Carga Horária
    abaPainel.getCell('A9').value = 'PROFESSORES E CARGA HORÁRIA';
    formatarCelula(abaPainel.getCell('A9'), { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.subtitulo } } });
    abaPainel.mergeCells('A9:F9');

    const colunas = ['Nome', 'Matrícula', 'Cargo', 'CH Contratual', 'CH Alocada', 'Status'];
    colunas.forEach((col, i) => {
      const cell = abaPainel.getCell(String.fromCharCode(65 + i) + '10');
      cell.value = col;
      formatarCelula(cell, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } } });
    });

    const profRes = await pool.query(
      `SELECT p.nome, p.matricula, cf.nome as cargo, p.carga_horaria_contratual as ch,
              COALESCE(SUM(a.periodos), 0) as ch_alocada
       FROM professores p
       JOIN lotacoes l ON l.professor_id = p.id AND l.escola_id = $1
       LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
       LEFT JOIN alocacoes a ON a.professor_id = p.id
       GROUP BY p.id, p.nome, p.matricula, cf.nome, p.carga_horaria_contratual
       ORDER BY p.nome`,
      [escolaId]
    );

    let row = 11;
    profRes.rows.forEach(prof => {
      const status = prof.ch_alocada > prof.ch ? 'SOBRECARGA' : prof.ch_alocada < prof.ch ? 'SUBCARGA' : 'OK';
      const corStatus = status === 'OK' ? CORES.sucesso : status === 'SOBRECARGA' ? CORES.erro : CORES.parcial;

      abaPainel.getCell(`A${row}`).value = prof.nome;
      abaPainel.getCell(`B${row}`).value = prof.matricula;
      abaPainel.getCell(`C${row}`).value = prof.cargo || '-';
      abaPainel.getCell(`D${row}`).value = prof.ch;
      abaPainel.getCell(`E${row}`).value = prof.ch_alocada;
      abaPainel.getCell(`F${row}`).value = status;

      for (let i = 0; i < 6; i++) {
        const cell = abaPainel.getCell(String.fromCharCode(65 + i) + row);
        formatarCelula(cell, { alignment: { horizontal: i === 0 ? 'left' : 'center' } });
        if (i === 5) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corStatus } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      }
      row++;
    });

    abaPainel.columns = [
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];

    // ===== ABA 2: GRADE DE AULAS =====
    const abaGrade = workbook.addWorksheet('Grade de Aulas');

    abaGrade.mergeCells('A1:G1');
    const headerGrade = abaGrade.getCell('A1');
    headerGrade.value = escolaNome;
    formatarCelula(headerGrade, { font: { bold: true, size: 14 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cabecalho } }, alignment: { horizontal: 'center' } });
    headerGrade.font.color = { argb: 'FFFFFFFF' };

    abaGrade.mergeCells('A2:G2');
    const subheaderGrade = abaGrade.getCell('A2');
    subheaderGrade.value = 'GRADE DE AULAS — TURMA x DISCIPLINA x PROFESSOR';
    formatarCelula(subheaderGrade, { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } }, alignment: { horizontal: 'center' } });
    subheaderGrade.font.color = { argb: 'FFFFFFFF' };

    const colsGrade = ['Turno', 'Turma', 'Disciplina', 'Professor(es)', 'Períodos Alocados', 'Períodos Obrigatórios', 'Status'];
    colsGrade.forEach((col, i) => {
      const cell = abaGrade.getCell(String.fromCharCode(65 + i) + '4');
      cell.value = col;
      formatarCelula(cell, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } } });
    });

    const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' };

    const gradeRes = await pool.query(
      `WITH requeridos AS (
         SELECT t.id turma_id, t.ano_escolar, t.turno, t.identificador, d.sigla, m.periodos_semana obrigatorio
         FROM turmas t
         JOIN matriz_curricular_global m ON m.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = m.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar IN ('1','2','3','4','5')
         UNION ALL
         SELECT t.id, t.ano_escolar, t.turno, t.identificador, d.sigla, mp.periodos_semana
         FROM turmas t
         JOIN matriz_projetos_escola mp ON mp.escola_id = t.escola_id AND mp.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = mp.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar IN ('1','2','3','4','5') AND d.sigla IN ('PPA','PLL','TICs','A')
         UNION ALL
         SELECT t.id, t.ano_escolar, t.turno, t.identificador, d.sigla, m.periodos_semana
         FROM turmas t
         JOIN matriz_curricular_global m ON m.ano_escolar = t.ano_escolar
         JOIN disciplinas d ON d.id = m.disciplina_id
         WHERE t.escola_id = $1 AND t.ano_escolar NOT IN ('1','2','3','4','5')
       ),
       alocado AS (
         SELECT a.turma_id, d.sigla, SUM(a.periodos) periodos_alocados,
                array_agg(DISTINCT p.nome ORDER BY p.nome) professores,
                MAX(CASE WHEN cf.id IS NOT NULL THEN 1 ELSE 0 END) tem_administrativo
         FROM alocacoes a
         JOIN disciplinas d ON d.id = a.disciplina_id
         JOIN professores p ON p.id = a.professor_id
         LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
         GROUP BY a.turma_id, d.sigla
       )
       SELECT r.turma_id, r.ano_escolar, r.turno, r.identificador, r.sigla, r.obrigatorio,
              COALESCE(al.periodos_alocados, 0) AS alocado, al.professores,
              COALESCE(al.tem_administrativo, 0) AS tem_administrativo
       FROM requeridos r
       LEFT JOIN alocado al ON al.turma_id = r.turma_id AND al.sigla = r.sigla
       ORDER BY r.turno, r.ano_escolar, r.identificador, r.sigla`,
      [escolaId]
    );

    let rowGrade = 5;
    gradeRes.rows.forEach((g) => {
      const alocado = Number(g.alocado);
      const obrigatorio = Number(g.obrigatorio);
      const temAdministrativo = !!Number(g.tem_administrativo);

      let status;
      let corStatus;
      if (temAdministrativo) { status = 'ADMINISTRADA'; corStatus = null; }
      else if (alocado <= 0) { status = 'VAGA'; corStatus = CORES.erro; }
      else if (alocado < obrigatorio) { status = 'PARCIAL'; corStatus = CORES.parcial; }
      else { status = 'COMPLETA'; corStatus = CORES.sucesso; }

      abaGrade.getCell(`A${rowGrade}`).value = TURNO_LABEL[g.turno] || g.turno;
      abaGrade.getCell(`B${rowGrade}`).value = `${g.ano_escolar}${g.identificador}`;
      abaGrade.getCell(`C${rowGrade}`).value = g.sigla;
      abaGrade.getCell(`D${rowGrade}`).value = (g.professores || []).join(', ') || 'VAGA';
      abaGrade.getCell(`E${rowGrade}`).value = alocado;
      abaGrade.getCell(`F${rowGrade}`).value = obrigatorio;
      abaGrade.getCell(`G${rowGrade}`).value = status;

      for (let i = 0; i < 7; i++) {
        const cell = abaGrade.getCell(String.fromCharCode(65 + i) + rowGrade);
        formatarCelula(cell, { alignment: { horizontal: (i === 3) ? 'left' : 'center' } });
        if (i === 6 && corStatus) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corStatus } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      }
      rowGrade++;
    });

    abaGrade.columns = [
      { width: 12 },
      { width: 10 },
      { width: 14 },
      { width: 35 },
      { width: 16 },
      { width: 18 },
      { width: 14 },
    ];

    // ===== ABA 3: ADMINISTRATIVO =====
    const abaAdmin = workbook.addWorksheet('Administrativo');

    abaAdmin.mergeCells('A1:C1');
    const headerAdmin = abaAdmin.getCell('A1');
    headerAdmin.value = escolaNome;
    formatarCelula(headerAdmin, { font: { bold: true, size: 14 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cabecalho } }, alignment: { horizontal: 'center' } });
    headerAdmin.font.color = { argb: 'FFFFFFFF' };

    abaAdmin.mergeCells('A2:C2');
    const subheaderAdmin = abaAdmin.getCell('A2');
    subheaderAdmin.value = 'CORPO ADMINISTRATIVO';
    formatarCelula(subheaderAdmin, { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } }, alignment: { horizontal: 'center' } });
    subheaderAdmin.font.color = { argb: 'FFFFFFFF' };

    const colsAdmin = ['Nome', 'Cargo', 'Matrícula'];
    colsAdmin.forEach((col, i) => {
      const cell = abaAdmin.getCell(String.fromCharCode(65 + i) + '4');
      cell.value = col;
      formatarCelula(cell, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } } });
    });

    const adminRes = await pool.query(
      `SELECT p.nome, cf.nome as cargo, p.matricula
       FROM professores p
       JOIN lotacoes l ON l.professor_id = p.id AND l.escola_id = $1
       LEFT JOIN cargos_funcoes cf ON cf.id = p.cargo_funcao_id
       WHERE cf.nome IS NOT NULL
       ORDER BY
         CASE cf.nome
           WHEN 'Diretor' THEN 1
           WHEN 'Vice-Diretor' THEN 2
           WHEN 'Supervisor' THEN 3
           ELSE 99
         END, p.nome`,
      [escolaId]
    );

    let rowAdmin = 5;
    adminRes.rows.forEach(admin => {
      abaAdmin.getCell(`A${rowAdmin}`).value = admin.nome;
      abaAdmin.getCell(`B${rowAdmin}`).value = admin.cargo;
      abaAdmin.getCell(`C${rowAdmin}`).value = admin.matricula;

      for (let i = 0; i < 3; i++) {
        const cell = abaAdmin.getCell(String.fromCharCode(65 + i) + rowAdmin);
        formatarCelula(cell, { alignment: { horizontal: i === 0 ? 'left' : 'center' } });
      }
      rowAdmin++;
    });

    abaAdmin.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
    ];

    // ===== ABA 4: PENDÊNCIAS =====
    const abaPend = workbook.addWorksheet('Pendências');

    abaPend.mergeCells('A1:B1');
    const headerPend = abaPend.getCell('A1');
    headerPend.value = escolaNome;
    formatarCelula(headerPend, { font: { bold: true, size: 14 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cabecalho } }, alignment: { horizontal: 'center' } });
    headerPend.font.color = { argb: 'FFFFFFFF' };

    abaPend.mergeCells('A2:B2');
    const subheaderPend = abaPend.getCell('A2');
    subheaderPend.value = 'PENDÊNCIAS';
    formatarCelula(subheaderPend, { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } }, alignment: { horizontal: 'center' } });
    subheaderPend.font.color = { argb: 'FFFFFFFF' };

    const colsPend = ['Tipo', 'Quantidade'];
    colsPend.forEach((col, i) => {
      const cell = abaPend.getCell(String.fromCharCode(65 + i) + '4');
      cell.value = col;
      formatarCelula(cell, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.titulo } } });
    });

    const pendRes = await pool.query(
      `SELECT tipo, COUNT(*) as quantidade FROM pendencias WHERE escola_id = $1 GROUP BY tipo ORDER BY quantidade DESC`,
      [escolaId]
    );

    let rowPend = 5;
    let totalPend = 0;
    pendRes.rows.forEach(pend => {
      abaPend.getCell(`A${rowPend}`).value = pend.tipo;
      abaPend.getCell(`B${rowPend}`).value = pend.quantidade;
      totalPend += pend.quantidade;

      formatarCelula(abaPend.getCell(`A${rowPend}`), { alignment: { horizontal: 'left' } });
      formatarCelula(abaPend.getCell(`B${rowPend}`), { alignment: { horizontal: 'center' } });
      rowPend++;
    });

    // Total
    abaPend.getCell(`A${rowPend}`).value = 'TOTAL';
    abaPend.getCell(`B${rowPend}`).value = totalPend;
    formatarCelula(abaPend.getCell(`A${rowPend}`), { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.total } } });
    formatarCelula(abaPend.getCell(`B${rowPend}`), { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.total } }, alignment: { horizontal: 'center' } });

    abaPend.columns = [
      { width: 30 },
      { width: 12 },
    ];

    // Gerar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const data = new Date();
    const dataStr = data.toISOString().split('T')[0];
    const nomeEscola = escolaNome.replace(/\s+/g, '_');
    const nomeArquivo = `Painel_${nomeEscola}_${dataStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar arquivo' });
  }
});

module.exports = router;
