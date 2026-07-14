# Guia de Desenvolvimento - Evitando Reinicializações Constantes

## O que foi configurado

### 1. **Nodemon para o Backend**
- Instalado em: `devDependencies`
- Monitorar: pasta `src/`
- Extensões: `.js` e `.json`
- **Benefício:** Servidor backend reinicia automaticamente ao salvar mudanças

### 2. **Vite para o Frontend**
- Já vinha configurado com Hot Module Replacement (HMR)
- **Benefício:** Mudanças no React refletem em tempo real sem recarregar

### 3. **Concurrently**
- Permite rodar os dois servidores em paralelo

## Como Usar

### Iniciar os servidores (melhor forma)

```bash
# Opção 1: Na raiz do projeto (ambos juntos)
npm run dev:all

# Opção 2: Em terminais separados (recomendado)
# Terminal 1 (Backend com auto-reload)
npm run dev

# Terminal 2 (Frontend com HMR)
cd frontend && npm run dev
```

### Quando você faz mudanças

| O que mudou | Comportamento |
|-----------|---|
| Arquivo `.js` em `src/` | Backend reinicia AUTOMATICAMENTE (nodemon) |
| Arquivo `.jsx` em `frontend/src/` | Frontend atualiza em tempo real (Vite HMR) |
| Arquivo `.json` em `src/` | Backend reinicia AUTOMATICAMENTE |
| `package.json` | Você precisa reiniciar manualmente |
| Variáveis de ambiente (`.env`) | Você precisa reiniciar manualmente |

## Por que precisou reiniciar antes?

- Backend não tinha **nodemon** → precisava parar e reiniciar manualmente
- LocalStorage era limpo → precisava fazer login de novo
- Sem HMR no frontend → recarregar página inteira

## O que fazer se ainda assim tiver problemas

### Cache do navegador está velho
```javascript
// No console do DevTools:
localStorage.clear();
location.reload();
```

### Backend não está respondendo
```bash
# Verificar se a porta está em uso
# Windows PowerShell:
netstat -ano | findstr :3000

# Matar processo se necessário
taskkill /PID [numero] /F
```

### Reiniciar completamente (quando tudo falhar)
```bash
# Para todos os servidores
npm run dev:all  # Ctrl+C para parar

# E reinicia
npm run dev:all
```

## Checklist para Desenvolvimento

- ✅ Backend roda com `npm run dev` (vê "nodemon" nos logs)
- ✅ Frontend roda com `cd frontend && npm run dev` (vê "Vite" nos logs)
- ✅ Editar arquivo `.js` → backend reinicia sozinho
- ✅ Editar arquivo `.jsx` → frontend atualiza sozinho
- ✅ Sem precisar de `Ctrl+C` e reiniciar a cada mudança

## Para o futuro

Se adicionar mais features que exigem reload automático:
- Arquivos CSS: já funcionam com Vite HMR
- Migrations de banco: você decide se quer auto-executar
- Assets estáticos: já são observados pelo Vite
