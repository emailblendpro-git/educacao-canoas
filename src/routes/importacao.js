const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');
const { renderPendencia, gerarDevolutivaBuffer, parseTudo, importar } = require('../lib/planilhaEscola');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) {
      return cb(new Error('Envie um arquivo .xlsx'));
    }
    cb(null, true);
  },
});

function apenasAdmin(req, res, next) {
  if (req.usuario.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administrador pode importar escolas' });
  }
  next();
}

async function carregarWorkbook(req) {
  if (!req.file) {
    const err = new Error('Nenhum arquivo enviado (campo esperado: "arquivo")');
    err.status = 400;
    throw err;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  return wb;
}

function resumoDados(dados) {
  const porTipo = {};
  for (const p of dados.pendencias) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  return {
    professoresNoRoster: dados.roster.length,
    turmasIdentificadas: dados.grade.length,
    alocacoesResolvidas: dados.alocacoesResolvidas.length,
    totalPendencias: dados.pendencias.length,
    pendenciasPorTipo: porTipo,
  };
}

router.post('/escolas/importar', autenticar, apenasAdmin, upload.single('arquivo'), async (req, res) => {
  try {
    const wb = await carregarWorkbook(req);
    const dados = await parseTudo(pool, wb, req.file.originalname);

    const existe = await pool.query('SELECT id FROM escolas WHERE lower(nome) = lower($1)', [dados.nomeEscola]);

    res.json({
      nomeEscola: dados.nomeEscola,
      escolaJaExiste: existe.rows.length > 0,
      abasUsadas: dados.abasUsadas,
      resumo: resumoDados(dados),
      pendencias: dados.pendencias
        .map(p => ({ tipo: p.tipo, ...renderPendencia(p) }))
        .filter(p => p.categoria),
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.tipo === 'abas_faltando' ? 400 : 500)).json({ erro: err.message || 'Erro ao analisar planilha' });
  }
});

router.post('/escolas/importar/confirmar', autenticar, apenasAdmin, upload.single('arquivo'), async (req, res) => {
  try {
    const wb = await carregarWorkbook(req);
    const dados = await parseTudo(pool, wb, req.file.originalname);
    const resultado = await importar(pool, dados.nomeEscola, dados);

    res.json({
      nomeEscola: dados.nomeEscola,
      ...resultado,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.tipo === 'abas_faltando' ? 400 : 500)).json({ erro: err.message || 'Erro ao importar planilha' });
  }
});

router.post('/escolas/importar/relatorio', autenticar, apenasAdmin, upload.single('arquivo'), async (req, res) => {
  try {
    const wb = await carregarWorkbook(req);
    const dados = await parseTudo(pool, wb, req.file.originalname);
    const buffer = await gerarDevolutivaBuffer(dados.pendencias);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pendencias-${dados.nomeEscola.replace(/[^a-z0-9]+/gi, '-')}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.tipo === 'abas_faltando' ? 400 : 500)).json({ erro: err.message || 'Erro ao gerar relatório' });
  }
});

module.exports = router;
