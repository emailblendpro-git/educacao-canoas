#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function getSchema() {
  try {
    console.log('📊 ESQUEMA DO BANCO:\n');

    // Listar tabelas
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('Tabelas encontradas:');
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`\n  📋 ${tableName}:`);

      // Listar colunas
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
        console.log(`     • ${col.column_name}: ${col.data_type} ${nullable}`);
      });

      // Contar registros
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const count = countResult.rows[0].count;
      console.log(`     🔢 Total de registros: ${count}`);
    }

    console.log('\n✅ Schema mapeado!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

getSchema();
