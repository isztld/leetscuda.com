# leetscuda.com

**Live at [https://www.leetscuda.com](https://www.leetscuda.com)**

AI Infrastructure Interview Prep Platform — practice CUDA/GPU programming, ML systems, Kubernetes for AI, and systems foundations through real coding problems in your browser.

Targeted at senior/staff-level interviews at GPU-cloud and AI infrastructure companies (Nebius, Groq, Crusoe, Lambda Labs, Anyscale, etc.).

---

## What it is

LeetsCUDA is a LeetCode-style platform where every problem involves something you'd actually encounter building AI infrastructure:

- Writing CUDA kernels (vector-add, matrix-transpose, parallel reduction)
- Implementing ML inference primitives (KV cache, continuous batching, Flash Attention)
- Writing Kubernetes manifests for GPU workloads (vLLM deployments, HPA with custom metrics)
- Systems analysis (roofline model, PCIe bandwidth, false sharing)

Problems are written in MDX, compiled and executed on distributed judge nodes, and presented in a split-pane editor powered by Monaco (the VS Code engine).

---

## Quick start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### 1. Clone and install

```bash
git clone https://github.com/isztld/leetscuda.com.git
cd leetscuda
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leetscuda
REDIS_URL=redis://localhost:6379
```

> The `.env` file lives at the repo root. `apps/web/.env` is a symlink to it — create the symlink if it doesn't exist: `ln -s ../../.env apps/web/.env`

### 3. Start Postgres and Redis

```bash
docker run -d --name leetscuda-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=leetscuda \
  -p 5432:5432 postgres:16

docker run -d --name leetscuda-redis \
  -p 6379:6379 redis:7
```

### 4. Migrate, seed, and sync the database

```bash
pnpm --filter @leetscuda/web db:migrate   # apply schema migrations
pnpm --filter @leetscuda/web db:seed      # seed tracks + roadmap nodes
pnpm --filter @leetscuda/web db:sync      # sync problems from MDX files
pnpm --filter @leetscuda/web theory:sync  # sync theory from MDX files
```

`db:sync` and `theory:sync` must run after `db:seed` because problems reference track IDs created by the seed.

### 5. Start the dev server

```bash
pnpm dev
```

App runs at http://localhost:3000.

---

## OAuth setup

### GitHub

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
3. Copy Client ID and Client Secret into `.env`

### Google

1. Go to https://console.cloud.google.com → APIs & Services → Credentials → **Create OAuth client**
2. Application type: **Web application**
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret into `.env`

---

## Repository structure

```
leetscuda/
├── apps/
│   ├── web/                    Next.js app (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/         Sign-in, username setup pages
│   │   │   ├── (platform)/     Roadmap, problems list, problem detail
│   │   │   └── api/judge/      Judge HTTP API (poll, result, recover)
│   │   ├── lib/                Prisma client, Redis, auth, streak helpers
│   │   ├── scripts/            CLI scripts (create-judge-token, db-sync, theory-sync)
│   │   ├── server/
│   │   │   └── routers/        tRPC routers (user, roadmap, problems, submissions, profile)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts         Reads learning/*/track.mdx to seed tracks + nodes
│   │       └── migrations/
│   ├── judge-cuda-cpp/         C++/CUDA judge worker
│   │   └── ARCHITECTURE.md     Implementation reference
│   └── judge-k8s/              Kubernetes manifest validation judge
│       └── ARCHITECTURE.md     Implementation reference
├── docs/
│   ├── architecture.md         System architecture, DB schema, tRPC, auth
│   ├── judge.md                Judge deployment and operations guide
│   └── content.md              Problem format and content contribution guide
└── learning/                   All content (open for community PRs)
    ├── cuda-core/              CUDA & GPU Programming track
    │   ├── track.mdx           Track metadata + roadmap node definitions
    │   ├── problems/           vector-add, matrix-transpose, matrix-multiply, reduce-sum
    │   └── theory/             cuda-intro, cuda-threads, cuda-memory, cuda-streams
    ├── ml-systems/             ML Systems & Inference track
    ├── kubernetes-ai/          Kubernetes for AI track
    └── foundations/            Foundations track
```

---

## Development commands

```bash
# Web app
pnpm dev                                    # start Next.js dev server
pnpm --filter @leetscuda/web lint
pnpm --filter @leetscuda/web build

# Judge workers
cd apps/judge-cuda-cpp && pnpm dev          # C++/CUDA judge (watch mode)
cd apps/judge-k8s && pnpm dev              # K8s judge (watch mode)

# Database
pnpm --filter @leetscuda/web db:generate    # regenerate Prisma client after schema changes
pnpm --filter @leetscuda/web db:migrate     # apply pending migrations
pnpm --filter @leetscuda/web db:seed        # seed tracks + roadmap nodes from learning/*/track.mdx
pnpm --filter @leetscuda/web db:sync        # sync problems from MDX files
pnpm --filter @leetscuda/web db:studio      # open Prisma Studio

# Token management
pnpm --filter @leetscuda/web judge:token --name <name> --capabilities <csv>
```

---

## Documentation

- **[docs/architecture.md](docs/architecture.md)** — Submission flow, tech stack, database schema, tRPC routers, authentication, environment variables
- **[docs/judge.md](docs/judge.md)** — Setting up and operating judge nodes (CPU, GPU, K8s)
- **[docs/content.md](docs/content.md)** — Problem and theory content format; contributing new problems

**Contributing content?** See [`docs/content.md`](docs/content.md) — problems, theory articles, and track definitions are open for community PRs.
