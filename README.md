# leetscuda.com

AI Infrastructure Interview Prep Platform — covering CUDA/GPU programming, ML systems, Kubernetes for AI workloads, and foundational DSA.

## Setup

### Prerequisites

- Node.js >= 18.17.0
- pnpm >= 8.0.0
- PostgreSQL (local or via Docker)
- Redis (local or via Docker)

### Quick start

```bash
# 1. Clone the repo
git clone https://github.com/your-org/leetscuda.git
cd leetscuda

# 2. Copy env and fill in credentials
cp .env.example .env
# Edit .env — add NEXTAUTH_SECRET, GitHub/Google OAuth client IDs & secrets

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client and run migrations
pnpm --filter @leetscuda/web db:generate
pnpm --filter @leetscuda/web db:migrate

# 5. Start the dev server
pnpm dev
```

App runs at http://localhost:3000.

### OAuth credentials

- **GitHub OAuth**: create an app at https://github.com/settings/developers
  - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- **Google OAuth**: create credentials at https://console.cloud.google.com
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### Local Postgres & Redis (Docker)

```bash
docker run -d --name leetscuda-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=leetscuda \
  -p 5432:5432 postgres:16

docker run -d --name leetscuda-redis \
  -p 6379:6379 redis:7
```

### Useful commands

```bash
pnpm --filter @leetscuda/web db:migrate   # apply Prisma migrations
pnpm --filter @leetscuda/web db:generate  # regenerate Prisma client
pnpm --filter @leetscuda/web db:studio    # open Prisma Studio
pnpm --filter @leetscuda/web lint         # lint the web app
pnpm --filter @leetscuda/web build        # production build
```

## Monorepo structure

```
leetscuda/
  apps/
    web/          Next.js 14 app (App Router, tRPC, Prisma, NextAuth)
    judge/        Standalone judge worker (Phase 6)
  packages/
    ui/           Shared component library
    types/        Shared TypeScript types
  problems/
    cuda/         CUDA & GPU programming problems (MDX)
    ml-systems/   ML systems & inference problems (MDX)
    kubernetes-ai/ Kubernetes for AI problems (MDX)
    foundations/  DSA & C++ foundations problems (MDX)
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| API | tRPC v11 |
| Auth | NextAuth.js v5 |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache/Queue | Redis |
