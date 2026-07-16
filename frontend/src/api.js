const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.erro || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  login: (login, senha) => request('/auth/login', { method: 'POST', body: JSON.stringify({ login, senha }) }),
  listarPendencias: () => request('/pendencias'),
  buscarProfessores: (busca, escolaId) => request(`/professores?busca=${encodeURIComponent(busca || '')}${escolaId ? `&escola_id=${escolaId}` : ''}`),
  resolverPendencia: (id, payload) => request(`/pendencias/${id}/resolver`, { method: 'PATCH', body: JSON.stringify(payload) }),
  listarEscolas: () => request('/escolas'),
  buscarPainel: (escolaId) => request(`/escolas/${escolaId}/painel`),
  buscarGestaoEscolar: (escolaId) => request(`/escolas/${escolaId}/gestao-escolar`),
  buscarAlocacoesProfessor: (id, escolaId) => request(`/professores/${id}/alocacoes?escola_id=${escolaId}`),
  atribuirDisciplina: (turmaId, disciplinaSigla, professorId) =>
    request(`/turmas/${turmaId}/alocacoes`, {
      method: 'PATCH',
      body: JSON.stringify({ disciplina_sigla: disciplinaSigla, professor_id: professorId }),
    }),
  exportarExcel: async (escolaId) => {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/escolas/${escolaId}/exportar`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    if (!res.ok) throw new Error('Erro ao exportar');
    return res.blob();
  },
  buscarMatrizCurricular: (escolaId) => request(`/escolas/${escolaId}/matriz-curricular`),
  atualizarMatrizCurricular: (escolaId, anoEscolar, disciplinaId, periodos) =>
    request(`/escolas/${escolaId}/matriz-curricular/${anoEscolar}/${disciplinaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ periodos_semana: periodos }),
    }),
  buscarObservacoes: (professorId, escolaId) =>
    request(`/professores/${professorId}/observacoes?escolaId=${escolaId}`),
  adicionarObservacao: (professorId, data, texto, escolaId) =>
    request(`/professores/${professorId}/observacoes`, {
      method: 'POST',
      body: JSON.stringify({ data, texto, escolaId }),
    }),
  encerrarObservacao: (professorId, obsId, escolaId) =>
    request(`/professores/${professorId}/observacoes/${obsId}/encerrar?escolaId=${escolaId}`, {
      method: 'PATCH',
    }),
  deletarObservacao: (professorId, obsId, escolaId) =>
    request(`/professores/${professorId}/observacoes/${obsId}?escolaId=${escolaId}`, {
      method: 'DELETE',
    }),
  buscarAcessos: (escolaId) => request(`/escolas/${escolaId}/acessos`),
};
