# Etapa 3 — Cadastro de canais

## Instalação
Copie a pasta `src` deste ZIP para a raiz do projeto `youtube-viral-monitor` (mescle com a pasta `src` existente). Os arquivos `src/lib/firebase.ts` e `src/lib/youtube.ts` da etapa anterior permanecem intactos.

## Dependências
```bash
npm install firebase firebase-admin lucide-react
```

## Variáveis em `.env.local`
```env
YOUTUBE_API_KEY=sua_chave_do_youtube
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
ADMIN_EMAIL=seu-email-cadastrado-no-firebase
```

As três variáveis FIREBASE_* do servidor vêm da conta de serviço em Firebase Console > Configurações do projeto > Contas de serviço > Gerar nova chave privada. Use os campos `project_id`, `client_email` e `private_key` do JSON baixado. Nunca publique o JSON, o `.env.local` ou as chaves no GitHub. Não use prefixo NEXT_PUBLIC_ para essas credenciais.

## Login
A página `/canais` usa a sessão existente do Firebase Authentication (`src/lib/firebase.ts`). **Criar um usuário no Firebase Console não inicia sessão no navegador.** É preciso implementar ou conectar uma tela de login que execute `signInWithEmailAndPassword(auth, email, password)`. Sem isso, a página exibe um aviso e não permite cadastrar canais. O backend aceita somente o e-mail indicado em ADMIN_EMAIL.

## Executar
```bash
npm run dev
```
Abra `http://localhost:3000/canais` após fazer login no aplicativo.

## Limites desta etapa
- Cadastra, lista e remove registros de canais no Firestore.
- A exclusão remove somente o registro do canal; não apaga vídeos/histórico de futuras etapas.
- A importação de vídeos e o monitoramento de visualizações serão implementados na etapa 4.
- Se a chave do YouTube estiver inválida ou a cota esgotada, a API retornará erro de validação do canal.
- Configure as variáveis também no painel da Vercel ao publicar.
