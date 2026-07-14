import { useEffect, useState } from 'react';
import { api } from './api';

// Mapeamento de cargos do banco para nomes de exibição
const CARGO_DISPLAY_NAMES = {
  'Diretor': 'Direção',
  'Vice-Diretor': 'Vice Direção',
  'Supervisor': 'Supervisão',
  'Orientador': 'Orientação',
  'Secretaria': 'Secretaria',
  'Readaptação / Auxiliar de secretaria': 'Readaptação / Auxiliar de secretaria',
  'Sala de Recursos': 'Sala de recurso',
  'Assessor Pedagógico': 'Assessor pedagógico',
  'TEB Técnico Ensino Especial': 'TEB Técnico Ensino Especial',
  'Laboratório': 'Laboratório',
  'Estagiário': 'Estagiário',
  'Biblioteca': 'Biblioteca',
  'Readaptado / Auxiliar biblioteca': 'Readaptado / Auxiliar biblioteca',
};

const CARGO_CORES = {
  'Direção': '#c0392b',
  'Vice Direção': '#e74c3c',
  'Supervisão': '#3498db',
  'Orientação': '#2ecc71',
  'Secretaria': '#f39c12',
  'Readaptação / Auxiliar de secretaria': '#e67e22',
  'Assessor pedagógico': '#1abc9c',
  'Sala de recurso': '#16a085',
  'TEB Técnico Ensino Especial': '#8e44ad',
  'Laboratório': '#34495e',
  'Estagiário': '#bdc3c7',
  'Biblioteca': '#95a5a6',
  'Readaptado / Auxiliar biblioteca': '#9b59b6',
};

const CATEGORIAS_ESTRUTURA = {
  gestores: {
    titulo: '👑 Gestores Escolares',
    descricao: 'Direção, Vice Direção, Supervisão e Orientação — Nunca são colocados na grade de aulas',
    cor: '#FF6B6B',
    cargos: ['Diretor', 'Vice-Diretor', 'Supervisor', 'Orientador']
  },
  administrativo: {
    titulo: '📋 Profissional Administrativo',
    descricao: 'Secretaria e Readaptação — Nunca são colocados na grade de aulas',
    cor: '#FFA500',
    cargos: ['Secretaria', 'Readaptação / Auxiliar de secretaria']
  },
  pedagogicos: {
    titulo: '📚 Profissionais Pedagógicos',
    descricao: 'Podem ir para sala de aula em caso de necessidade (ficam em CINZA na grade)',
    cor: '#4ECDC4',
    cargos: ['Sala de Recursos', 'Assessor Pedagógico', 'TEB Técnico Ensino Especial', 'Laboratório', 'Estagiário', 'Biblioteca', 'Readaptado / Auxiliar biblioteca']
  }
};

function ItemAdministrativo({ cargoDisplay, profissionais }) {
  const corFundo = CARGO_CORES[cargoDisplay] || '#7f8c8d';

  if (profissionais.length === 0) {
    return (
      <div className="admin-item">
        <div className="admin-cargo" style={{ background: corFundo }}>
          {cargoDisplay}
        </div>
        <div className="admin-info">
          <div className="admin-nome" style={{ color: '#999', fontStyle: 'italic' }}>
            sem profissional designado
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {profissionais.map((prof, i) => (
        <div key={i} className="admin-item">
          <div className="admin-cargo" style={{ background: corFundo }}>
            {cargoDisplay}
          </div>
          <div className="admin-info">
            <div className="admin-nome">{prof.nome}</div>
            <div className="admin-detalhe">
              Matrícula: {prof.matricula}
              {prof.carga_horaria && ` • ${prof.carga_horaria}h`}
              {prof.alocacoes > 0 && ` • ${prof.alocacoes} alocações`}
            </div>
          </div>
        </div>
      ))}
    </>
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

  return (
    <div>
      <div className="admin-container">
        <h2>Gestão Escolar</h2>
        {Object.entries(CATEGORIAS_ESTRUTURA).map(([chaveCategoria, categoria]) => (
          <div key={chaveCategoria} className="gestao-categoria">
            <h3 style={{ borderLeftColor: categoria.cor }}>
              {categoria.titulo}
            </h3>
            <p className="gestao-descricao">{categoria.descricao}</p>
            <div className="admin-lista">
              {categoria.cargos.map((cargoDb) => {
                const cargoDisplay = CARGO_DISPLAY_NAMES[cargoDb] || cargoDb;
                const profissionaisDoCargo = (dados.profissionais[chaveCategoria] || []).filter(
                  p => p.cargo === cargoDb
                );
                return (
                  <ItemAdministrativo
                    key={cargoDb}
                    cargoDisplay={cargoDisplay}
                    profissionais={profissionaisDoCargo}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
