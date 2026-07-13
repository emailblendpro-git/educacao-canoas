import { useEffect, useState } from 'react';
import { api } from './api';

export default function ObservacoesTab({ professorId, escolaId }) {
  const [observacoes, setObservacoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [novaData, setNovaData] = useState(new Date().toISOString().split('T')[0]);
  const [novoTexto, setNovoTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarObservacoes();
  }, [professorId, escolaId]);

  async function carregarObservacoes() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/professores/${professorId}/observacoes?escolaId=${escolaId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar observações');
      const dados = await res.json();
      setObservacoes(dados || []);
    } catch (err) {
      console.error(err);
      setErro(err.message);
    }
  }

  async function adicionarObservacao() {
    if (!novoTexto.trim()) {
      setErro('Escreva uma observação');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/professores/${professorId}/observacoes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ data: novaData, texto: novoTexto, escolaId }),
        }
      );
      if (!res.ok) throw new Error('Erro ao adicionar observação');
      setNovoTexto('');
      setNovaData(new Date().toISOString().split('T')[0]);
      await carregarObservacoes();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function encerrarObservacao(obsId) {
    if (!confirm('Encerrar esta observação?')) return;

    setCarregando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/professores/${professorId}/observacoes/${obsId}/encerrar?escolaId=${escolaId}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Erro ao encerrar observação');
      await carregarObservacoes();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function deletarObservacao(obsId) {
    if (!confirm('Deletar esta observação?')) return;

    setCarregando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/professores/${professorId}/observacoes/${obsId}?escolaId=${escolaId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Erro ao deletar observação');
      await carregarObservacoes();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  const abertas = observacoes.filter(o => o.status === 'aberta');
  const encerradas = observacoes.filter(o => o.status === 'encerrada');

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid #ddd', paddingTop: '12px' }}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          color: '#2196F3',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        📝 Observações ({abertas.length} aberta{abertas.length !== 1 ? 's' : ''})
      </button>

      {aberto && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                Data
              </label>
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                style={{ padding: '6px', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                Observação
              </label>
              <textarea
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                placeholder="Ex: Atestado médico 2 dias, Saída emergencial..."
                rows="2"
                style={{
                  padding: '6px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  width: '100%',
                  maxWidth: '400px',
                }}
              />
            </div>
            <button
              type="button"
              onClick={adicionarObservacao}
              disabled={carregando || !novoTexto.trim()}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: carregando ? 0.6 : 1,
              }}
            >
              {carregando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>

          {erro && <p style={{ color: '#d32f2f', fontSize: '12px', marginBottom: '12px' }}>{erro}</p>}

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>🔴 Abertas ({abertas.length})</h4>
            {abertas.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#666' }}>Nenhuma observação aberta</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {abertas.map((obs) => (
                  <li
                    key={obs.id}
                    style={{
                      padding: '8px',
                      background: '#fff3cd',
                      border: '1px solid #ffeaa7',
                      borderRadius: '4px',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <strong>{obs.data}</strong> — {obs.texto}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => encerrarObservacao(obs.id)}
                          disabled={carregando}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          Encerrar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletarObservacao(obs.id)}
                          disabled={carregando}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {encerradas.length > 0 && (
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>✅ Histórico ({encerradas.length})</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {encerradas.map((obs) => (
                  <li
                    key={obs.id}
                    style={{
                      padding: '8px',
                      background: '#e8f5e9',
                      border: '1px solid #c8e6c9',
                      borderRadius: '4px',
                      marginBottom: '6px',
                      fontSize: '12px',
                      color: '#666',
                    }}
                  >
                    <strong>{obs.data}</strong> — {obs.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
