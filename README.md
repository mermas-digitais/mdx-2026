# MDX

Dois apps independentes. O Next chama a API Nest por HTTP.

Deploy em produção: [guia do Coolify](docs/coolify.md), com frontend, backend e PostgreSQL separados e arquivos no Garage S3. `render.yaml` é configuração legada, não usada neste fluxo.

- `mdx-front` — Next.js (App Router), React, TypeScript, Tailwind e shadcn/ui. Porta **3000**.
- `mdx-back` — NestJS, TypeScript, Prisma e Postgres. Porta **3001**.

Precisa de Node.js 22 ou superior (`nvm use` na raiz) e Docker.

## Subir

```bash
cd mdx-back
cp .env.example .env
# Preencha as credenciais S3 do bucket de desenvolvimento no .env.
docker compose up -d
npm install
npm run start:dev
```

Em outro terminal:

```bash
cd mdx-front
cp .env.example .env.local
npm install
npm run dev
```

- App: http://localhost:3000
- Health: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/docs

A página inicial mostra **API no ar** quando o health responde e **API fora** quando o Nest está parado, sem quebrar a tela.

Se `npm install` falhar com `Cannot read properties of null (reading 'edgesOut')`, o npm 10 que acompanha o Node não resolve esta árvore. Use `npx npm@11 install`.

## Banco

O schema fica em `mdx-back/prisma/schema.prisma`. Dentro de `mdx-back`:

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` cria e aplica a migration no Postgres local. `db:reset` recria o banco do zero, aplica as migrations e roda o seed. O seed inclui o evento MDX 2026 e usuários de exemplo com a senha `mdx-2026`.

Não rode o seed de exemplo nem `db:reset` em produção. Uploads agora usam S3; arquivos locais antigos precisam ser copiados ao bucket antes da troca, conforme o guia de deploy.
