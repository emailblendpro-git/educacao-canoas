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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(escolasRouter);
app.use(authRouter);
app.use(pendenciasRouter);
app.use(professoresRouter);
app.use(painelRouter);
app.use(alocacoesRouter);
app.use(administrativoRouter);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
