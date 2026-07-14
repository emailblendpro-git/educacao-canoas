import { useEffect, useState } from 'react';
import { api } from './api';

// Ordem EXATA das disciplinas (mesma da GRADE DE AULAS)
const DISCIPLINAS_1A5_ESQUERDA = ['LP', 'ER', 'M', 'C', 'H', 'G'];
const DISCIPLINAS_1A5_DIREITA = ['PPA', 'PLL', 'TICs', 'A', 'EF'];
const DISCIPLINAS_6A9 = ['LP', 'LI', 'M', 'C', 'H', 'G', 'EF', 'ER', 'A'];

// Apenas estas disciplinas podem ser editadas na Matriz Curricular
const DISCIPLINAS_EDITAVEIS = ['PPA', 'PLL', 'TICs', 'A'];

const ANOS_1A5 = ['1', '2', '3', '4', '5'];
const ANOS_6A9 = ['6', '7', '8', '9'];

function EditarCelula({ valor, onSave, editavel }) {
  const [editando, setEditando] = useState(false);
  const [novoValor, setNovoValor] = useState(valor || 0);

  function handleSalvar() {
    onSave(Number(novoValor));
    setEditando(false);
  }

  if (!editavel) {
    return (
      <span
        style={{
          fontWeight: '600',
          display: 'block',
          padding: '4px 6px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#666',
        }}
        title={`${valor || 0} períodos/semana (não editável)`}
      >
        {valor || 0}
      </span>
    );
  }

  return editando ? (
    <input
      type="number"
      min="0"
      max="20"
      value={novoValor}
      onChange={(e) => setNovoValor(e.target.value)}
      onBlur={handleSalvar}
      onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
      style={{
        width: '100%',
        padding: '4px 6px',
        border: '1px solid var(--accent)',
        borderRadius: '3px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: '600',
      }}
      autoFocus
    />
  ) : (
    <span
      onClick={() => setEditando(true)}
      style={{
        cursor: 'pointer',
        fontWeight: '600',
        display: 'block',
        padding: '4px 6px',
        textAlign: 'center',
        fontSize: '12px',
      }}
      title={`${valor || 0} períodos/semana`}
    >
      {valor || 0}
    </span>
  );
}

function TabelaMatriz({ anos, disciplinas, disciplinasDireita, matrizPorAno, onAtualizar }) {
  function calcularTotal(ano, mapDisciplinas) {
    const allDisciplinas = [...disciplinas, ...(disciplinasDireita || [])];
    return allDisciplinas.reduce((sum, sigla) => {
      const d = mapDisciplinas[sigla];
      return sum + (d?.periodos_semana || 0);
    }, 0);
  }

  function getCorTotal(total) {
    if (total < 20) return '#f2b200'; // amarelo
    if (total === 20) return '#000000'; // preto
    return '#c0392b'; // vermelho
  }

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
              Ano
            </th>
            {disciplinas.map(s => (
              <th key={s} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '600', width: '38px', borderRight: '1px solid #ddd' }}>
                {s}
              </th>
            ))}
            {disciplinasDireita && (
              <>
                <th style={{ width: '8px', background: 'white' }}></th>
                {disciplinasDireita.map(s => (
                  <th key={s} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '600', width: '38px', borderRight: '1px solid #ddd' }}>
                    {s}
                  </th>
                ))}
              </>
            )}
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600', width: '50px', borderLeft: '1px solid #999' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {anos.map(ano => {
            const lista = matrizPorAno[ano] || [];
            const mapDisciplinas = {};
            lista.forEach(d => {
              mapDisciplinas[d.sigla] = d;
            });
            const total = calcularTotal(ano, mapDisciplinas);
            const corTotal = getCorTotal(total);

            return (
              <tr key={ano} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: '600', background: '#f9f9f9', borderRight: '1px solid #999' }}>
                  {ano}º
                </td>
                {disciplinas.map(s => {
                  const d = mapDisciplinas[s];
                  const editavel = DISCIPLINAS_EDITAVEIS.includes(s);
                  return (
                    <td key={s} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                      {d ? (
                        <EditarCelula
                          valor={d.periodos_semana}
                          onSave={(val) => onAtualizar(ano, d.disciplina_id, val)}
                          editavel={editavel}
                        />
                      ) : (
                        <span style={{ color: '#ddd' }}>-</span>
                      )}
                    </td>
                  );
                })}
                {disciplinasDireita && (
                  <>
                    <td style={{ width: '8px', background: 'white', borderRight: '8px solid white' }}></td>
                    {disciplinasDireita.map(s => {
                      const d = mapDisciplinas[s];
                      const editavel = DISCIPLINAS_EDITAVEIS.includes(s);
                      return (
                        <td key={s} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                          {d ? (
                            <EditarCelula
                              valor={d.periodos_semana}
                              onSave={(val) => onAtualizar(ano, d.disciplina_id, val)}
                              editavel={editavel}
                            />
                          ) : (
                            <span style={{ color: '#ddd' }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </>
                )}
                <td style={{
                  padding: '4px 8px',
                  textAlign: 'center',
                  fontWeight: '600',
                  background: '#f9f9f9',
                  borderLeft: '1px solid #999',
                  color: corTotal,
                  fontSize: '13px'
                }}>
                  {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MatrizCurricular({ escolaId, anosEscolares }) {
  const [matriz, setMatriz] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!escolaId) return;
    setErro('');
    api.buscarMatrizCurricular(escolaId)
      .then(setMatriz)
      .catch((err) => {
        console.error('Erro ao buscar matriz:', err);
        setErro(err.message);
      });
  }, [escolaId]);

  async function handleAtualizar(ano, disciplinaId, periodos) {
    try {
      await api.atualizarMatrizCurricular(escolaId, ano, disciplinaId, periodos);
      setMatriz(prev => ({
        matrizPorAno: {
          ...prev.matrizPorAno,
          [ano]: prev.matrizPorAno[ano].map(d =>
            d.disciplina_id === disciplinaId
              ? { ...d, periodos_semana: periodos }
              : d
          ),
        },
      }));
    } catch (err) {
      setErro('Erro ao atualizar: ' + err.message);
    }
  }

  if (!escolaId) return <p style={{ color: '#999' }}>Selecione uma escola.</p>;
  if (erro) return <p style={{ color: '#f44336' }}>{erro}</p>;
  if (!matriz) return <p>Carregando matriz...</p>;

  // Mostra só os blocos (1º-5º / 6º-9º) para as séries que realmente existem neste turno
  const anosDisponiveis = anosEscolares && anosEscolares.length ? anosEscolares : [...ANOS_1A5, ...ANOS_6A9];
  const anos1a5 = ANOS_1A5.filter(a => anosDisponiveis.includes(a));
  const anos6a9 = ANOS_6A9.filter(a => anosDisponiveis.includes(a));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {anos1a5.length > 0 && (
        <TabelaMatriz
          anos={anos1a5}
          disciplinas={DISCIPLINAS_1A5_ESQUERDA}
          disciplinasDireita={DISCIPLINAS_1A5_DIREITA}
          matrizPorAno={matriz.matrizPorAno}
          onAtualizar={handleAtualizar}
        />
      )}
      {anos6a9.length > 0 && (
        <TabelaMatriz
          anos={anos6a9}
          disciplinas={DISCIPLINAS_6A9}
          disciplinasDireita={null}
          matrizPorAno={matriz.matrizPorAno}
          onAtualizar={handleAtualizar}
        />
      )}
    </div>
  );
}
