require('dotenv').config();
const express = require('express');
const escolasRouter = require('./routes/escolas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(escolasRouter);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
