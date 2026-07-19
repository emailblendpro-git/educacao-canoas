require('dotenv').config();
const express = require('express');
const cors = require('cors');
const escolasRouter = require('./routes/escolas');
const authRouter = require('./routes/auth');
const pendenciasRouter = require('./routes/pendencias');
const professoresRouter = require('./routes/professores');
const painelRouter = require('./routes/painel');
const alocacoesRouter = require('./routes/alocacoes');
const administrativoRouter = require('./routes/administrativo');
const exportarRouter = require('./routes/exportar');
const matrizCurricularRouter = require('./routes/matriz-curricular');
const ocorrenciasRouter = require('./routes/ocorrencias');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/debug/env', (req, res) => {
  res.json({
    DATABASE_URL_DEFINED: !!process.env.DATABASE_URL,
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0,
    DATABASE_URL_FIRST_50: process.env.DATABASE_URL?.substring(0, 50) || 'UNDEFINED',
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET_DEFINED: !!process.env.JWT_SECRET,
  });
});

app.use(escolasRouter);
app.use(authRouter);
app.use(pendenciasRouter);
app.use(professoresRouter);
app.use(painelRouter);
app.use(alocacoesRouter);
app.use(administrativoRouter);
app.use(exportarRouter);
app.use(matrizCurricularRouter);
app.use(ocorrenciasRouter);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
