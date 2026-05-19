# Setup e Configuração Local

Este arquivo documenta os passos de configuração local do projeto.

## ⚙️ Configuração Inicial

### 1. Configurar Supabase
```bash
npm run setup:supabase
# ou execute: npm install && npm run dev
```

### 2. Iniciar a Aplicação
```bash
npm run dev
```

Acesse: `http://localhost:3000/crm`

## 🔧 Configurações Avançadas

### Supabase
- Variáveis de ambiente em `.env.local`
- Credenciais em `setup/MINHAS_CONFIGURACOES.ini` (não versionado)

### Google Apps Script

Os scripts estão em `apps_script/`:

1. **08_Supabase_Conversa_Completa_Dedup.gs**
   - Sincroniza conversas completas
   - Remove duplicidade
   - Integração com Supabase

2. **09_Supabase_Agenda_Lembretes.gs**
   - Processa lembretes de agenda
   - Envia notificações

3. **10_Outbox_Operador.gs**
   - Gerencia caixa de saída
   - Operações em lote

### SQL

Execute as migrations em `sql/`:

```sql
-- Limpeza e deduplicação
sql/07_limpeza_dedup_conversas.sql

-- Estrutura de respostas rápidas e lembretes
sql/08_estrutura_respostas_rapidas_e_lembretes.sql

-- Índices e estrutura para mensagens direcionadas
sql/15_rapidas_direcionamento.sql
```

## 🐛 Troubleshooting

### "localhost recusado"
O servidor Node.js não está rodando.
```bash
npm run dev
```

### Build falha
Limpe cache e reinstale:
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Supabase não conecta
Verifique as variáveis em `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

## 📦 Dependências

Veja `package.json` para lista completa de dependências.

Principais:
- `next` - Framework React
- `@supabase/supabase-js` - Client Supabase
- `react` - UI

## 🚀 Deploy

### Vercel

```bash
vercel deploy
```

Configurações em `vercel.json`

### Build local
```bash
npm run build
npm run start
```

## 📱 Estrutura de Pastas

```
setup/              # Configurações locais
├── MINHAS_CONFIGURACOES.ini  # Credenciais (não versionado)

apps_script/        # Scripts Google Apps
├── 08_*.gs
├── 09_*.gs
├── 10_*.gs

sql/                # Migrations e schemas
├── 07_*.sql
├── 08_*.sql
├── 15_*.sql

app/                # Código principal
lib/                # Utilitários
docs/               # Documentação

public/             # Assets estáticos
```

## 💡 Dicas

- Use `.env.local` para variáveis locais (nunca commitar)
- Apps Script sincroniza automaticamente com Google Sheets
- Backup regular do Supabase
- Teste migrations em dev antes de produção

## 📞 Suporte

Para problemas, consulte:
- [Documentação Next.js](https://nextjs.org)
- [Documentação Supabase](https://supabase.io/docs)
- [Referência Google Apps Script](https://developers.google.com/apps-script)
