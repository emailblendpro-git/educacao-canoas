import { useEffect, useState } from 'react';
import { api } from './api';
import ProfessorPicker from './ProfessorPicker';
import MatrizCurricular from './MatrizCurricular';
import ObservacoesTab from './Observacoes';

const STATUS_COR = {
  correta: { cor: '#2e7d32', label: 'Carga correta' },
  faltando: { cor: '#f2b200', label: 'Carga faltando' },
  excedida: { cor: '#c0392b', label: 'Carga excedida' },
  administrativo: { cor: '#9e9e9e', label: 'Função administrativa (sem sinalização)' },
};

const COR_TAMBEM_ENSINA = '#2f6fed';

function corCelulaGrade(obrigatorio, alocado, temAdministrativo) {
  if (temAdministrativo) return '#9e9e9e'; // administrada (cinza)
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

function BlocoGradeTurnos({ grade, escolaId, onMudou }) {
  const porTurno = agruparGrade(grade);
  const [editando, setEditando] = useState(null);
  const GRADE_ESQUERDA = ['LP', 'ER', 'M', 'C', 'H', 'G'];
  const GRADE_DIREITA = ['PPA', 'PLL', 'TICs', 'A', 'EF'];

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

  function renderizarGradeTurno(turno, turmas) {
    const turmasOrdenadas = Object.values(turmas).sort((a, b) => {
      const aNum = parseInt(a.ano_escolar) || 0;
      const bNum = parseInt(b.ano_escolar) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return a.identificador.localeCompare(b.identificador);
    });

    return (
      <div style={{ overflowX: 'auto', border: '2px solid #666', borderRadius: '6px', height: 'fit-content' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          background: 'white',
        }}>
          <thead>
            <tr style={{ background: '#ccc' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600', width: '50px', borderRight: '1px solid #999' }}>
                Turma
              </th>
              {GRADE_ESQUERDA.map(s => (
                <th key={s} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '600', width: '38px', borderRight: '1px solid #ddd' }}>
                  {s}
                </th>
              ))}
              <th style={{ width: '8px', background: 'white' }}></th>
              {GRADE_DIREITA.map(s => (
                <th key={s} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '600', width: '38px', borderRight: '1px solid #ddd' }}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turmasOrdenadas.map(t => {
              const mapDisciplinas = {};
              t.disciplinas.forEach(d => {
                mapDisciplinas[d.sigla] = d;
              });

              return (
                <tr key={t.turma_id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: '600', background: '#f9f9f9', borderRight: '1px solid #999' }}>
                    {t.ano_escolar}{t.identificador}
                  </td>
                  {GRADE_ESQUERDA.map(s => {
                    const d = mapDisciplinas[s];
                    return (
                      <td key={s} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                        {d ? (
                          <button
                            type="button"
                            onClick={() => abrirEditor(t, turno, d)}
                            style={{
                              background: corCelulaGrade(d.obrigatorio, Number(d.alocado), Number(d.tem_administrativo)),
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              padding: '4px 6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                            title={`${d.sigla}: ${d.alocado}/${d.obrigatorio}${d.tem_administrativo ? ' — administrado' : ''}${d.professores ? ' — ' + d.professores.join(', ') : ''}`}
                          >
                            {s}
                          </button>
                        ) : (
                          <span style={{ color: '#ddd' }}>-</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ width: '8px', background: 'white', borderRight: '8px solid white' }}></td>
                  {GRADE_DIREITA.map(s => {
                    const d = mapDisciplinas[s];
                    return (
                      <td key={s} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                        {d ? (
                          <button
                            type="button"
                            onClick={() => abrirEditor(t, turno, d)}
                            style={{
                              background: corCelulaGrade(d.obrigatorio, Number(d.alocado), Number(d.tem_administrativo)),
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              padding: '4px 6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                            title={`${d.sigla}: ${d.alocado}/${d.obrigatorio}${d.tem_administrativo ? ' — administrado' : ''}${d.professores ? ' — ' + d.professores.join(', ') : ''}`}
                          >
                            {s}
                          </button>
                        ) : (
                          <span style={{ color: '#ddd' }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Ordenar turnos: manha, tarde, noite, eja (valores reais gravados no banco)
  const ordemTurnos = ['manha', 'tarde', 'noite', 'eja'];
  const turnosOrdenados = ordemTurnos.filter(t => porTurno[t]).map(t => [t, porTurno[t]]);
  const TURNO_LABEL = { manha: 'MANHÃ', tarde: 'TARDE', noite: 'NOITE', eja: 'EJA' };

  return (
    <div>
      <div className="painel-bloco">
        <h2>Grade de aulas</h2>
        <p className="painel-legenda">
          <span className="ponto" style={{ background: '#66bb6a' }} /> completa
          <span className="ponto" style={{ background: '#ffca28' }} /> parcial
          <span className="ponto" style={{ background: '#e57373' }} /> vaga
          <span className="ponto" style={{ background: '#9e9e9e' }} /> administrada
        </p>
        <p className="dica">Clique numa célula para editar a disciplina.</p>
      </div>

      {turnosOrdenados.length > 0 && (
        <div>
          {turnosOrdenados.map(([turno, turmas]) => {
            const anosEscolares = [...new Set(Object.values(turmas).map(t => t.ano_escolar))];
            return (
              <div key={turno} style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{TURNO_LABEL[turno] || turno}</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ flex: '0 0 auto', maxWidth: '500px' }}>
                    {renderizarGradeTurno(turno, turmas)}
                  </div>
                  <div style={{ flex: '0 0 auto', maxWidth: '500px' }}>
                    <MatrizCurricular escolaId={escolaId} anosEscolares={anosEscolares} />
                  </div>
                </div>
                {editando && Object.values(turmas).some(t => t.turma_id === editando.turmaId) && (
                  <EditorDisciplina
                    editando={editando}
                    escolaId={escolaId}
                    onFechar={() => setEditando(null)}
                    onSalvo={salvo}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemProfessor({ p, escolaId }) {
  const [aberto, setAberto] = useState(false);
  const [alocacoes, setAlocacoes] = useState(null);
  const [observacoesAbertasCount, setObservacoesAbertasCount] = useState(0);
  const [observacoesAberto, setObservacoesAberto] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    // Buscar contagem de observações abertas ao montar
    api.buscarObservacoes(p.id, escolaId)
      .then(data => {
        const abertas = (data || []).filter(o => o.status === 'aberta');
        setObservacoesAbertasCount(abertas.length);
      })
      .catch(() => setObservacoesAbertasCount(0));
  }, [p.id, escolaId]);

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
      <button className="painel-professor-cabecalho" onClick={alternar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px' }}>
          <span className="painel-pontos">
            <span className="ponto" style={{ background: STATUS_COR[p.status].cor }} title={STATUS_COR[p.status].label} />
            {tambemDaAula && (
              <span className="ponto" style={{ background: COR_TAMBEM_ENSINA }} title="Também dá aula" />
            )}
            {observacoesAbertasCount > 0 && (
              <span className="ponto" style={{ background: '#f44336' }} title={`${observacoesAbertasCount} observação(ões) aberta(s)`} />
            )}
          </span>
          <div style={{ flex: 1 }}>
            <span className="painel-prof-nome">{p.nome}</span>
            <span className="painel-prof-detalhe">
              matrícula {p.matricula} — {detalhe}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {observacoesAbertasCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setObservacoesAberto(true); }}
              style={{ background: '#f44336', fontSize: '12px', padding: '2px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', height: '24px', color: 'white', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
              title={`${observacoesAbertasCount} observação(ões) aberta(s). Clique para ver.`}
            >
              Obs: {observacoesAbertasCount}
            </button>
          )}
          <span className="painel-professor-seta">{aberto ? '▲' : '▼'}</span>
        </div>
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
          <div>
            <ObservacoesTab professorId={p.id} escolaId={escolaId} />
          </div>
        </div>
      )}

      {observacoesAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'white', width: '100%', maxHeight: '80vh', overflow: 'auto', borderRadius: '12px 12px 0 0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📝 Observações de {p.nome}</h3>
              <button onClick={() => setObservacoesAberto(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <ObservacoesTab professorId={p.id} escolaId={escolaId} />
          </div>
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
        <div style={{ padding: '20px' }}>
          <BlocoGradeTurnos grade={painel.grade} escolaId={escolaId} onMudou={carregar} />
        </div>
      )}
      {secaoAtiva === 'professores' && (
        <BlocoProfessores professores={painel.professores} escolaId={escolaId} />
      )}
    </div>
  );
}
