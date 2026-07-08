import { useEffect, useState } from 'react';
import { api } from './api';
import ProfessorPicker from './ProfessorPicker';

const STATUS_COR = {
  correta: { cor: '#2e7d32', label: 'Carga correta' },
  faltando: { cor: '#f2b200', label: 'Carga faltando' },
  excedida: { cor: '#c0392b', label: 'Carga excedida' },
  administrativo: { cor: '#9e9e9e', label: 'Função administrativa (sem sinalização)' },
};

const COR_TAMBEM_ENSINA = '#2f6fed';

function corCelulaGrade(obrigatorio, alocado) {
  if (alocado <= 0) return '#e57373'; // vaga total
  if (alocado < obrigatorio) return '#ffca28'; // parcial
  return '#66bb6a'; // completa
}

function agruparGrade(grade) {
  const porTurno = {};
  for (const g of grade) {
    const chaveTurma = `${g.ano_escolar}${g.identificador}`;
    porTurno[g.turno] ||= {};
    porTurno[g.turno][chaveTurma] ||= { turma_id: g.turma_id, ano_escolar: g.ano_escolar, identificador: g.identificador, disciplinas: [] };
    porTurno[g.turno][chaveTurma].disciplinas.push(g);
  }
  return porTurno;
}

function BlocoResumo({ resumo, secaoAtiva, onEscolherSecao, onVerPendencias }) {
  const itens = [
    { chave: 'grade', label: 'Turmas', valor: resumo.turmas, onClick: () => onEscolherSecao('grade') },
    { chave: 'professores', label: 'Professores', valor: resumo.professores, onClick: () => onEscolherSecao('professores') },
    { chave: 'pendencias', label: 'Pendências abertas', valor: resumo.pendencias_abertas, onClick: () => onVerPendencias(null) },
    { chave: 'vagas', label: 'Vagas em aberto', valor: resumo.vagas_abertas, onClick: () => onVerPendencias('vaga') },
  ];
  return (
    <div className="painel-resumo">
      {itens.map((i) => (
        <button
          type="button"
          key={i.label}
          className={`painel-card${secaoAtiva === i.chave ? ' painel-card-ativo' : ''}`}
          onClick={i.onClick}
        >
          <span className="painel-card-valor">{i.valor}</span>
          <span className="painel-card-label">{i.label}</span>
        </button>
      ))}
    </div>
  );
}

function EditorDisciplina({ editando, escolaId, onFechar, onSalvo }) {
  const [novoProfessorId, setNovoProfessorId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(profId) {
    setEnviando(true);
    setErro('');
    try {
      await api.atribuirDisciplina(editando.turmaId, editando.sigla, profId);
      onSalvo();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="painel-editor-disciplina">
      <div className="painel-editor-cabecalho">
        <strong>{editando.sigla}</strong> — turma {editando.turmaLabel} ({editando.obrigatorio} período(s)/semana)
        <button type="button" className="painel-editor-fechar" onClick={onFechar}>×</button>
      </div>
      <p className="dica">Responsável atual: {editando.profNome || 'ninguém (vaga)'}</p>
      <ProfessorPicker onSelect={setNovoProfessorId} escolaId={escolaId} />
      {erro && <p className="erro">{erro}</p>}
      <div className="painel-editor-acoes">
        <button type="button" onClick={() => salvar(novoProfessorId)} disabled={!novoProfessorId || enviando}>
          {enviando ? 'Salvando...' : 'Salvar'}
        </button>
        {editando.profId && (
          <button type="button" className="painel-editor-remover" onClick={() => salvar(null)} disabled={enviando}>
            Remover professor
          </button>
        )}
      </div>
    </div>
  );
}

function BlocoGrade({ grade, escolaId, onMudou }) {
  const porTurno = agruparGrade(grade);
  const [editando, setEditando] = useState(null);

  function abrirEditor(t, turno, d) {
    setEditando({
      turmaId: t.turma_id,
      sigla: d.sigla,
      turmaLabel: `${t.ano_escolar}${t.identificador} (${turno})`,
      obrigatorio: d.obrigatorio,
      profId: d.professor_ids ? d.professor_ids[0] : null,
      profNome: d.professores ? d.professores.join(', ') : null,
    });
  }

  function salvo() {
    setEditando(null);
    onMudou();
  }

  function renderizarTurno(turno, turmas) {
    return (
      <div key={turno} className="painel-turno">
        <h3>{turno}</h3>
        {Object.entries(turmas).map(([chave, t]) => (
          <div key={chave}>
            <div className="painel-turma-linha">
              <span className="painel-turma-nome">{t.ano_escolar}{t.identificador}</span>
              <div className="painel-disciplinas">
                {t.disciplinas.map((d) => (
                  <button
                    type="button"
                    key={d.sigla}
                    className="painel-disciplina-chip"
                    style={{ background: corCelulaGrade(d.obrigatorio, Number(d.alocado)) }}
                    title={`${d.sigla}: ${d.alocado}/${d.obrigatorio} período(s)${d.professores ? ' — ' + d.professores.join(', ') : ' — sem professor'}`}
                    onClick={() => abrirEditor(t, turno, d)}
                  >
                    {d.sigla}
                  </button>
                ))}
              </div>
            </div>
            {editando && editando.turmaId === t.turma_id && t.disciplinas.some((d) => d.sigla === editando.sigla) && (
              <EditorDisciplina
                editando={editando}
                escolaId={escolaId}
                onFechar={() => setEditando(null)}
                onSalvo={salvo}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  const turnos = Object.entries(porTurno);

  return (
    <div className="painel-bloco">
      <h2>Grade de aulas</h2>
      <p className="painel-legenda">
        <span className="ponto" style={{ background: '#66bb6a' }} /> completa
        <span className="ponto" style={{ background: '#ffca28' }} /> parcial
        <span className="ponto" style={{ background: '#e57373' }} /> vaga
      </p>
      <p className="dica">Clique numa disciplina pra ver ou trocar quem é o responsável.</p>

      {/* Todos os turnos lado a lado (3 colunas) */}
      {turnos.length > 0 && (
        <div className="painel-turnos-multiplos">
          {turnos.map(([turno, turmas]) => renderizarTurno(turno, turmas))}
        </div>
      )}
    </div>
  );
}

function ItemProfessor({ p, escolaId }) {
  const [aberto, setAberto] = useState(false);
  const [alocacoes, setAlocacoes] = useState(null);
  const [erro, setErro] = useState('');

  function alternar() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir && alocacoes === null) {
      setErro('');
      api.buscarAlocacoesProfessor(p.id, escolaId)
        .then((dados) => { setAlocacoes(dados); setErro(''); })
        .catch((err) => setErro(err.message));
    }
  }

  const tambemDaAula = p.cargo && p.periodos_alocados > 0;
  const detalhe = p.cargo
    ? (tambemDaAula ? `${p.cargo} — também dá ${p.periodos_alocados} período(s) de aula` : p.cargo)
    : `${p.periodos_alocados}/${p.periodos_esperados} períodos (${p.ch}h)`;

  return (
    <li className="painel-professor-item">
      <button className="painel-professor-cabecalho" onClick={alternar}>
        <span className="painel-pontos">
          <span className="ponto" style={{ background: STATUS_COR[p.status].cor }} title={STATUS_COR[p.status].label} />
          {tambemDaAula && (
            <span className="ponto" style={{ background: COR_TAMBEM_ENSINA }} title="Também dá aula" />
          )}
        </span>
        <span className="painel-prof-nome">{p.nome}</span>
        <span className="painel-prof-detalhe">
          matrícula {p.matricula} — {detalhe}
        </span>
        <span className="painel-professor-seta">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="painel-professor-atuacao">
          {erro && <p className="erro">{erro}</p>}
          {alocacoes === null && !erro && <p className="dica">Carregando...</p>}
          {alocacoes && alocacoes.length === 0 && <p className="dica">Sem aulas atribuídas nesta escola.</p>}
          {alocacoes && alocacoes.length > 0 && (
            <table>
              <thead>
                <tr><th>Turma</th><th>Turno</th><th>Disciplina</th><th>Períodos</th></tr>
              </thead>
              <tbody>
                {alocacoes.map((a, i) => (
                  <tr key={i}>
                    <td>{a.ano_escolar}{a.identificador}</td>
                    <td>{a.turno}</td>
                    <td>{a.disciplina} ({a.sigla})</td>
                    <td>{a.periodos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  );
}

function BlocoProfessores({ professores, escolaId }) {
  return (
    <div className="painel-bloco">
      <h2>Carga horária dos professores</h2>
      <p className="painel-legenda">
        {Object.entries(STATUS_COR).map(([status, info]) => (
          <span key={status}>
            <span className="ponto" style={{ background: info.cor }} /> {info.label}
          </span>
        ))}
        <span>
          <span className="ponto" style={{ background: COR_TAMBEM_ENSINA }} /> Também dá aula (some ao ponto de status)
        </span>
      </p>
      <p className="dica">Clique num professor pra ver onde ele está atuando.</p>
      <ul className="painel-professores">
        {professores.map((p) => (
          <ItemProfessor key={p.id} p={p} escolaId={escolaId} />
        ))}
      </ul>
    </div>
  );
}

export default function Painel({ escolaId, onVerPendencias, onEscolaNomeChange }) {
  const [painel, setPainel] = useState(null);
  const [erro, setErro] = useState('');
  const [secaoAtiva, setSecaoAtiva] = useState('grade');

  function carregar() {
    if (!escolaId) return;
    setErro('');
    api.buscarPainel(escolaId)
      .then((dados) => {
        setPainel(dados);
        if (onEscolaNomeChange && dados.resumo?.escola_nome) {
          onEscolaNomeChange(dados.resumo.escola_nome);
        }
      })
      .catch((err) => setErro(err.message));
  }

  useEffect(() => {
    setPainel(null);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId]);

  if (!escolaId) return <p className="dica">Selecione uma escola.</p>;
  if (erro) return <p className="erro">{erro}</p>;
  if (!painel) return <p>Carregando...</p>;

  return (
    <div>
      <BlocoResumo
        resumo={painel.resumo}
        secaoAtiva={secaoAtiva}
        onEscolherSecao={setSecaoAtiva}
        onVerPendencias={onVerPendencias}
      />
      {secaoAtiva === 'grade' && (
        <BlocoGrade grade={painel.grade} escolaId={escolaId} onMudou={carregar} />
      )}
      {secaoAtiva === 'professores' && (
        <BlocoProfessores professores={painel.professores} escolaId={escolaId} />
      )}
    </div>
  );
}
