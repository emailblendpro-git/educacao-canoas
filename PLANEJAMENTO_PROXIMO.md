# Planejamento - Próxima Sessão

**Data**: 2026-07-11

## ✅ CONCLUÍDO - Aba de Ocorrências

### O que foi implementado:

1. **Backend (Node.js/Express)**
   - ✅ Arquivo: `src/routes/ocorrencias.js`
   - ✅ Rotas:
     - `POST /professores/:id/ocorrencias` - Criar ocorrência
     - `GET /professores/:id/ocorrencias` - Listar ocorrências
     - `DELETE /professores/:id/ocorrencias/:ocorrenciaId` - Deletar ocorrência

2. **Banco de Dados**
   - ✅ Script: `src/migrations/01-criar-ocorrencias.sql`
   - Tabela: `ocorrencias_professores` com campos:
     - titulo, descricao, tipo, data_ocorrencia
     - criado_por, criado_em, atualizado_em

3. **Frontend (React)**
   - ✅ Arquivo: `frontend/src/Ocorrencias.jsx`
   - ✅ Integração em: `frontend/src/Painel.jsx`
   - Funcionalidades:
     - Adicionar ocorrência (título + descrição + tipo)
     - Listar com scroll
     - Deletar com confirmação
     - Tipos: geral, atestado, falta, atraso, aviso, elogio

4. **Registro no Backend**
   - ✅ Adicionada rota em `src/index.js`

---

## 📋 PRÓXIMAS TAREFAS

### Antes de mais nada:
1. **Executar migração SQL**
   ```sql
   -- Conectar ao banco e rodar:
   CREATE TABLE IF NOT EXISTS ocorrencias_professores (...)
   ```

2. **Testar funcionalidade**
   - [ ] Expandir perfil de professor
   - [ ] Adicionar ocorrência
   - [ ] Verificar listagem
   - [ ] Testar deletar

### Depois:
**B) Condições Especiais** 🏥
- Redução de Carga Horária
- Desdobro
- Readaptação de Função

---

**Status**: ✅ IMPLEMENTAÇÃO CONCLUÍDA | ⏳ AGUARDANDO MIGRAÇÃO SQL
