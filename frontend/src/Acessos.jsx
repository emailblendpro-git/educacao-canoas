import { useEffect, useState } from 'react';
import { api } from './api';

const PERFIL_LABELS = {
  admin: 'Administrador',
  secretaria_central: 'Secretaria Central',
  diretor: 'Diretor',
  visualizacao: 'Visualização',
};

export default function Acessos({ escolaId }) {
  const [acessos, setAcessos] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    setCarregando(true);
    setErro('');
    api.buscarAcessos(escolaId)
      .then(setAcessos)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [escolaId]);

  if (carregando) return <p className="dica">Carregando...</p>;
  if (erro) return <p className="erro">{erro}</p>;

  return (
    <div style={{ padding: '20px' }}>
      <div className="painel-bloco">
        <h2>Gerenciamento de Acessos</h2>
        <p className="painel-legenda">
          Lista de usuários com acesso ao sistema para esta escola.
        </p>
      </div>

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
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                  Criado em
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
                  <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                    {new Date(acesso.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '6px' }}>
        <h3>Informações</h3>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li><strong>Administrador:</strong> Acesso total ao sistema</li>
          <li><strong>Secretaria Central:</strong> Gerencia todas as escolas</li>
          <li><strong>Diretor:</strong> Acesso restrito à sua escola</li>
          <li><strong>Visualização:</strong> Apenas consulta dados</li>
        </ul>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
          📝 Nota: Para criar novos usuários ou resetar senhas, entre em contato com o administrador do sistema.
        </p>
      </div>
    </div>
  );
}
