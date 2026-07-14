# Revisão - Aba de Gestão Escolar

## 📝 Data: 13/07/2026

---

## ✅ Mudanças Realizadas

### 1. **Nova Categoria: Profissional Administrativo**

Criada categoria separada para profissionais administrativos:
- **Secretaria**
- **Readaptação / Auxiliar de secretaria**

### 2. **Reorganização das Categorias**

#### Gestores Escolares (👑)
- Direção
- Vice Direção
- Supervisão
- Orientação

**Descrição**: Nunca são colocados na grade de aulas

#### Profissional Administrativo (📋) - NOVO
- Secretaria
- Readaptação / Auxiliar de secretaria

**Descrição**: Nunca são colocados na grade de aulas

#### Profissionais Pedagógicos (📚)
- Sala de Recursos
- Assessor Pedagógico
- TEB Técnico Ensino Especial
- Laboratório
- Estagiário
- Biblioteca
- Readaptado / Auxiliar biblioteca

**Descrição**: Podem ir para sala de aula em caso de necessidade (ficam em CINZA na grade)

### 3. **Cores Atualizadas**

| Cargo | Cor |
|-------|-----|
| Diretor | #c0392b (Vermelho escuro) |
| Vice-Diretor | #e74c3c (Vermelho) |
| Supervisor | #3498db (Azul) |
| Orientação | #2ecc71 (Verde) |
| Secretaria | #f39c12 (Laranja) |
| Readaptação / Auxiliar de secretaria | #e67e22 (Laranja escuro) |
| Assessor Pedagógico | #1abc9c (Teal) |
| Sala de Recursos | #16a085 (Teal escuro) |
| TEB | #8e44ad (Roxo) |
| Laboratório de Aprendizagem | #34495e (Cinza azulado) |
| Estagiário | #bdc3c7 (Cinza claro) |
| Biblioteca | #95a5a6 (Cinza) |
| Readaptado / Auxiliar biblioteca | #9b59b6 (Roxo claro) |

---

## 📊 Arquivos Modificados

### Backend: `src/routes/administrativo.js`
- Atualizado objeto CATEGORIAS com 3 categorias (gestores, administrativo, pedagogicos)
- Atualizado função categorizarProfissional()
- Atualizado ORDER BY do SQL para nova ordem
- Atualizado inicialização de profissionaisPorCategoria

### Frontend: `frontend/src/Administrativo.jsx`
- Atualizado CARGO_CORES com novos cargos
- Atualizado CATEGORIAS_INFO com 3 categorias
- Adicionadas descrições específicas para cada categoria

---

## 🎯 Estrutura Final da Aba

```
┌─────────────────────────────────────┐
│       GESTÃO ESCOLAR                │
├─────────────────────────────────────┤
│                                     │
│ 👑 GESTORES ESCOLARES               │
│ Nunca na grade de aulas             │
│                                     │
│ ├─ Diretor (vermelho)               │
│ ├─ Vice-Diretor (vermelho)          │
│ ├─ Supervisor (azul)                │
│ └─ Orientação (verde)               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ 📋 PROFISSIONAL ADMINISTRATIVO       │
│ Nunca na grade de aulas             │
│                                     │
│ ├─ Secretaria (laranja)             │
│ └─ Readaptação / Auxiliar...        │
│    (laranja escuro)                 │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ 📚 PROFISSIONAIS PEDAGÓGICOS         │
│ Podem ir para sala (CINZA)          │
│                                     │
│ ├─ Sala de Recursos (teal)          │
│ ├─ Assessor Pedagógico (teal)       │
│ ├─ TEB (roxo)                       │
│ ├─ Laboratório (cinza azulado)      │
│ ├─ Estagiário (cinza claro)         │
│ ├─ Biblioteca (cinza)               │
│ └─ Readaptado / Auxiliar...         │
│    (roxo claro)                     │
│                                     │
└─────────────────────────────────────┘
```

---

## 💾 Commit

```
7b35630 - Revisar aba de Gestão Escolar: reorganizar categorias e adicionar Profissional Administrativo
```

---

## ✨ Status

✅ **Gestores Escolares** - Reorganizado e melhorado  
✅ **Profissional Administrativo** - Nova categoria criada  
✅ **Profissionais Pedagógicos** - Reorganizado com todos os profissionais  
✅ **Cores e Design** - Atualizado  
✅ **Backend e Frontend** - Sincronizados

---

**PRONTO PARA PRODUÇÃO** ✅
