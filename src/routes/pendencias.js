const express = require('express');
const pool = require('../db');
const { autenticar, PERFIS_GLOBAIS } = require('../middleware/auth');

const router = express.Router();

// resolve a escola que o pedido pode enxergar: perfis globais (admin/secretaria
// central) podem passar ?escola_id=; os demais ficam presos à própria escola.
function escolaPermitida(req) {
  if (PERFIS_GLOBAIS.has(req.usuario.perfil)) {
    return req.query.escola_id ? Number(req.query.escola_id) : null; // null = todas
  }
  return req.usuario.escolaId;
}

router.get('/pendencias', autenticar, async (req, res) => {
  try {
    const escolaId = escolaPermitida(req);
    const params = [];
    let where = `status = 'aberta'`;
    if (escolaId) {
      params.push(escolaId);
      where += ` AND p.escola_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT p.id, p.escola_id, e.nome AS escola_nome, p.tipo, p.dados, p.criado_em
       FROM pendencias p JOIN escolas e ON e.id = p.escola_id
       WHERE ${where}
       ORDER BY p.criado_em DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar pendências' });
  }
});

// cria um professor a partir de uma pendência de cadastro (nome não identificado,
// CH inválida, matrícula ausente/duplicada) -- usado quando a pessoa ainda nem
// existe no banco porque foi excluída na importação por causa do próprio problema.
// Lança um erro com `.status` quando a matrícula informada já está em uso, pra
// rota devolver 409 em vez de deixar a constraint UNIQUE estourar como 500.
async function criarProfessor(client, { nome, area, ch, tipoVinculo, matricula, cargoNome, escolaId }) {
  const existente = await client.query('SELECT id FROM professores WHERE matricula = $1', [matricula]);
  if (existente.rows.length) {
    const err = new Error(`Matrícula ${matricula} já pertence a outro professor cadastrado.`);
    err.status = 409;
    throw err;
  }

  let cargoId = null;
  if (cargoNome) {
    const c = await client.query('SELECT id FROM cargos_funcoes WHERE nome = $1', [cargoNome]);
    cargoId = c.rows[0] && c.rows[0].id;
  }

  const profRes = await client.query(
    `INSERT INTO professores (matricula, nome, area_concurso, cargo_funcao_id, carga_horaria_contratual, tipo_vinculo, status, ano_letivo)
     VALUES ($1,$2,$3,$4,$5,$6,'ativo',2026) RETURNING id`,
    [matricula, nome, area || null, cargoId, ch, tipoVinculo || 'concursado']
  );
  const professorId = profRes.rows[0].id;

  await client.query(
    `INSERT INTO lotacoes (professor_id, escola_id, carga_horaria, tipo, turno, ativo, ano_letivo)
     VALUES ($1,$2,$3,'principal','integral',true,2026)`,
    [professorId, escolaId, ch]
  );

  return professorId;
}

router.patch('/pendencias/:id/resolver', autenticar, async (req, res) => {
  const { id } = req.params;
  const { professor_id, observacao, novo_professor, professores } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query('SELECT * FROM pendencias WHERE id = $1 FOR UPDATE', [id]);
    const pendencia = pRes.rows[0];
    if (!pendencia) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Pendência não encontrada' });
    }
    if (!PERFIS_GLOBAIS.has(req.usuario.perfil) && pendencia.escola_id !== req.usuario.escolaId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ erro: 'Essa pendência não é da sua escola' });
    }
    if (pendencia.status === 'resolvida') {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Pendência já estava resolvida' });
    }

    // `dados` guarda o objeto original da pendência gerado pelo parser; pra
    // tipos vaga/grade_nome_nao_identificado ele tem um sub-campo `dados` com
    // as coordenadas (ano_escolar/turno/identificador/sigla/periodos) prontas
    // pra criar a alocação, sem precisar reabrir a planilha.
    const resolucao = pendencia.dados && pendencia.dados.dados;

    if (professor_id && resolucao && resolucao.sigla) {
      const turmaRes = await client.query(
        `SELECT id FROM turmas WHERE escola_id=$1 AND ano_escolar=$2 AND turno=$3 AND identificador=$4 AND ano_letivo=$5`,
        [pendencia.escola_id, resolucao.ano_escolar, resolucao.turno, resolucao.identificador, pendencia.ano_letivo]
      );
      const turmaId = turmaRes.rows[0] && turmaRes.rows[0].id;
      if (!turmaId) {
        await client.query('ROLLBACK');
        return res.status(422).json({ erro: 'Turma correspondente não encontrada no banco' });
      }

      const alvos = resolucao.subdisciplinas && resolucao.subdisciplinas.length
        ? resolucao.subdisciplinas
        : [{ sigla: resolucao.sigla, periodos: resolucao.periodos }];

      for (const alvo of alvos) {
        if (!alvo.periodos) continue;
        const discRes = await client.query('SELECT id FROM disciplinas WHERE sigla = $1', [alvo.sigla]);
        const disciplinaId = discRes.rows[0] && discRes.rows[0].id;
        if (!disciplinaId) continue;

        const jaTem = await client.query(
          'SELECT id FROM alocacoes WHERE turma_id=$1 AND disciplina_id=$2 AND ano_letivo=$3',
          [turmaId, disciplinaId, pendencia.ano_letivo]
        );
        if (jaTem.rows.length) continue;

        await client.query(
          `INSERT INTO alocacoes (professor_id, turma_id, disciplina_id, periodos, tipo, ano_letivo)
           VALUES ($1,$2,$3,$4,'regular',$5)`,
          [professor_id, turmaId, disciplinaId, alvo.periodos, pendencia.ano_letivo]
        );
      }
    }

    // cria 1 professor novo com os dados corrigidos (cargo_nome_nao_identificado,
    // ch_invalido, professor_sem_matricula_valida) -- o que já é conhecido vem de
    // `pendencia.dados`, só o campo que estava errado vem do formulário.
    if (novo_professor) {
      const d = pendencia.dados;
      await criarProfessor(client, {
        nome: d.nome || d.nomeRaw,
        area: d.area || null,
        ch: novo_professor.ch || d.ch,
        tipoVinculo: novo_professor.tipo_vinculo,
        matricula: novo_professor.matricula || d.matricula,
        cargoNome: d.cargo,
        escolaId: pendencia.escola_id,
      });
    }

    // cria as 2 pessoas de uma matrícula duplicada, na mesma ordem de dados.pessoas
    if (professores && Array.isArray(professores) && pendencia.dados.pessoas) {
      for (let i = 0; i < professores.length; i++) {
        const submetido = professores[i] || {};
        const pessoa = pendencia.dados.pessoas[i];
        if (!pessoa || !submetido.matricula) continue;
        await criarProfessor(client, {
          nome: pessoa.nome,
          area: pessoa.area,
          ch: pessoa.ch,
          tipoVinculo: submetido.tipo_vinculo || pessoa.tipoVinculo,
          matricula: submetido.matricula,
          escolaId: pendencia.escola_id,
        });
      }
    }

    await client.query(
      `UPDATE pendencias SET status='resolvida', observacao=$2, resolvido_em=now(), resolvido_por=$3 WHERE id=$1`,
      [id, observacao || null, req.usuario.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ erro: err.message });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro ao resolver pendência' });
  } finally {
    client.release();
  }
});

module.exports = router;
