import { useEffect, useState } from 'react';
import { api } from './api';
import ProfessorPicker from './ProfessorPicker';
import CorrigirCadastroForm from './CorrigirCadastroForm';

const RENDER = {
  vaga: (d) => ({
    categoria: 'Vaga em aberto',
    onde: `Turma ${d.turma} (${d.turno}) — ${d.sigla}`,
    problema: 'Sem professor alocado nessa disciplina/turma.',
  }),
  grade_nome_nao_identificado: (d) => ({
    categoria: 'Grade de aulas',
    onde: `Turma ${d.turma} (${d.turno}) — ${d.sigla}`,
    problema: d.detalhe?.status === 'ambiguo'
      ? `Nome "${d.nomeRaw}" corresponde a mais de uma pessoa: ${(d.detalhe.candidatos || []).map((c) => c.nome).join(' / ')}`
      : `Nome "${d.nomeRaw}" não foi encontrado no cadastro.`,
  }),
  cargo_nome_nao_identificado: (d) => ({
    categoria: 'Cargo/função',
    onde: `"${d.nomeRaw}" (cargo: ${d.cargo})`,
    problema: 'Nome não encontrado no cadastro de professores.',
  }),
  matricula_duplicada: (d) => ({
    categoria: 'Cadastro de professor',
    onde: `Matrícula ${d.matricula}`,
    problema: `Usada por mais de uma pessoa: ${(d.nomes || []).join(' / ')}`,
  }),
  ch_invalido: (d) => ({
    categoria: 'Cadastro de professor',
    onde: `${d.nome} (matrícula ${d.matricula})`,
    problema: `CH informada: "${d.ch}" — ${d.motivo}`,
  }),
  professor_sem_matricula_valida: (d) => ({
    categoria: 'Cadastro de professor',
    onde: d.nome,
    problema: d.motivo,
  }),
  cch_escola_origem_nao_cadastrada: (d) => ({
    categoria: 'CCH (outra escola)',
    onde: `${d.nome} (matrícula ${d.matricula})`,
    problema: d.motivo,
  }),
  aba_ambigua: (d) => ({
    categoria: 'Estrutura da planilha',
    onde: `Aba: ${d.papel}`,
    problema: d.motivo,
  }),
  eja_turma_nao_mapeada: (d) => ({
    categoria: 'EJA',
    onde: `Turma EJA "${d.rotulo}"`,
    problema: d.motivo,
  }),
  eja_turma_duplicada: (d) => ({
    categoria: 'EJA',
    onde: `Turmas: ${(d.turmas || []).join(' / ')}`,
    problema: d.motivo,
  }),
};

// tipos onde dá pra resolver escolhendo um professor direto na tela
const RESOLVIVEL_COM_PROFESSOR = new Set(['vaga', 'grade_nome_nao_identificado']);

// tipos onde a pessoa nem existe no cadastro ainda -- resolver cria o professor
// com o campo corrigido. o valor é quais campos entram como input editável.
const CAMPOS_CADASTRO_POR_TIPO = {
  cargo_nome_nao_identificado: ['matricula', 'ch'],
  ch_invalido: ['ch'],
  professor_sem_matricula_valida: ['matricula'],
};

const CATEGORIA_EXPLICACAO = {
  'Vaga em aberto': 'Não existe nenhum professor atribuído a essa disciplina nessa turma. É preciso escolher quem vai dar essa aula.',
  'Grade de aulas': 'O nome do professor escrito na planilha não bateu com ninguém do cadastro (ou bateu com mais de uma pessoa). É preciso confirmar quem é.',
  'Cargo/função': 'O nome indicado para um cargo (direção, secretaria, orientação, etc.) não foi encontrado no cadastro de professores.',
  'Cadastro de professor': 'Um professor tem um dado inválido ou incompleto no cadastro (matrícula ou carga horária) e por isso não entrou no sistema.',
  'CCH (outra escola)': 'Esse professor também dá aula em outra escola (complementação de carga horária). Não precisa fazer nada agora — isso só fica totalmente conferido quando a outra escola também estiver cadastrada no sistema.',
  'Estrutura da planilha': 'A planilha tinha mais de uma versão de alguma aba (parecidas, mas com conteúdo diferente). Usamos uma delas — vale confirmar com quem preencheu qual é a correta.',
  EJA: 'Uma turma de EJA (Educação de Jovens e Adultos) com nome que não foi reconhecido ou que apareceu duplicada na planilha.',
};

function ItemPendencia({ pendencia, onResolvido }) {
  const [professorId, setProfessorId] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [novoProfessor, setNovoProfessor] = useState(null);
  const [doisProfessores, setDoisProfessores] = useState([null, null]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const render = RENDER[pendencia.tipo];
  const d = pendencia.dados;
  const info = render ? render(d) : { categoria: pendencia.tipo, onde: '-', problema: JSON.stringify(d) };

  const podeEscolherProfessor = RESOLVIVEL_COM_PROFESSOR.has(pendencia.tipo);
  const ehEstagiario = pendencia.tipo === 'professor_sem_matricula_valida' && /estagi/i.test(d.motivo || '');
  const camposCadastro = CAMPOS_CADASTRO_POR_TIPO[pendencia.tipo];
  const usaCadastroForm = !!camposCadastro && !ehEstagiario;
  const ehMatriculaDuplicada = pendencia.tipo === 'matricula_duplicada';
  const usaGenerico = !podeEscolherProfessor && !usaCadastroForm && !ehMatriculaDuplicada;

  function podeEnviar() {
    if (enviando) return false;
    if (podeEscolherProfessor) return !!professorId;
    if (usaCadastroForm) return !!novoProfessor && camposCadastro.every((c) => novoProfessor[c]);
    if (ehMatriculaDuplicada) return doisProfessores.every((p) => p && p.matricula);
    return true;
  }

  async function resolver() {
    setEnviando(true);
    setErro('');
    try {
      let payload;
      if (podeEscolherProfessor) payload = { professor_id: professorId };
      else if (usaCadastroForm) payload = { novo_professor: novoProfessor };
      else if (ehMatriculaDuplicada) payload = { professores: doisProfessores };
      else payload = { observacao };

      await api.resolverPendencia(pendencia.id, payload);
      onResolvido(pendencia.id);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="pendencia">
      <div className="pendencia-cabecalho">
        <span className="categoria">{info.categoria}</span>
        <span className="escola">{pendencia.escola_nome}</span>
      </div>
      <p className="onde">{info.onde}</p>
      <p className="problema">{info.problema}</p>

      {podeEscolherProfessor && <ProfessorPicker onSelect={setProfessorId} escolaId={pendencia.escola_id} />}

      {usaCadastroForm && (
        <CorrigirCadastroForm
          nome={d.nome || d.nomeRaw}
          area={d.area}
          ch={d.ch}
          camposEditaveis={camposCadastro}
          onValores={setNovoProfessor}
        />
      )}

      {ehMatriculaDuplicada && (
        <div className="duas-pessoas">
          {(d.pessoas || []).map((pessoa, i) => (
            <CorrigirCadastroForm
              key={i}
              nome={pessoa.nome}
              area={pessoa.area}
              ch={pessoa.ch}
              camposEditaveis={['matricula']}
              onValores={(valores) => setDoisProfessores((atual) => {
                const novo = [...atual];
                novo[i] = valores;
                return novo;
              })}
            />
          ))}
        </div>
      )}

      {ehEstagiario && (
        <p className="dica">Esse tipo de vínculo (estagiário) não é suportado pelo sistema hoje — só dá pra marcar como resolvida com uma observação.</p>
      )}

      {usaGenerico && (
        <textarea
          placeholder="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      )}

      {erro && <p className="erro">{erro}</p>}
      <button onClick={resolver} disabled={!podeEnviar()}>
        {enviando ? 'Salvando...' : (podeEscolherProfessor || usaCadastroForm || ehMatriculaDuplicada) ? 'Resolver' : 'Marcar como resolvida'}
      </button>
    </li>
  );
}

export default function Pendencias({ usuario, filtroTipo, onLimparFiltro }) {
  const [pendencias, setPendencias] = useState(null);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      setPendencias(await api.listarPendencias());
    } catch (err) {
      setErro(err.message);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function handleResolvido(id) {
    setPendencias((atual) => atual.filter((p) => p.id !== id));
  }

  const visiveis = (pendencias || []).filter((p) => !filtroTipo || p.tipo === filtroTipo);

  const contagemPorCategoria = {};
  for (const p of visiveis) {
    const cat = RENDER[p.tipo] ? RENDER[p.tipo](p.dados).categoria : p.tipo;
    contagemPorCategoria[cat] = (contagemPorCategoria[cat] || 0) + 1;
  }

  return (
    <div className="pendencias-container">
      <header>
        <div>
          <h1>Pendências</h1>
          <p className="subtitulo">{usuario.nome} — {usuario.perfil}</p>
        </div>
      </header>

      {filtroTipo && (
        <p className="painel-filtro-ativo">
          Mostrando só: <strong>{RENDER[filtroTipo] ? RENDER[filtroTipo]({}).categoria : filtroTipo}</strong>
          <button type="button" onClick={onLimparFiltro}>Ver todas</button>
        </p>
      )}

      {erro && <p className="erro">{erro}</p>}

      {pendencias === null && <p>Carregando...</p>}

      {pendencias !== null && visiveis.length === 0 && (
        <p className="vazio">{filtroTipo ? 'Nenhuma pendência desse tipo em aberto.' : 'Nenhuma pendência em aberto. 🎉'}</p>
      )}

      {visiveis.length > 0 && (
        <>
          <div className="resumo">
            {Object.entries(contagemPorCategoria).map(([cat, n]) => (
              <span key={cat} className="chip-wrapper">
                <span className="chip">{cat}: {n}</span>
                <span className="tooltip">{CATEGORIA_EXPLICACAO[cat] || 'Sem explicação cadastrada para esse tipo.'}</span>
              </span>
            ))}
          </div>
          <ul className="lista-pendencias">
            {visiveis.map((p) => (
              <ItemPendencia key={p.id} pendencia={p} onResolvido={handleResolvido} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
