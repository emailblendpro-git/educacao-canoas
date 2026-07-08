import { useState } from 'react';

const CH_OPCOES = [10, 20, 40];
const VINCULO_OPCOES = [
  { value: 'concursado', label: 'Concursado' },
  { value: 'contratado', label: 'Contratado' },
];

// Formulário reutilizado pelos 4 tipos de pendência de cadastro (nome sem
// matrícula, CH inválida, matrícula ausente/duplicada). Só mostra como campo
// editável o que realmente está errado/faltando -- o resto (nome, área, CH já
// válida) aparece como texto fixo, pra não pedir de novo o que já se sabe.
export default function CorrigirCadastroForm({ nome, area, ch, camposEditaveis, onValores }) {
  const [matricula, setMatricula] = useState('');
  const [chEditado, setChEditado] = useState(ch && CH_OPCOES.includes(ch) ? ch : '');
  const [tipoVinculo, setTipoVinculo] = useState('concursado');

  const editaMatricula = camposEditaveis.includes('matricula');
  const editaCh = camposEditaveis.includes('ch');

  function atualizar(patch) {
    const valores = {
      matricula: editaMatricula ? matricula : undefined,
      ch: editaCh ? chEditado : ch,
      tipo_vinculo: tipoVinculo,
      ...patch,
    };
    onValores(valores);
  }

  return (
    <div className="corrigir-cadastro">
      <p className="contexto-cadastro">
        {nome}{area ? ` — ${area}` : ''}{!editaCh && ch ? ` — CH ${ch}h` : ''}
      </p>

      {editaMatricula && (
        <label>
          Matrícula correta
          <input
            value={matricula}
            onChange={(e) => { setMatricula(e.target.value); atualizar({ matricula: e.target.value }); }}
            placeholder="Digite a matrícula"
          />
        </label>
      )}

      {editaCh && (
        <label>
          Carga horária correta
          <select
            value={chEditado}
            onChange={(e) => { const v = Number(e.target.value); setChEditado(v); atualizar({ ch: v }); }}
          >
            <option value="">Selecione</option>
            {CH_OPCOES.map((v) => <option key={v} value={v}>{v}h</option>)}
          </select>
        </label>
      )}

      <label>
        Vínculo
        <select
          value={tipoVinculo}
          onChange={(e) => { setTipoVinculo(e.target.value); atualizar({ tipo_vinculo: e.target.value }); }}
        >
          {VINCULO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}
