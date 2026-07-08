import { useEffect, useState } from 'react';
import Login from './Login';
import Pendencias from './Pendencias';
import Painel from './Painel';
import Administrativo from './Administrativo';
import { api } from './api';
import './App.css';

function usuarioSalvo() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

const PERFIS_GLOBAIS = new Set(['admin', 'secretaria_central']);

export default function App() {
  const [usuario, setUsuario] = useState(usuarioSalvo());
  const [tela, setTela] = useState('pendencias');
  const [escolas, setEscolas] = useState([]);
  const [escolaSelecionada, setEscolaSelecionada] = useState(null);
  const [filtroPendencias, setFiltroPendencias] = useState(null);
  const [escolaNomeAtual, setEscolaNomeAtual] = useState('');

  function irParaPendencias(filtro) {
    setFiltroPendencias(filtro);
    setTela('pendencias');
  }

  const vePerfilGlobal = !!usuario && PERFIS_GLOBAIS.has(usuario.perfil);

  useEffect(() => {
    if (usuario && vePerfilGlobal) {
      api.listarEscolas()
        .then((lista) => {
          setEscolas(lista);
          if (lista.length) setEscolaSelecionada(lista[0].id);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  const escolaId = vePerfilGlobal ? escolaSelecionada : usuario.escolaId;
  const escolaSelecionadaNome = escolas.find(e => e.id === escolaSelecionada)?.nome || escolaNomeAtual;

  return (
    <div>
      <nav className="app-nav">
        <div className="app-nav-esquerda">
          <button
            className={tela === 'pendencias' ? 'nav-ativo' : ''}
            onClick={() => { setFiltroPendencias(null); setTela('pendencias'); }}
          >
            Pendências
          </button>
          <button
            className={tela === 'painel' ? 'nav-ativo' : ''}
            onClick={() => setTela('painel')}
          >
            Painel
          </button>
          <button
            className={tela === 'administrativo' ? 'nav-ativo' : ''}
            onClick={() => setTela('administrativo')}
          >
            Administrativo
          </button>

          {vePerfilGlobal && (
            <select
              value={escolaSelecionada || ''}
              onChange={(e) => setEscolaSelecionada(Number(e.target.value))}
            >
              {escolas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          )}
        </div>

        {escolaSelecionadaNome && <div className="app-nav-titulo">{escolaSelecionadaNome}</div>}

        <button className="sair" onClick={handleLogout}>Sair</button>
      </nav>

      {tela === 'pendencias' && <Pendencias usuario={usuario} filtroTipo={filtroPendencias} onLimparFiltro={() => setFiltroPendencias(null)} />}
      {tela === 'painel' && <Painel escolaId={escolaId} onVerPendencias={irParaPendencias} onEscolaNomeChange={setEscolaNomeAtual} />}
      {tela === 'administrativo' && <Administrativo escolaId={escolaId} />}
    </div>
  );
}
