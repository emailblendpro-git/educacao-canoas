import { useState } from 'react';
import { api } from './api';

const CATEGORIA_COR = {
  'Estrutura da planilha': '#e0e0e0',
  'Cadastro de professor': '#ffe0b2',
  'CCH (outra escola)': '#e1f5fe',
  'Cargo/função': '#f0e6ff',
  'Grade de aulas': '#ffe0b2',
  'Vaga em aberto': '#ffcdd2',
  'EJA': '#c8e6c9',
};

export default function ImportarEscola() {
  const [arquivo, setArquivo] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [analise, setAnalise] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  function handleArquivoChange(e) {
    setArquivo(e.target.files[0] || null);
    setAnalise(null);
    setResultado(null);
    setErro('');
  }

  async function handleAnalisar() {
    if (!arquivo) return;
    setAnalisando(true);
    setErro('');
    setAnalise(null);
    setResultado(null);
    try {
      const data = await api.analisarPlanilhaEscola(arquivo);
      setAnalise(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setAnalisando(false);
    }
  }

  async function handleConfirmar() {
    if (!arquivo) return;
    if (!window.confirm(`Confirma a importação de "${analise.nomeEscola}"? Os dados serão gravados no banco.`)) return;
    setConfirmando(true);
    setErro('');
    try {
      const data = await api.confirmarImportacaoEscola(arquivo);
      setResultado(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setConfirmando(false);
    }
  }

  async function handleBaixarRelatorio() {
    if (!arquivo) return;
    setBaixando(true);
    try {
      const blob = await api.baixarRelatorioPendenciasEscola(arquivo);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pendencias-${(analise?.nomeEscola || 'escola').replace(/[^a-z0-9]+/gi, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Erro ao baixar relatório: ' + err.message);
    } finally {
      setBaixando(false);
    }
  }

  function handleReiniciar() {
    setArquivo(null);
    setAnalise(null);
    setResultado(null);
    setErro('');
  }

  return (
    <div style={{ padding: '20px' }}>
      <div className="painel-bloco">
        <h2>Importar Escola</h2>
        <p className="painel-legenda">
          Envie o "Quadro de Organização Administrativa e Pedagógica" (.xlsx) de uma escola para cadastrá-la
          no sistema junto com professores, turmas e alocações. Primeiro é feita uma análise (nada é gravado);
          depois de conferir o resumo e as pendências, confirme a importação.
        </p>
      </div>

      {!resultado && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '16px 0' }}>
          <input type="file" accept=".xlsx" onChange={handleArquivoChange} />
          <button
            onClick={handleAnalisar}
            disabled={!arquivo || analisando}
            style={{
              background: '#2196f3', color: 'white', border: 'none',
              padding: '8px 16px', borderRadius: '4px',
              cursor: (!arquivo || analisando) ? 'not-allowed' : 'pointer',
              opacity: (!arquivo || analisando) ? 0.6 : 1, fontWeight: 'bold',
            }}
          >
            {analisando ? 'Analisando...' : 'Analisar planilha'}
          </button>
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      {analise && !resultado && (
        <div>
          <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0' }}>
              {analise.nomeEscola}
              {analise.escolaJaExiste && (
                <span style={{ marginLeft: '8px', fontSize: '12px', background: '#fff3cd', color: '#856404', padding: '4px 8px', borderRadius: '4px' }}>
                  já cadastrada — dados serão adicionados/atualizados
                </span>
              )}
            </h3>
            <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px' }}>
              <li>Professores no roster (RH): {analise.resumo.professoresNoRoster}</li>
              <li>Turmas identificadas: {analise.resumo.turmasIdentificadas}</li>
              <li>Alocações resolvidas: {analise.resumo.alocacoesResolvidas}</li>
              <li>Pendências encontradas: {analise.resumo.totalPendencias}</li>
            </ul>
          </div>

          {analise.pendencias.length > 0 && (
            <div style={{ overflowX: 'auto', border: '2px solid #666', borderRadius: '6px', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#ccc' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #999' }}>Categoria</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #999' }}>Onde</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #999' }}>Problema</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>O que fazer</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.pendencias.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px', borderRight: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                        <span style={{ background: CATEGORIA_COR[p.categoria] || '#eee', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                          {p.categoria}
                        </span>
                      </td>
                      <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>{p.onde}</td>
                      <td style={{ padding: '10px', borderRight: '1px solid #ddd' }}>{p.problema}</td>
                      <td style={{ padding: '10px' }}>{p.oQueFazer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              style={{
                background: '#4CAF50', color: 'white', border: 'none',
                padding: '10px 20px', borderRadius: '4px',
                cursor: confirmando ? 'not-allowed' : 'pointer',
                opacity: confirmando ? 0.6 : 1, fontWeight: 'bold',
              }}
            >
              {confirmando ? 'Importando...' : 'Confirmar importação'}
            </button>
            {analise.pendencias.length > 0 && (
              <button
                onClick={handleBaixarRelatorio}
                disabled={baixando}
                style={{
                  background: '#ff9800', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: '4px',
                  cursor: baixando ? 'not-allowed' : 'pointer',
                  opacity: baixando ? 0.6 : 1, fontWeight: 'bold',
                }}
              >
                {baixando ? 'Baixando...' : '📥 Baixar relatório de pendências'}
              </button>
            )}
            <button
              onClick={handleReiniciar}
              style={{ background: '#eee', border: '1px solid #ccc', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '6px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>
            ✅ Importação concluída — {resultado.nomeEscola}
            {resultado.escolaJaExistia && ' (escola já existente, dados complementados)'}
          </h3>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px' }}>
            <li>Professores novos: {resultado.novosProfessores}</li>
            <li>Turmas novas: {resultado.novasTurmas}</li>
            <li>Lotações novas: {resultado.lotacoesCount}</li>
            <li>Alocações novas: {resultado.alocCount}</li>
            <li>Pendências registradas: {resultado.pendenciasNovas}</li>
          </ul>
          <button
            onClick={handleReiniciar}
            style={{ background: '#2196f3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}
          >
            Importar outra escola
          </button>
        </div>
      )}
    </div>
  );
}
