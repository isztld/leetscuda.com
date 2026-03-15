# leetscuda.com

AI Infrastructure Interview Prep Platform — practice CUDA/GPU programming, ML systems, Kubernetes for AI, and systems foundations through real coding problems in your browser.

Targeted at senior/staff-level interviews at GPU-cloud and AI infrastructure companies (Nebius, Groq, Crusoe, Lambda Labs, Anyscale, etc.).

---

## What it is

LeetsCUDA is a LeetCode-style platform where every problem involves something you'd actually encounter building AI infrastructure:

- Writing CUDA kernels (vector-add, matrix-transpose, parallel reduction)
- Implementing ML inference primitives (KV cache, continuous batching, Flash Attention)
- Writing Kubernetes manifests for GPU workloads (vLLM deployments, HPA with custom metrics)
- Systems analysis (roofline model, PCIe bandwidth, false sharing)

Problems are written in MDX, compiled server-side, and presented in a split-pane editor powered by Monaco (the VS Code engine).

---

## Quick start

### Prerequisites

- Node.js >= 18.17.0
- pnpm >= 8.0.0
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### 1. Clone and install

```bash
git clone https://github.com/your-org/leetscuda.git
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

### 3. Start Postgres and Redis (Docker)

```bash
docker run -d --name leetscuda-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=leetscuda \
  -p 5432:5432 postgres:16

docker run -d --name leetscuda-redis \
  -p 6379:6379 redis:7
```

### 4. Migrate and seed the database

```bash
pnpm --filter @leetscuda/web db:migrate   # run all migrations
pnpm --filter @leetscuda/web db:seed      # seed tracks, roadmap nodes, 12 problems
```

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
│   ├── web/                    Next.js 14 app (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/         Sign-in, username setup pages
│   │   │   └── (platform)/     Roadmap, problems list, problem detail
│   │   ├── components/         React components
│   │   ├── lib/                Prisma client, tRPC client, problems content loader
│   │   ├── server/
│   │   │   └── routers/        tRPC routers (user, roadmap, problems, submission)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── judge/                  Standalone judge worker (Phase 6 — not yet built)
├── packages/
│   ├── ui/                     Shared component library (stub)
│   └── types/                  Shared TypeScript types (stub)
└── problems/                   Problem content (MDX files)
    ├── cuda/
    │   ├── vector-add/index.mdx
    │   ├── matrix-transpose/index.mdx
    │   └── reduce-sum/index.mdx
    ├── ml-systems/
    │   ├── kv-cache/index.mdx
    │   ├── batched-inference/index.mdx
    │   └── flash-attention/index.mdx
    ├── kubernetes-ai/
    │   ├── deploy-inference-server/index.mdx
    │   ├── hpa-gpu/index.mdx
    │   └── multi-node-training/index.mdx
    └── foundations/
        ├── pcie-bandwidth/index.mdx
        ├── roofline-model/index.mdx
        └── false-sharing/index.mdx
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + @tailwindcss/typography |
| API | tRPC v11 |
| Auth | NextAuth.js v5 (GitHub + Google OAuth) |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Cache / Queue | Redis (ioredis) |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Markdown | marked + highlight.js |
| Judge | Docker + Firejail (Phase 6) |

---

## Architecture

### Request flow

```
Browser → Next.js App Router (Server Components)
                ↓ Prisma (direct DB queries for server pages)
                ↓ tRPC (client-side mutations and queries)
                      ↓ protectedProcedure (NextAuth session check)
                      ↓ Prisma (DB reads/writes)
                      ↓ Redis rpush (job queue for judge)
```

### Authentication

NextAuth.js v5 with GitHub and Google providers. Sessions are JWTs stored in httpOnly cookies. On first sign-in, users are redirected to `/setup-username` before reaching any platform page. The middleware at `apps/web/middleware.ts` enforces this.

Public routes (no auth required): `/`, `/signin`, `/roadmap`, `/problems`, `/problems/*`
Protected: everything else, plus tRPC mutations that use `protectedProcedure`

### tRPC routers

| Router | Procedures |
|---|---|
| `user` | `me`, `setUsername` |
| `roadmap` | `getTracks`, `getUserProgress` |
| `problems` | `list`, `getBySlug` |
| `submission` | `create`, `getStatus` |

### Database schema (key models)

```
User           id, email, username, xp, streakDays, role
Track          id, slug, title, color, order
Problem        id, slug, title, difficulty, trackId, tags[], xpReward, executionMode
Submission     id, userId, problemId, code, language, status, runtimeMs, output, errorMsg
UserProgress   userId, problemId, trackId, solvedAt, attempts
RoadmapNode    id, slug, title, type, trackId, prerequisites[]
Comment        id, userId, problemId, body, upvotes
```

`SubmissionStatus` enum: `PENDING | RUNNING | ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_LIMIT`

### Submission flow

1. User clicks **Submit** → `trpc.submission.create` mutation
2. Server writes a `PENDING` submission to Postgres and pushes a job to Redis (`judge:queue`)
3. Client polls `trpc.submission.getStatus` every 1500 ms
4. Judge worker (Phase 6) pops the job, compiles and runs the code in a Docker/Firejail sandbox, writes result back to Postgres
5. Client detects terminal status and stops polling

While the judge is not yet running, submissions sit as `PENDING` indefinitely. The UI handles this with a spinner and "Waiting for judge…" message.

---

## Problem format (MDX)

Every problem lives at `problems/{track}/{slug}/index.mdx`. The file has four sections:

```
---
[YAML frontmatter — must match DB seed exactly]
---

[Markdown description — rendered to HTML with syntax highlighting]

---starter-code---
[C++ / CUDA starter code shown in Monaco editor]

---test-cases---
[YAML array of {name, input, expected} test cases]

---solution---
[Reference solution — never sent to the client, used by judge only]
```

### Frontmatter fields

```yaml
slug: vector-add           # must match DB Problem.slug
title: Vector Addition     # must match DB Problem.title
difficulty: EASY           # EASY | MEDIUM | HARD
track: cuda                # cuda | ml-systems | kubernetes-ai | foundations
tags:
  - memory
  - threads
execution: CPU_SIM         # CPU_SIM | GPU_BASIC | GPU_PERF
status: PUBLISHED
xp: 100
```

### Adding a new problem

1. Create `problems/{track}/{slug}/index.mdx` following the format above
2. Add a matching entry to `PROBLEMS` in `apps/web/prisma/seed.ts`
3. Re-run `pnpm --filter @leetscuda/web db:seed`
4. The problem will appear at `/problems/{slug}`

---

## Running the judge

The judge worker processes submissions from the Redis queue, compiles and runs code in a Docker sandbox, and writes results back to Postgres.

### Local dev (without Docker)

If Docker is not available, the judge falls back to running `g++` directly as a child process. Ensure `g++` is installed.

```bash
cp apps/judge/.env.example apps/judge/.env
# Edit apps/judge/.env and fill in DATABASE_URL and REDIS_URL

pnpm --filter @leetscuda/judge dev
```

The worker logs `Judge worker ready` when connected to Redis and Postgres.

### Production (Docker)

The judge container runs sandbox containers via the host Docker socket.

```bash
# Build the judge image
docker build -t leetscuda-judge apps/judge

# Run it — mount the host Docker socket and the problems directory
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/problems:/problems \
  -e PROBLEMS_PATH=/problems \
  --env-file apps/judge/.env \
  leetscuda-judge
```

> **Note:** Mounting `/var/run/docker.sock` gives the judge container access to the host Docker daemon so it can spin up per-submission sandbox containers (`gcc:latest`). In production, restrict Docker socket access appropriately (e.g., via a dedicated `docker` group or a socket proxy).

---

## Development commands

```bash
# Run dev server
pnpm dev

# Run judge worker (separate terminal)
pnpm --filter @leetscuda/judge dev

# Database
pnpm --filter @leetscuda/web db:migrate    # apply migrations
pnpm --filter @leetscuda/web db:generate   # regenerate Prisma client after schema changes
pnpm --filter @leetscuda/web db:seed       # seed tracks + problems
pnpm --filter @leetscuda/web db:studio     # open Prisma Studio (GUI)

# Code quality
pnpm --filter @leetscuda/web lint
pnpm --filter @leetscuda/web build         # production build check
```

---

## Build phases

| Phase | Status | What was built |
|---|---|---|
| 1 | Done | Monorepo scaffold, Prisma schema, NextAuth, tRPC, middleware |
| 2 | Done | Sign-in page, username setup, session management |
| 3 | Done | Roadmap page with dependency graph |
| 4 | Done | Problems listing page with filters |
| 5 | Done | Problem detail page — Monaco editor, MDX rendering, submission flow |
| 6 | Done | Judge worker — Docker/fallback sandbox, test case verification, XP award |
| 7 | Pending | User profile, XP leaderboard, streak tracking |
| 8 | Pending | Comments system |
| 9 | Pending | Contributor tooling — problem authoring workflow |

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full URL of the app, e.g. `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | Yes* | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes* | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |

*At least one OAuth provider must be configured.
