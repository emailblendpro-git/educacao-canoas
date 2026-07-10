import { useEffect, useState } from 'react';
import { api } from './api';

const TIPOS_OCORRENCIA = ['geral', 'atestado', 'falta', 'atraso', 'aviso', 'elogio'];

function OcorrenciasTab({ professorId, escolaId }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [novaOcorrencia, setNovaOcorrencia] = useState({
    titulo: '',
    descricao: '',
    tipo: 'geral'
  });

  useEffect(() => {
    carregarOcorrencias();
  }, [professorId]);

  async function carregarOcorrencias() {
    setCarregando(true);
    setErro('');
    try {
      const response = await fetch(
        `http://localhost:3000/professores/${professorId}/ocorrencias?escolaId=${escolaId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      if (!response.ok) throw new Error('Erro ao carregar ocorrências');
      const data = await response.json();
      setOcorrencias(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarOcorrencia() {
    if (!novaOcorrencia.titulo.trim()) {
      setErro('Título é obrigatório');
      return;
    }

    setErro('');
    try {
      const response = await fetch(
        `http://localhost:3000/professores/${professorId}/ocorrencias`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            ...novaOcorrencia,
            escolaId
          })
        }
      );
      if (!response.ok) throw new Error('Erro ao adicionar ocorrência');

      setNovaOcorrencia({ titulo: '', descricao: '', tipo: 'geral' });
      setAdicionando(false);
      carregarOcorrencias();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function deletarOcorrencia(ocorrenciaId) {
    if (!confirm('Confirmar exclusão?')) return;

    try {
      const response = await fetch(
        `http://localhost:3000/professores/${professorId}/ocorrencias/${ocorrenciaId}?escolaId=${escolaId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      if (!response.ok) throw new Error('Erro ao deletar ocorrência');
      carregarOcorrencias();
    } catch (err) {
      setErro(err.message);
    }
  }

  const corTipo = {
    geral: '#2196F3',
    atestado: '#FF9800',
    falta: '#F44336',
    atraso: '#FFC107',
    aviso: '#E91E63',
    elogio: '#4CAF50'
  };

  return (
    <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '13px' }}>Ocorrências</h4>

      {erro && <p style={{ color: '#F44336', fontSize: '12px', margin: '0 0 8px 0' }}>{erro}</p>}

      {carregando ? (
        <p style={{ fontSize: '12px', color: '#999' }}>Carregando...</p>
      ) : ocorrencias.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#999' }}>Nenhuma ocorrência registrada</p>
      ) : (
        <div style={{ marginBottom: '12px', maxHeight: '300px', overflowY: 'auto' }}>
          {ocorrencias.map(occ => (
            <div
              key={occ.id}
              style={{
                padding: '8px',
                marginBottom: '6px',
                background: 'white',
                border: `2px solid ${corTipo[occ.tipo]}`,
                borderRadius: '4px',
                fontSize: '11px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                <strong style={{ color: corTipo[occ.tipo] }}>{occ.titulo}</strong>
                <button
                  onClick={() => deletarOcorrencia(occ.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '0 4px',
                    fontSize: '14px'
                  }}
                  title="Deletar"
                >
                  ✕
                </button>
              </div>
              {occ.descricao && <p style={{ margin: '4px 0', color: '#666' }}>{occ.descricao}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#999' }}>
                <span>{new Date(occ.data_ocorrencia).toLocaleDateString('pt-BR')}</span>
                <span>{occ.tipo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {adicionando ? (
        <div style={{ background: 'white', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Título *"
            value={novaOcorrencia.titulo}
            onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, titulo: e.target.value })}
            style={{ width: '100%', padding: '6px', marginBottom: '6px', fontSize: '11px', boxSizing: 'border-box' }}
          />
          <textarea
            placeholder="Descrição"
            value={novaOcorrencia.descricao}
            onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, descricao: e.target.value })}
            style={{ width: '100%', padding: '6px', marginBottom: '6px', fontSize: '11px', boxSizing: 'border-box', minHeight: '50px' }}
          />
          <select
            value={novaOcorrencia.tipo}
            onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, tipo: e.target.value })}
            style={{ width: '100%', padding: '6px', marginBottom: '6px', fontSize: '11px' }}
          >
            {TIPOS_OCORRENCIA.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={adicionarOcorrencia}
              style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
            >
              Salvar
            </button>
            <button
              onClick={() => setAdicionando(false)}
              style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#999', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdicionando(true)}
          style={{ width: '100%', padding: '8px', fontSize: '11px', background: '#2196F3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
        >
          + Adicionar Ocorrência
        </button>
      )}
    </div>
  );
}

export default OcorrenciasTab;
