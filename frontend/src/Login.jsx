import { useState } from 'react';
import { api } from './api';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { token, usuario } = await api.login(login, senha);
      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      onLogin(usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Educação Canoas</h1>
        <p className="subtitulo">Acesso por escola</p>
        <label>
          Login
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
        </label>
        <label>
          Senha
          <div className="campo-senha">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button
              type="button"
              className="botao-mostrar-senha"
              onClick={() => setMostrarSenha((v) => !v)}
              tabIndex={-1}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
        <button
          type="button"
          className="link-esqueci-senha"
          onClick={() => setMostrarAjuda((v) => !v)}
        >
          Esqueci minha senha
        </button>
        {mostrarAjuda && (
          <p className="dica-recuperacao">
            Para recuperar o acesso, entre em contato com a secretaria ou com o administrador do sistema para que sua senha seja redefinida.
          </p>
        )}
      </form>
    </div>
  );
}
