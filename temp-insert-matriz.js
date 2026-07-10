require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Inserindo disciplinas...');
    await pool.query(`
      INSERT INTO disciplinas (nome, sigla) VALUES
      ('Português', 'PT'), ('Matemática', 'MA'), ('Ciências', 'CI'),
      ('História', 'HI'), ('Geografia', 'GE'), ('Educação Física', 'EF'),
      ('Inglês', 'IN'), ('Arte', 'AR'), ('Música', 'MU')
      ON CONFLICT DO NOTHING
    `);

    console.log('Inserindo matriz para 1º ano...');
    await pool.query(`
      INSERT INTO matriz_projetos_escola (escola_id, ano_escolar, disciplina_id, periodos_semana)
      SELECT 1, '1º ano', id, 2 FROM disciplinas WHERE sigla IN ('PT', 'MA', 'CI', 'HI', 'GE', 'EF', 'AR')
    `).catch(() => console.log('  (alguns registros já existem)'));

    console.log('Inserindo matriz para 6º ano...');
    await pool.query(`
      INSERT INTO matriz_projetos_escola (escola_id, ano_escolar, disciplina_id, periodos_semana)
      SELECT 1, '6º ano', id, 3 FROM disciplinas WHERE sigla IN ('PT', 'MA', 'CI', 'HI', 'GE', 'EF', 'IN', 'AR')
    `).catch(() => console.log('  (alguns registros já existem)'));

    console.log('Dados inseridos com sucesso!');
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await pool.end();
  }
}

main();
