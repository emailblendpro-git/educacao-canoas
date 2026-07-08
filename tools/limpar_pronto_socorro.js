#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function limpar() {
  try {
    console.log('🧹 Limpando vestígios de "Pronto-socorro"...\n');

    // 1. Buscar ID da disciplina
    const discResult = await pool.query(
      `SELECT id FROM disciplinas WHERE nome ILIKE '%pronto%' OR sigla ILIKE '%pronto%'`
    );

    if (discResult.rows.length === 0) {
      console.log('✓ Nenhuma disciplina "Pronto" encontrada no banco');
      console.log('\n💡 Se você ainda está vendo "Pronto-socorro" no app:');
      console.log('   1. Abra o navegador');
      console.log('   2. Pressione F12 para abrir DevTools');
      console.log('   3. Vá em Application > Storage > Local Storage');
      console.log('   4. Delete todos os dados');
      console.log('   5. Recarregue a página (Ctrl+Shift+R - força recarregar)');
      console.log('\nIsto removerá o cache local do navegador.\n');
    } else {
      console.log('⚠️  Disciplina "Pronto" encontrada! Removendo...\n');

      const discId = discResult.rows[0].id;

      // 2. Remover de matriz_projetos_escola
      const del1 = await pool.query(
        `DELETE FROM matriz_projetos_escola WHERE disciplina_id = $1`,
        [discId]
      );
      console.log(`✓ Removidos ${del1.rowCount} registros de matriz_projetos_escola`);

      // 3. Remover de matriz_curricular_global
      const del2 = await pool.query(
        `DELETE FROM matriz_curricular_global WHERE disciplina_id = $1`,
        [discId]
      );
      console.log(`✓ Removidos ${del2.rowCount} registros de matriz_curricular_global`);

      // 4. Remover alocações
      const del3 = await pool.query(
        `DELETE FROM alocacoes WHERE disciplina_id = $1`,
        [discId]
      );
      console.log(`✓ Removidas ${del3.rowCount} alocações`);

      // 5. Remover pendências relacionadas
      const del4 = await pool.query(
        `DELETE FROM pendencias WHERE dados::text ILIKE '%pronto%'`
      );
      console.log(`✓ Removidas ${del4.rowCount} pendências com "Pronto"`);

      // 6. Finalmente, remover a disciplina
      const del5 = await pool.query(
        `DELETE FROM disciplinas WHERE id = $1`,
        [discId]
      );
      console.log(`✓ Removida disciplina ID ${discId}: "Pronto-socorro"`);

      console.log('\n✅ Limpeza concluída!');
      console.log('💡 Agora recarregue a página do app (Ctrl+F5) para ver as mudanças\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

limpar();
