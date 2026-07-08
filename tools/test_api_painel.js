#!/usr/bin/env node
require('dotenv').config();
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/escolas/1/painel',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✓ Response recebido:');
      console.log('  campo "resumo":');
      console.log('    - escola_nome:', json.resumo?.escola_nome);
      console.log('    - turmas:', json.resumo?.turmas);
      console.log('    - professores:', json.resumo?.professores);
      console.log('\n✓ Resposta completa (primeiros 500 chars):');
      console.log(JSON.stringify(json, null, 2).substring(0, 500));
    } catch (e) {
      console.log('✗ Erro ao parsear JSON:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro na requisição:', error.message);
  console.log('\n💡 O backend pode estar desligado. Execute:');
  console.log('   node src/index.js');
});

req.end();
