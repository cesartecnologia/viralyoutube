# Etapa 4 — Login e painel

Copie a pasta `src` para a raiz do projeto, mesclando com a pasta existente. A única página anterior substituída é `src/app/canais/page.tsx`; os endpoints da Etapa 3 são preservados.

Dependências: `npm install firebase lucide-react`

Em `.env.local`, mantenha as variáveis existentes. Opcionalmente adicione `NEXT_PUBLIC_ADMIN_EMAIL=seu-email@exemplo.com` para evitar login no frontend com outro usuário; a proteção real das APIs continua no servidor usando `ADMIN_EMAIL` e verificação de token do Firebase Admin.

Execute `npm run dev` e abra `/login`. Faça login com o usuário do Firebase Authentication. Depois abra `/canais`.

**Segurança:** o guard no navegador protege a navegação visual, não substitui autenticação de servidor. Os endpoints `/api/channels` já validam o token Firebase e `ADMIN_EMAIL`. Não armazene credenciais no código nem publique `.env.local`.

**Nota:** Dashboard é inicial; importação e ranking não foram implementados. Rotas de Vídeos e Configurações serão incluídas nas próximas etapas.
