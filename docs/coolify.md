# Deploy no Coolify — MDX

Três recursos independentes no mesmo projeto/ambiente: PostgreSQL 17, API NestJS e frontend Next.js. O Garage existente é compartilhado pela infraestrutura; não criar outro storage nem publicar o banco.

## Recursos provisionados

Projeto **mdx26** (`wpsck9cvojkq6sdac83cv8sq`), ambiente **production** (`nuk8lk3e3lkjcazgnconccqj`), no servidor FabITZ Main Server e destino/rede `coolify`.

| Recurso | UUID | Domínio / acesso |
| --- | --- | --- |
| `mdx26-postgres` | `2ussworg4ymwairwligwqozn` | PostgreSQL 17, somente rede interna |
| `mdx26-backend` | `fxz53g1b93eq4thzfvgc7x0x` | `https://api.mdx26.fabitz.com.br` |
| `mdx26-frontend` | `upkcm0xrnkyzwtejuywoowux` | `https://mdx26.fabitz.com.br` |

Backend e frontend publicados e verificados como `running:healthy`, com seus endpoints de health respondendo HTTP 200 por HTTPS. Aplicações apontam para `main`, com autodeploy habilitado e previews desabilitados. O PostgreSQL foi iniciado separadamente e está acessível pela API na rede privada.

A home `/` redireciona para `/e/mdx-2026` com HTTP 307, preservando parâmetros de campanha. O healthcheck técnico continua em `/api/health`, sem redirecionamento. O evento precisa existir e estar publicado no banco; o redirect não cria nem publica eventos.

### Healthcheck e deploy automático

Manter `health_check_enabled=false` no painel do Coolify para **não sobrescrever o `HEALTHCHECK` dos Dockerfiles**. Isso não desliga a verificação de saúde da imagem: os logs devem mostrar `Using the custom healthcheck from the Dockerfile.` e confirmar o container saudável antes da troca. O comando da imagem usa Node `fetch`, sem depender de `curl`/`wget`. Ativar o healthcheck HTTP do painel causou rollback nos primeiros deploys porque esses binários não existem nas imagens slim.

Autodeploy configurado em backend e frontend, sem filtro de arquivos (`watch_paths` vazio): qualquer push em `main` deve disparar ambos. Push em outras branches não corresponde à branch de produção. O banco não é reconstruído por alteração de código; as migrations continuam sendo aplicadas no início da API.

Webhook GitHub ativo `707524551`, evento `push`, URL `https://infra.fabitz.com.br/webhooks/source/github/events/manual`, payload JSON, validação TLS e assinatura HMAC-SHA256. As duas aplicações têm o mesmo segredo aleatório em `manual_webhook_secret_github`, permitindo um único webhook para o repositório. O segredo fica no GitHub/Coolify, nunca no Git. O teste de push com `refs/heads/main` retornou HTTP 200 e enfileirou um deploy para cada aplicação; o teste de ping sozinho não comprova isso.

Se recriar as aplicações, reconfigurar o segredo compartilhado e o webhook, além de habilitar autodeploy. Apenas marcar a opção no painel não conecta um repositório público aos eventos do GitHub. Não adicionar outro webhook equivalente, para evitar deploys duplicados. Commits com `[skip ci]`/`[skip cd]` podem ser ignorados pelo Coolify.

### Variáveis locais e de produção

O `.env` da raiz é um inventário local privado, não um arquivo para copiar integralmente para os dois recursos:

- Mantidos os valores de desenvolvimento fornecidos: `NODE_ENV`, `PORT`, `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET` e SMTP. A configuração local continua com frontend em `localhost:3002`.
- Incluídos `AUTH_SECRET` aleatório, `AUTH_URL`, `API_URL`, `NEXT_PUBLIC_API_URL` e as cinco variáveis `S3_*` necessárias.
- Incluídas referências privadas `COOLIFY_DATABASE_URL`, `COOLIFY_FRONTEND_URL` e `COOLIFY_API_URL`. A URL do PostgreSQL de produção tem senha gerada pelo Coolify e hostname interno, não `localhost`.
- O backend recebeu 15 variáveis: JWT, SMTP, S3 e configuração de produção (`NODE_ENV=production`, `PORT=3001`, URL interna do banco e origem HTTPS do frontend).
- O frontend recebeu sete variáveis: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME`, `API_URL`, `NEXT_PUBLIC_API_URL`, `AUTH_URL` e `AUTH_SECRET`. Nesta configuração, ambas as URLs da API usam o endpoint HTTPS público; não dependem de alias privado da aplicação.
- Apenas `NEXT_PUBLIC_API_URL` do frontend está disponível no build. Demais variáveis são runtime-only; injeção automática de argumentos nos Dockerfiles foi desabilitada. Escopos conferidos também nas cópias de preview, embora previews estejam desabilitados.
- Valores com caracteres especiais foram enviados como literais. Não colocar `.env`, senhas ou tokens em commits/PRs; `.env.example` permanece versionável. As aplicações não carregam o `.env` da raiz automaticamente quando iniciadas em seus subdiretórios.

Conferidas presença de 22 variáveis locais, distinção/tamanho dos segredos de autenticação, senha do banco de produção e persistência das variáveis no Coolify, sem imprimir valores. TLS público, saúde das imagens e conectividade API/PostgreSQL foram verificados após o deploy. Entrega SMTP e fluxos completos de usuário ainda precisam de validação. Credenciais expostas em conversa devem ser rotacionadas em manutenção coordenada.

## Storage preparado

- Serviço Garage: `mckbsobkbr5j60bbycjr8bnc`.
- Endpoint S3: `https://s3.fabitz.com.br`.
- Região: `garage`; bucket privado: `mdx26`; path-style habilitado no cliente.
- Chave exclusiva `mdx26-backend`: leitura/escrita no bucket, sem owner nem criação de buckets.
- Credenciais guardadas nas variáveis `MDX26_S3_ACCESS_KEY_ID` e `MDX26_S3_SECRET_ACCESS_KEY` do serviço Garage. Copiar seus valores para `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` do backend. Essas variáveis não são injetadas automaticamente em outros recursos. Não reiniciar Garage apenas para copiar as chaves.
- Nunca usar `SERVICE_PASSWORD_GARAGE`, token de métricas ou RPC secret no aplicativo. Rotacionar os tokens administrativos expostos na conversa, em uma manutenção separada.

O bucket inteiro permanece privado, sem website público. Banners são transmitidos por `/api/uploads/:name`; documentos só pela rota autenticada que verifica orientador/gestor do evento. Navegador não acessa S3 diretamente: não precisa liberar CORS no bucket nem usar o endpoint web do Garage.

Para desenvolvimento e testes de integração, usar bucket/chave separados; não reutilizar o bucket de produção nos testes.

## 1. PostgreSQL

Criar recurso PostgreSQL 17 com usuário/senha fortes, volume persistente e porta pública desabilitada. Guardar a URL interna gerada pelo Coolify em `DATABASE_URL` da API. Confirmar que API e banco estão na mesma rede Docker e que o hostname da URL resolve no container da API; não usar `localhost`.

Configurar backup periódico e testar restauração. Se usar Garage para backups do banco, usar **outro bucket e outra chave**, não a chave de uploads da aplicação.

## 2. Backend

Criar Application a partir deste repositório:

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| Build Pack | Dockerfile |
| Base Directory | `/mdx-back` |
| Dockerfile Location | `/Dockerfile` |
| Porta interna | `3001` |
| Healthcheck | Usar o `HEALTHCHECK` Node da imagem (`GET /api/health`, porta `3001`); desabilitar sobrescrita no painel |
| Domínio | HTTPS da API, escolhido antes do build do frontend |

Variáveis **somente runtime**, sem colocá-las como build arguments:

```dotenv
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/BANCO
FRONTEND_URL=https://DOMINIO_DO_FRONTEND
JWT_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
S3_ENDPOINT=https://s3.fabitz.com.br
S3_REGION=garage
S3_BUCKET=mdx26
S3_ACCESS_KEY_ID=CHAVE_EXCLUSIVA_DO_BUCKET
S3_SECRET_ACCESS_KEY=SEGREDO_DA_CHAVE_S3
SMTP_HOST=HOST_SMTP
SMTP_PORT=587
SMTP_USER=USUARIO_SMTP
SMTP_PASS=SENHA_SMTP
SMTP_FROM="MDX <REMETENTE_VERIFICADO>"
```

Usar a origem exata do frontend, sem caminho nem barra final, em `FRONTEND_URL` (CORS). Configurar remetente, SPF/DKIM e entrega real do OTP. A API recusa iniciar em produção sem host/remetente SMTP. Usuário/senha dependem do provedor; não são obrigatórios para relays que dispensam autenticação.

A imagem executa `prisma migrate deploy` **antes** de iniciar `node dist/main.js`. Migração falhando impede inicialização. Não adicionar a mesma migration em post-deploy: ele não protege o primeiro tráfego. Não usar `migrate dev`, `db:reset` ou seed de demonstração.

Não precisa de volume de uploads na API após migrar os arquivos antigos. Prisma CLI e migrations ficam na imagem; o build não exige banco ou credenciais S3. O container usa usuário não-root e escuta `0.0.0.0`.

## 3. Frontend

Criar outra Application, mesmo repositório/branch:

| Campo | Valor |
| --- | --- |
| Build Pack | Dockerfile |
| Base Directory | `/mdx-front` |
| Dockerfile Location | `/Dockerfile` |
| Porta interna | `3000` |
| Healthcheck | Usar o `HEALTHCHECK` Node da imagem (`GET /api/health`, porta `3000`); desabilitar sobrescrita no painel |
| Domínio | HTTPS do frontend |

Variável **build e runtime** (pública, não secreta):

```dotenv
NEXT_PUBLIC_API_URL=https://DOMINIO_DA_API
```

Marcar como disponível no build; o Dockerfile declara `ARG NEXT_PUBLIC_API_URL`. Mudar essa URL exige rebuild. Não passar hostname privado aqui: cadastro, OTP e imagens usam a API pelo navegador.

Variáveis **somente runtime**:

```dotenv
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
API_URL=http://HOST_INTERNO_DA_API:3001
AUTH_URL=https://DOMINIO_DO_FRONTEND
AUTH_SECRET=OUTRO_SEGREDO_ALEATORIO_FORTE
```

`API_URL` pode ser a URL HTTPS pública da API se não houver DNS/rede interna compartilhada. Não inventar hostname: usar alias resolvível na rede do Coolify. `AUTH_URL` precisa refletir HTTPS para ler o cookie seguro da sessão, inclusive nos downloads de documentos. `AUTH_SECRET` é diferente de `JWT_SECRET`; manter estável entre deploys/réplicas. Auth.js já usa `trustHost: true`; encaminhar Host/protocolo pelo proxy confiável.

O frontend usa Next standalone, copia `public` e `.next/static` e inicia com `node server.js`. O build precisa de acesso ao Google Fonts, já usado pelo projeto. Não precisa enviar `AUTH_SECRET` ao build. `GET /api/health` verifica apenas frontend; o health da API verifica banco.

## Arquivos e banco existentes

Antes de apontar tráfego para a versão S3:

1. Identificar se há banco e `uploads/` com dados reais. Fazer backup dos dois; não apagar a origem.
2. Suspender novos uploads durante a cópia final.
3. Copiar o **conteúdo** de `uploads/` para a raiz de `mdx26`, preservando nomes. Ex.: `uploads/UUID.png` → `UUID.png`; `uploads/documents/UUID.pdf` → `documents/UUID.pdf`. Usar cliente S3 autenticado, região `garage`, path-style e endpoint acima. Não usar `sync --delete` nem tornar os objetos públicos.
4. Conferir contagem, tamanhos e leitura de amostras; as referências no banco não mudam.
5. Migrar/restaurar o banco necessário, aplicar migrations e testar banner/documento antes de liberar escrita.

Sem essa cópia, registros antigos continuam existindo, mas seus arquivos darão 404. A aplicação não faz fallback silencioso para disco local. Rollback para a versão antiga exige copiar de volta arquivos novos do S3 para disco, além de conferir compatibilidade do schema.

## Primeiro acesso e verificação

Subir banco → API → frontend. Criar uma conta pelo fluxo normal com e-mail real; depois, no console SQL privado do banco, promover **a conta aprovada**:

```sql
UPDATE users SET role = 'ADMIN', updated_at = NOW()
WHERE email = 'EMAIL_REAL_DO_ADMINISTRADOR'
RETURNING id, email, role;
```

Confirmar uma única linha retornada e sair/entrar novamente para renovar as permissões da sessão. Não criar usuários de demonstração em produção.

Checklist antes de liberar:

- [ ] DNS, TLS, rede privada e secrets conferidos; nenhum `.env` no Git/imagens.
- [ ] API e frontend saudáveis; migrations aplicadas.
- [ ] OTP entregue e login HTTPS funcionando, inclusive após navegar para administração.
- [ ] Banner enviado/lido; documento baixado pelo orientador/gestor e negado a terceiros.
- [ ] Redeploy da API sem perder acesso aos arquivos.
- [ ] Backup/restore do PostgreSQL e cópia externa dos objetos do Garage testados. Volume/replicação no mesmo servidor não substituem backup.
- [ ] Limites de payload do proxy compatíveis com inscrição: até seis documentos de 5 MB, mais overhead multipart; Server Actions já permitem 32 MB.

Começar com uma instância da API: limitador de login é em memória. Não habilitar múltiplas réplicas sem revisar rate limiting e rollout/migrations. Reverter imagem não desfaz migrations; manter alterações de schema compatíveis com a versão anterior.

## Testes locais

Backend: `npm ci`, `npm test`, `npm run build`. `npm run storage:check` usa as variáveis do `.env`, cria um objeto aleatório em `smoke/`, verifica leitura autenticada/bloqueio anônimo/exclusão e remove só esse objeto. Rodar com bucket de teste sempre que possível. E2E exige Postgres local; a suíte de eventos substitui S3 por mock e não acessa produção.

Frontend: `npm ci`, `npm test`, `npm run lint`, `npm run build`. Usar Node 22.22.3+ na linha 22, ou 24.15+ na linha 24 (dependências do Nest CLI exigem essas versões). Dockerfiles usam Node 22 e npm 11.

`render.yaml` permanece como legado e não participa do deploy no Coolify. Domínios/variáveis e primeiros deploys manuais foram verificados; os próximos pushes em `main` usam o webhook de autodeploy acima.

### Validação desta preparação

- Backend: build, lint e 37 testes passaram. Cobertura focada em storage/config: 100% das linhas, 96,29% dos branches.
- Frontend: build standalone, três testes de sessão HTTP/HTTPS e health do processo standalone passaram. Lint sem erros, com avisos preexistentes de `<img>`.
- Garage real: upload/leitura autenticada/bloqueio anônimo/exclusão passaram; objeto temporário removido. Bucket permaneceu privado e vazio.
- Auditoria `npm audit --omit=dev`: backend sem vulnerabilidades reportadas; frontend com seis alertas baixos/moderados na árvore do CLI `shadcn`, mantidos fora desta mudança. Não aplicado `audit fix --force`.
- Imagens Linux e healthchecks validados no Coolify após corrigir a sobrescrita HTTP do painel. As sete migrations foram aplicadas com sucesso e o health da API confirma Postgres `up`. Ambos os endpoints públicos retornam HTTP 200 com TLS válido.
- Autodeploy validado com evento push do GitHub para `main`, assinatura conferida e deploys enfileirados para as duas aplicações.
- Ainda pendentes: E2E completo com usuários, envio SMTP real, backups/restauração e eventual migração dos uploads existentes. Esses itens não são comprovados apenas pelo healthcheck.
