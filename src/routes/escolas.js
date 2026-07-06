const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/escolas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM escolas');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar escolas' });
  }
});

module.exports = router;
