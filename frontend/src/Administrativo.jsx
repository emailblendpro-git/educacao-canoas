import { useEffect, useState } from 'react';
import { api } from './api';

const CARGO_CORES = {
  'Diretor': '#c0392b',
  'Vice-Diretor': '#e74c3c',
  'Supervisor': '#3498db',
  'Orientador': '#2ecc71',
  'Assessor Pedagógico': '#f39c12',
  'TEB': '#9b59b6',
  'Sala de Recursos': '#1abc9c',
  'Laboratório de Aprendizagem': '#34495e',
  'Biblioteca': '#16a085',
  'Readaptado': '#95a5a6',
  'Estagiário': '#bdc3c7',
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

export default function Administrativo({ escolaId }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!escolaId) return;
    setErro('');
    api.buscarAdministrativo(escolaId)
      .then(setDados)
      .catch((err) => {
        console.error('Erro ao buscar administrativos:', err);
        setErro(err.message);
      });
  }, [escolaId]);

  if (!escolaId) return <p className="dica">Selecione uma escola.</p>;
  if (erro) return <p className="erro">{erro}</p>;
  if (!dados) return <p>Carregando...</p>;

  const agrupadosCargo = {};
  dados.administrativos.forEach(admin => {
    if (!agrupadosCargo[admin.cargo]) {
      agrupadosCargo[admin.cargo] = [];
    }
    agrupadosCargo[admin.cargo].push(admin);
  });

  return (
    <div>
      <div className="admin-container">
        <h2>Corpo Administrativo</h2>
        <div className="admin-lista">
          {dados.administrativos.length === 0 ? (
            <p className="dica">Nenhum funcionário administrativo cadastrado.</p>
          ) : (
            dados.administrativos.map((admin, i) => (
              <ItemAdministrativo key={i} admin={admin} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
