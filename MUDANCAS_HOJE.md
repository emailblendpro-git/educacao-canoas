# Relação de Mudanças - 2026-07-10

## Problemas Identificados e Corrigidos

### 1. **Painéis Desaparecendo (Principal)**
- **Causa**: Código usava `'MANHÃ'` (maiúsculo + acento) mas banco armazena `'manha'` (minúsculo, sem acento)
- **Arquivo**: `frontend/src/Painel.jsx`
- **Correção**: Mudou filtro de turnos de `['MANHÃ', 'TARDE', 'NOITE', 'EJA']` para `['manha', 'tarde', 'noite', 'eja']`
- **Resultado**: Painéis voltaram a aparecer

### 2. **Ordem dos Turnos Incorreta**
- **Arquivo**: `frontend/src/Painel.jsx`
- **Alteração**: Adicionado mapa `TURNO_LABEL` para exibir rótulos formatados
  - `'manha'` → exibe como `'MANHÃ'`
  - `'tarde'` → exibe como `'TARDE'`
  - `'noite'` → exibe como `'NOITE'`
  - `'eja'` → exibe como `'EJA'`
- **Resultado**: Ordem correta: MANHÃ → TARDE → NOITE → EJA

### 3. **Série 1º-5º Desaparecendo na Matriz Curricular**
- **Causa**: Lógica decidia layout pelo turno (`manha`/`tarde`), mas na realidade cada turno contém turmas de 1º-9º ano juntas
- **Arquivo**: `frontend/src/MatrizCurricular.jsx` (reescrito)
- **Correção**: 
  - Matriz agora recebe array `anosEscolares` com as séries realmente presentes
  - Renderiza bloco 1º-5º e bloco 6º-9º separados, conforme necessário
  - Bloco 1º-5º mostra: `LP | ER | M | C | H | G | [espaço] | PPA | PLL | TICs | A | EF`
  - Bloco 6º-9º mostra: `LP | LI | M | C | H | G | EF | ER | A`
- **Resultado**: Séries aparecem corretamente lado a lado com Grade de Aulas

### 4. **Formato de Chave Inconsistente**
- **Problema**: Código buscava `matriz.matrizPorAno['1º ano']` mas banco armazena `'1'`, `'2'`, etc.
- **Arquivo**: `frontend/src/MatrizCurricular.jsx`
- **Correção**: Trocou todas as buscas para usar dígito puro (`'1'`, `'2'`, ... `'9'`)
- **Valores de entrada esperados**: `['1', '2', '3', '4', '5']` para 1º-5º e `['6', '7', '8', '9']` para 6º-9º

### 5. **Apenas Algumas Disciplinas Editáveis**
- **Arquivo**: `frontend/src/MatrizCurricular.jsx`
- **Implementação**: 
  - Const `DISCIPLINAS_EDITAVEIS = ['PPA', 'PLL', 'TICs', 'A']`
  - Componente `EditarCelula` recebe prop `editavel` (boolean)
  - Se não editável: renderiza em cinza, texto não clicável
  - Se editável: renderiza texto clicável para edição
- **Resultado**: Apenas PPA, PLL, TICs, A podem ser editados; LP, ER, M, C, H, G, LI são somente leitura

## Arquivos Modificados

1. **frontend/src/Painel.jsx**
   - Linha 233-237: Filtro de turnos corrigido
   - Linha 237: Adicionado `TURNO_LABEL` map
   - Linha 255: Exibição de label do turno
   - Linha 253-273: Lógica para extrair `anosEscolares` das turmas e passar à `MatrizCurricular`

2. **frontend/src/MatrizCurricular.jsx** (reescrito completamente)
   - Mudou de receber prop `turno` para receber `anosEscolares`
   - Constantes atualizadas: `ANOS_1A5 = ['1', '2', '3', '4', '5']` e `ANOS_6A9 = ['6', '7', '8', '9']`
   - Componente `TabelaMatriz` novo: renderiza uma tabela com base em anos e disciplinas
   - Componente `EditarCelula` agora tem prop `editavel` (boolean)
   - Renderização condicional: mostra bloco 1º-5º com espaço visual e 6º-9º sem espaço
   - Busca de dados usa formato dígito puro (`'1'`, `'2'`, etc.)

## Dados Problemáticos Identificados

### No Banco de Dados (matriz_projetos_escola)

**Registros "lixo" legados** (não aparecem mais, mas continuam no banco):
- Chave ano_escolar: `"1º ano"`, `"6º ano"` (formato errado)
- Siglas: `'PT'`, `'MA'`, `'CI'`, `'HI'`, `'GE'`, `'IN'`, `'AR'` (format o antigo, não usado)
- Origem: Script `temp-insert-matriz.js`
- **Ação recomendada**: Deletar estes registros e o arquivo do script

**Registros que precisam ser criados** (6º-9º año - séries 6, 7, 8, 9):
- Faltam valores para PPA, PLL, TICs, A das séries 6-9 em TODAS as escolas
- Actualmente aparecem como "-" na Matriz Curricular
- **Ação recomendada**: Inserir valores reais ou preencher via interface (agora editável)

## Valores Atualmente no Banco

**Série 1 (completo - Escola 1)**:
- A: 1 período/semana
- PLL: 1 período/semana
- PPA: 2 períodos/semana
- TICs: 1 período/semana

**Séries 2-5**: Padrão similar (1-2 períodos/semana cada)

**Série 6-9**: ❌ SEM DADOS (mostra "-" em todas as células)

## Build e Compilação

✅ Build passa sem erros:
```
✓ 25 modules transformed
dist/assets/index-XhhMh1FT.js   220.21 kB │ gzip: 68.40 kB
✓ built in 219ms
```

## Próximos Passos Recomendados

1. **[ ] Verificar dados 6º-9º**: Confirmar se há planilha com valores para séries 6-9
2. **[ ] Limpar banco**: Deletar registros com ano_escolar `"1º ano"`/`"6º ano"` e arquivo `temp-insert-matriz.js`
3. **[ ] Popular 6º-9º**: Inserir valores para PPA, PLL, TICs, A das séries 6-9 (ou preencher via interface)
4. **[ ] Testar visualização**: Verificar se painéis aparecem corretamente para cada turno/escola

---

**Data**: 2026-07-10  
**Desenvolvedor**: Claude Haiku 4.5  
**Status**: ✅ Painéis funcionando | ⚠️ Dados 6º-9º faltando
