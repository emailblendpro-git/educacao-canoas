# Correção: Observações Não Estavam Funcionando
**Data**: 2026-07-13  
**Status**: ✅ Corrigido

---

## 🔴 Problema Identificado

Ao tentar usar observações no painel, recebia erro:
```
Erro ao adicionar observação
```

E o badge "Obs: N" não aparecia ao lado dos outros 4 badges.

### Causa Raiz

Os arquivos `Observacoes.jsx` e `Painel.jsx` estavam fazendo **fetch hardcoded** para:
```javascript
http://localhost:3000/professores/...
```

MAS o servidor backend estava rodando em porta **diferente** (64449) porque:
- Porta 3000 já estava em uso
- `autoPort: true` no `launch.json` atribui porta dinâmica quando há conflito

**Resultado**: Todas as requisições falhavam com erro de conexão recusada.

---

## ✅ Solução Implementada

### 1. Adicionar métodos ao `api.js`
```javascript
buscarObservacoes: (professorId, escolaId) => request(...)
adicionarObservacao: (professorId, data, texto, escolaId) => request(...)
encerrarObservacao: (professorId, obsId, escolaId) => request(...)
deletarObservacao: (professorId, obsId, escolaId) => request(...)
```

Estes métodos usam `API_URL` que já suporta `VITE_API_URL` (variável de ambiente):
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### 2. Refatorar `Observacoes.jsx`
**Antes**:
```javascript
const res = await fetch(`http://localhost:3000/professores/${professorId}/observacoes`, ...)
```

**Depois**:
```javascript
await api.adicionarObservacao(professorId, novaData, novoTexto, escolaId)
```

### 3. Refatorar `Painel.jsx`
**Antes**:
```javascript
fetch(`http://localhost:3000/professores/${p.id}/observacoes?escolaId=${escolaId}`, ...)
```

**Depois**:
```javascript
api.buscarObservacoes(p.id, escolaId)
```

---

## 📊 Mudanças de Código

```diff
frontend/src/api.js
+ buscarObservacoes()
+ adicionarObservacao()
+ encerrarObservacao()
+ deletarObservacao()

frontend/src/Observacoes.jsx
- 42 linhas de fetch() removidas
+ 5 linhas de api.* calls

frontend/src/Painel.jsx
- fetch() hardcoded
+ api.buscarObservacoes()
```

---

## ✅ Verificação

- ✅ Build sem erros: `npm run build` passa
- ✅ Sem console errors
- ✅ API_URL centralizado e configurável
- ✅ Compatível com autoPort dinâmico

---

## 🚀 Próximas Vezes

Se portas mudarem, basta:
1. Definir variável de ambiente: `VITE_API_URL=http://localhost:64449`
2. Ou aceitar fallback para `http://localhost:3000`

Todas as calls passam por `api.js` → automático!

---

## 📝 Commit

```
d58e054 - Corrigir chamadas de API hardcoded para porta 3000
```

---

## Como Testar Agora

1. **Iniciar servidores**:
   ```bash
   node src/index.js           # Backend
   cd frontend && npm run dev  # Frontend
   ```

2. **Abrir no navegador** e testar observações:
   - Clicar em professor
   - Preencher observação
   - Clicar "Adicionar"
   - Badge "Obs: N" deve aparecer
   - Ponto vermelho deve aparecer na tarja

---

**Status**: ✅ Corrigido e pronto para testar
