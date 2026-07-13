# Diagnóstico de Estagnação - Educação Canoas
**Data**: 2026-07-13  
**Status**: Análise completa | Bloqueios identificados

---

## 🎯 O que o projeto faz

API REST + Frontend React para gestão de escolas municipais (Canoas/RS):
- **Objetivo**: Alocar professores em turmas/disciplinas respeitando carga horária contratual
- **Base de dados**: Supabase (PostgreSQL)
- **Dados**: 123 professores, 91 turmas, 3 escolas (EMEF Drummond, EMEF Santos Dumont, EMEF Paulo VI)

---

## ✅ O que foi implementado (últimos commits)

| Data | Commit | Status |
|------|--------|--------|
| 10/07 | Aumentar badge de ocorrências e posicionar à direita | ✅ Completo |
| 10/07 | Adicionar indicador de ocorrências na linha | ✅ Completo |
| 10/07 | Implementar Aba de Ocorrências para Professores | ✅ Backend + Frontend |
| 10/07 | Corrigir painéis desaparecendo / Reformular Matriz Curricular | ✅ Completo |
| 05/07 | Adicionar funcionalidade de exportação para Excel | ✅ Completo |

---

## 🚫 Por que está estagnado: 3 Bloqueios Identificados

### 1. **Migração SQL de Ocorrências NÃO FOI EXECUTADA** ⚠️ CRÍTICO

**Problema**: 
- Arquivo criado: `src/migrations/01-criar-ocorrencias.sql`
- Backend implementado com rotas: `POST /professores/:id/ocorrencias`, `GET`, `DELETE`
- Frontend implementado com UI funcional
- **MAS**: A tabela nunca foi criada no banco de dados

**Consequence**:
- Qualquer tentativa de usar ocorrências no app retorna erro 500 (tabela não existe)
- Feature implementada mas inutilizável

**Solução**: Executar 1 comando SQL no Supabase. 5 minutos de trabalho.

---

### 2. **Dados Incompletos na Matriz Curricular** 🏚️ MÉDIO

**Problema**:
- Séries 6º-9º não têm dados para disciplinas eletivas (PPA, PLL, TICs, A)
- Aparecem como "-" na interface
- Dados de séries 1º-5º estão completos

**Dados faltando**:
```
Para cada escola e para cada série (6,7,8,9):
- PPA (Projeto Pluridisciplinar): X períodos/semana
- PLL (Português Leitura Letra): X períodos/semana  
- TICs (Tecnologia): X períodos/semana
- A (Artes): X períodos/semana
```

**Consequence**: 
- Matriz Curricular incompleta
- Não dá para avaliar carga horária de 6º-9º

**Solução**: Inserir dados via UI (agora editável) ou via SQL direto. 1-2 horas de trabalho.

---

### 3. **Lixo no Repositório e Banco de Dados** 🗑️ BAIXO

**Arquivos temporários que deveriam ser deletados**:
- `temp-insert-matriz.js` - script de teste que criou dados ruins
- `Projeto 1.zip` - arquivo compactado não utilizado
- `~$xto co correções 1.docx` - lock file de Word

**Registros no banco que deveriam ser removidos**:
- Chaves `"1º ano"`, `"6º ano"` na tabela `matriz_projetos_escola` (formato errado - deveria ser `"1"`, `"6"`)
- Siglas antigas: `'PT'`, `'MA'`, `'CI'`, `'HI'`, `'GE'`, `'IN'`, `'AR'`

**Consequence**: 
- Confusão visual e mental
- Overhead mínimo no banco (não afeta funcionamento)

**Solução**: 3 comandos DELETE + deletar 2 arquivos. 15 minutos.

---

## 📊 Estado dos Dados (diagnóstico 08/07)

```
✅ Integridade excelente:
   - 100% com status
   - 100% com matrícula
   - 24.4% com cargo (ok para inicial)
   - 30.1% com disciplina (ok - algumas são genéricas)

⚠️ Problemas operacionais:
   - 71 professores em SUBCARGA (faltam aulas)
   - 5 professores em SOBRECARGA (aulas demais)
   - 67 professores em múltiplas turmas (normal)
   
✅ Pendências: TODAS RESOLVIDAS (0 abertas)
```

---

## 🔴 Próximas Funcionalidades Planejadas (não iniciadas)

### Condições Especiais
- [ ] Redução de Carga Horária (status: `reducao_de_carga`)
- [ ] Desdobro (duplicar professor em turmas)
- [ ] Readaptação de Função (status: `readaptado`)

---

## 📋 Plano de Ação para Sair da Estagnação

### **SEMANA 1: Desobstruir (1-2 dias)**

**Dia 1 - Manhã (Bloqueios Críticos)**
1. ✅ **Executar migração SQL** → Tabela de ocorrências ativa
2. ✅ **Testar ocorrências** → Criar, listar, deletar funcionando
3. ✅ **Limpar banco** → DELETE registros com ano_escolar incorreto

**Dia 1 - Tarde (Lixo)**
4. ✅ **Deletar arquivos temp** → `temp-insert-matriz.js`, `Projeto 1.zip`, lock files
5. ✅ **Commit**: "Limpar estagnação: ativar ocorrências e remover lixo"

---

### **SEMANA 1: Dados Faltando (1 dia)**

**Dia 2 - Ou distribuído**
- Opção A: Inserir dados via UI (editar célula)
- Opção B: Carregar de planilha
- Opção C: Gerar dados padrão para teste

---

### **SEMANA 2+: Próximas Features (1-2 semanas)**

1. **Condições Especiais UI**
   - Tela para gerenciar redução/desdobro/readaptação
   - Impacto na carga horária automático

2. **Relatórios**
   - Download: Alocações por professor
   - Download: Diagnóstico de carga por escola

3. **Validações Avançadas**
   - Avisar quando professor tem aula em dois turnos diferentes
   - Sugerir rebalanceamento automático

---

## 🚀 Resumo: Por que perde velocidade

1. **Não há checklist visual** → Não sabe o que tá pronto vs. tá faltando
2. **Bloqueios não resolvidos acumulam** → Implementação fica pronta mas inutilizável
3. **Limpeza procrastinada** → Mental clutter ralentiza próximas decisões
4. **Falta dados para testar features** → UI pronta mas sem dados reais

**Solução**: Resolver os 3 bloqueios hoje (2-3 horas) e depois velocidade volta.

---

## 📁 Estrutura do Projeto

```
educacao_canoas/
├── src/
│   ├── index.js                    (entrada, rotas registradas)
│   ├── db.js                       (conexão PostgreSQL)
│   ├── middleware/
│   │   └── auth.js                 (JWT, perfis)
│   ├── routes/
│   │   ├── escolas.js              ✅
│   │   ├── professores.js          ✅
│   │   ├── painel.js               ✅ (dados para dashboard)
│   │   ├── pendencias.js           ✅ (resolver pendências de alocação)
│   │   ├── alocacoes.js            ✅
│   │   ├── matriz-curricular.js    ✅ (dados de disciplinas/séries)
│   │   ├── ocorrencias.js          ✅ CRIADO MAS NÃO TESTADO (migração pendente)
│   │   ├── exportar.js             ✅
│   │   ├── administrativo.js       ✅
│   │   └── auth.js                 ✅
│   └── migrations/
│       └── 01-criar-ocorrencias.sql ⚠️ NÃO EXECUTADA
│
├── frontend/
│   ├── src/
│   │   ├── Painel.jsx              ✅ (dashboard principal)
│   │   ├── MatrizCurricular.jsx    ✅ (grades por série/turno)
│   │   ├── Ocorrencias.jsx         ✅ UI PRONTA MAS NÃO TESTADA
│   │   ├── [...outras telas]       ✅
│   │   └── main.jsx
│   └── package.json
│
└── [Arquivos temp que devem ser deletados]
    ├── temp-insert-matriz.js       🗑️
    ├── Projeto 1.zip               🗑️
    └── ~$xto co correções 1.docx   🗑️
```

---

**Próximo passo**: Clicar em "Desbloquear Estagnação" abaixo para executar o plano Dia 1.
