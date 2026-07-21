import { useEffect, useState } from 'react';
import { api } from './api';

const PERFIL_LABELS = {
  admin: 'Administrador',
  secretaria_central: 'Secretaria Central',
  diretor: 'Diretor',
  visualizacao: 'Visualização',
};

const PERFIS_COM_ESCOLA = new Set(['diretor']);

export default function Acessos({ escolaId, escolas }) {
  const [acessos, setAcessos] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modalSenha, setModalSenha] = useState(null);
  const [resetando, setResetando] = useState(false);

  const [mostrarFormCriar, setMostrarFormCriar] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoLogin, setNovoLogin] = useState('');
  const [novoPerfil, setNovoPerfil] = useState('diretor');
  const [novaEscolaId, setNovaEscolaId] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState('');

  function recarregarAcessos() {
    if (!escolaId) return;
    setCarregando(true);
    setErro('');
    api.buscarAcessos(escolaId)
      .then(setAcessos)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    recarregarAcessos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId]);

  function limparFormCriar() {
    setNovoNome('');
    setNovoLogin('');
    setNovoPerfil('diretor');
    setNovaEscolaId('');
    setErroCriar('');
  }

  async function handleCriarUsuario() {
    if (!novoNome.trim() || !novoLogin.trim()) {
      setErroCriar('Preencha nome e login');
      return;
    }
    if (PERFIS_COM_ESCOLA.has(novoPerfil) && !novaEscolaId) {
      setErroCriar('Escolha a escola desse diretor');
      return;
    }

    setCriando(true);
    setErroCriar('');
    try {
      const result = await api.criarUsuario({
        nome: novoNome.trim(),
        login: novoLogin.trim(),
        perfil: novoPerfil,
        escola_id: PERFIS_COM_ESCOLA.has(novoPerfil) ? Number(novaEscolaId) : null,
      });
      setModalSenha(result);
      limparFormCriar();
      setMostrarFormCriar(false);
      recarregarAcessos();
    } catch (err) {
      setErroCriar(err.message);
    } finally {
      setCriando(false);
    }
  }

  async function handleResetarSenha(usuario) {
    if (!window.confirm(`Tem certeza que quer resetar a senha de ${usuario.nome}?`)) return;

    setResetando(true);
    try {
      const result = await api.resetarSenha(usuario.id);
      setModalSenha(result);
    } catch (err) {
      alert('Erro ao resetar senha: ' + err.message);
    } finally {
      setResetando(false);
    }
  }

  function copiarSenha() {
    navigator.clipboard.writeText(modalSenha.senha_temporaria);
    alert('Senha copiada para clipboard!');
  }

  if (carregando) return <p className="dica">Carregando...</p>;
  if (erro) return <p className="erro">{erro}</p>;

  return (
    <div style={{ padding: '20px' }}>
      <div className="painel-bloco">
        <h2>Gerenciamento de Acessos</h2>
        <p className="painel-legenda">
          Lista de usuários com acesso ao sistema para esta escola.
        </p>
        <button
          type="button"
          onClick={() => setMostrarFormCriar((v) => !v)}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: '8px',
          }}
        >
          {mostrarFormCriar ? '× Cancelar' : '➕ Criar novo usuário'}
        </button>
      </div>

      {mostrarFormCriar && (
        <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Nome</label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                style={{ padding: '8px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Login</label>
              <input
                type="text"
                value={novoLogin}
                onChange={(e) => setNovoLogin(e.target.value)}
                style={{ padding: '8px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Perfil</label>
              <select
                value={novoPerfil}
                onChange={(e) => setNovoPerfil(e.target.value)}
                style={{ padding: '8px', fontSize: '13px' }}
              >
                <option value="admin">Administrador</option>
                <option value="secretaria_central">Secretaria Central</option>
                <option value="diretor">Diretor</option>
                <option value="visualizacao">Visualização</option>
              </select>
            </div>
            {PERFIS_COM_ESCOLA.has(novoPerfil) && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Escola</label>
                <select
                  value={novaEscolaId}
                  onChange={(e) => setNovaEscolaId(e.target.value)}
                  style={{ padding: '8px', fontSize: '13px' }}
                >
                  <option value="">Selecione...</option>
                  {(escolas || []).map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handleCriarUsuario}
              disabled={criando}
              style={{
                background: '#2196f3',
                color: 'white',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '4px',
                cursor: criando ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: criando ? 0.6 : 1,
              }}
            >
              {criando ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
          {erroCriar && <p className="erro" style={{ marginTop: '8px' }}>{erroCriar}</p>}
        </div>
      )}

      {acessos.length === 0 ? (
        <p className="dica">Nenhum usuário encontrado.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '2px solid #666', borderRadius: '6px', height: 'fit-content' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            background: 'white',
          }}>
            <thead>
              <tr style={{ background: '#ccc' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #999' }}>
                  Nome
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #999' }}>
                  Login
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #999' }}>
                  Perfil
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #999' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #999' }}>
                  Criado em
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {acessos.map((acesso, idx) => (
                <tr key={acesso.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px', borderRight: '1px solid #ddd' }}>
                    {acesso.nome}
                  </td>
                  <td style={{ padding: '12px', borderRight: '1px solid #ddd', fontFamily: 'monospace' }}>
                    {acesso.login}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                    <span style={{
                      background: '#e3f2fd',
                      color: '#1976d2',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {PERFIL_LABELS[acesso.perfil] || acesso.perfil}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #ddd' }}>
                    <span style={{
                      background: acesso.ativo ? '#c8e6c9' : '#ffcccc',
                      color: acesso.ativo ? '#2e7d32' : '#c62828',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {acesso.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#666', borderRight: '1px solid #ddd' }}>
                    {new Date(acesso.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleResetarSenha(acesso)}
                      disabled={resetando}
                      style={{
                        background: '#ff9800',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: resetando ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        opacity: resetando ? 0.6 : 1
                      }}
                    >
                      {resetando ? 'Resetting...' : '🔑 Resetar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalSenha && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>🔐 Senha Resetada</h3>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px' }}>
                <strong>Usuário:</strong> {modalSenha.usuario.nome}
              </p>
              <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px' }}>
                <strong>Login:</strong> {modalSenha.usuario.login}
              </p>
            </div>

            <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px' }}>
                <strong>Senha Temporária:</strong>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={modalSenha.senha_temporaria}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    background: 'white'
                  }}
                />
                <button
                  onClick={copiarSenha}
                  style={{
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  📋 Copiar
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#f44336', marginBottom: '16px' }}>
              ⚠️ Compartilhe essa senha com o usuário e peça para trocar na primeira vez que acessar.
            </p>

            <button
              onClick={() => setModalSenha(null)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              OK, Entendi
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '6px' }}>
        <h3>Informações</h3>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li><strong>Administrador:</strong> Acesso total ao sistema (todas as escolas)</li>
          <li><strong>Secretaria Central:</strong> Gerencia todas as escolas</li>
          <li><strong>Diretor:</strong> Acesso restrito à sua escola</li>
          <li><strong>Visualização:</strong> Todas as escolas, apenas consulta (não pode editar nada)</li>
        </ul>
      </div>
    </div>
  );
}
