import { useState } from 'react';
import { api } from './api';

export default function ProfessorPicker({ onSelect, escolaId }) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [abriu, setAbriu] = useState(false);

  async function buscar(valor) {
    setBuscando(true);
    setErro('');
    try {
      setOpcoes(await api.buscarProfessores(valor, escolaId));
    } catch (err) {
      setOpcoes([]);
      setErro(`Não foi possível buscar: ${err.message}`);
    } finally {
      setBuscando(false);
    }
  }

  function handleFocus() {
    setAbriu(true);
    // sem nada digitado ainda -- mostra a lista completa de professores da
    // escola (a API já devolve isso quando ?busca= vem vazio).
    if (!selecionado) buscar(busca);
  }

  function handleChange(e) {
    const valor = e.target.value;
    setBusca(valor);
    setSelecionado(null);
    onSelect(null);
    buscar(valor);
  }

  function escolher(prof) {
    setSelecionado(prof);
    setBusca(`${prof.nome} (matrícula ${prof.matricula})`);
    setOpcoes([]);
    setAbriu(false);
    onSelect(prof.id);
  }

  return (
    <div className="professor-picker">
      <input
        placeholder="Clique para ver a lista, ou digite pra filtrar..."
        value={busca}
        onChange={handleChange}
        onFocus={handleFocus}
      />
      {buscando && <p className="dica">Buscando...</p>}
      {erro && <p className="erro">{erro}</p>}
      {abriu && opcoes.length > 0 && (
        <ul className="opcoes">
          {opcoes.map((p) => (
            <li key={p.id} onClick={() => escolher(p)}>
              {p.nome} <span className="matricula">matrícula {p.matricula}</span>
            </li>
          ))}
        </ul>
      )}
      {abriu && !buscando && !erro && opcoes.length === 0 && !selecionado && (
        <p className="dica">Nenhum professor encontrado nesta escola.</p>
      )}
    </div>
  );
}
