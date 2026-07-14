import { useEffect, useState } from 'react';
import { api } from './api';

const CARGO_CORES = {
  'Diretor': '#c0392b',
  'Vice-Diretor': '#e74c3c',
  'Supervisor': '#3498db',
  'Orientação': '#2ecc71',
  'Secretaria': '#f39c12',
  'Readaptação / Auxiliar de secretaria': '#e67e22',
  'Assessor Pedagógico': '#1abc9c',
  'Sala de Recursos': '#16a085',
  'TEB': '#8e44ad',
  'Laboratório de Aprendizagem': '#34495e',
  'Estagiário': '#bdc3c7',
  'Biblioteca': '#95a5a6',
  'Readaptado / Auxiliar biblioteca': '#9b59b6',
};

const CATEGORIAS_INFO = {
  gestores: {
    titulo: '👑 Gestores Escolares',
    descricao: 'Direção, Vice Direção, Supervisão e Orientação — Nunca são colocados na grade de aulas',
    cor: '#FF6B6B'
  },
  administrativo: {
    titulo: '📋 Profissional Administrativo',
    descricao: 'Secretaria e Readaptação — Nunca são colocados na grade de aulas',
    cor: '#FFA500'
  },
  pedagogicos: {
    titulo: '📚 Profissionais Pedagógicos',
    descricao: 'Podem ir para sala de aula em caso de necessidade (ficam em CINZA na grade)',
    cor: '#4ECDC4'
  },
  outros: {
    titulo: '📌 Outros',
    descricao: 'Profissionais sem categoria definida',
    cor: '#C0C0C0'
  }
};

function ItemAdministrativo({ admin }) {
  const corFundo = CARGO_CORES[admin.cargo] || '#7f8c8d';

  return (
    <div className="admin-item">
      <div className="admin-cargo" style={{ background: corFundo }}>
        {admin.cargo}
      </div>
      <div className="admin-info">
        <div className="admin-nome">{admin.nome}</div>
        <div className="admin-detalhe">
          Matrícula: {admin.matricula}
          {admin.carga_horaria && ` • ${admin.carga_horaria}h`}
          {admin.alocacoes > 0 && ` • ${admin.alocacoes} alocações`}
        </div>
      </div>
    </div>
  );
}

export default function GestaoEscolar({ escolaId }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!escolaId) return;
    setErro('');
    api.buscarGestaoEscolar(escolaId)
      .then(setDados)
      .catch((err) => {
        console.error('Erro ao buscar gestão escolar:', err);
        setErro(err.message);
      });
  }, [escolaId]);

  if (!escolaId) return <p className="dica">Selecione uma escola.</p>;
  if (erro) return <p className="erro">{erro}</p>;
  if (!dados) return <p>Carregando...</p>;

  const todasAsCategorias = Object.keys(dados.profissionais || {});
  const temProfissionais = todasAsCategorias.some(cat => dados.profissionais[cat].length > 0);

  return (
    <div>
      <div className="admin-container">
        <h2>Gestão Escolar</h2>
        {temProfissionais ? (
          todasAsCategorias.map(categoria => (
            dados.profissionais[categoria].length > 0 && (
              <div key={categoria} className="gestao-categoria">
                <h3 style={{ borderLeftColor: CATEGORIAS_INFO[categoria].cor }}>
                  {CATEGORIAS_INFO[categoria].titulo}
                </h3>
                <p className="gestao-descricao">{CATEGORIAS_INFO[categoria].descricao}</p>
                <div className="admin-lista">
                  {dados.profissionais[categoria].map((prof, i) => (
                    <ItemAdministrativo key={i} admin={prof} />
                  ))}
                </div>
              </div>
            )
          ))
        ) : (
          <p className="dica">Nenhum profissional de gestão cadastrado.</p>
        )}
      </div>
    </div>
  );
}
