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
```

`db:sync` must run after `db:seed` because problems reference track IDs created by the seed.

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
│   ├── web/                    Next.js 16 app (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/         Sign-in, username setup pages
│   │   │   ├── (platform)/     Roadmap, problems list, problem detail
│   │   │   └── api/judge/      Judge HTTP API (poll + result endpoints)
│   │   ├── lib/                Prisma client, Redis, auth, runtime maps, streak
│   │   ├── scripts/            CLI scripts (create-judge-token)
│   │   ├── server/
│   │   │   └── routers/        tRPC routers (user, roadmap, problems, submissions)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts
│   │       └── migrations/
│   └── judge/                  Standalone judge worker (HTTP client, no DB/Redis)
│       ├── tmp/                Scratch space for per-submission source + binary
│       └── src/
│           ├── worker.ts       Main poll loop
│           ├── api-client.ts   HTTP client for poll + result endpoints
│           ├── sandbox.ts      Docker-based code execution
│           ├── verifier.ts     Output comparison with float tolerance + fill expansion
│           ├── env.ts          Environment validation
│           └── types.ts        Shared types and Zod schemas
└── problems/                   Problem content (MDX files)
    ├── cuda/
    │   ├── vector-add/index.mdx
    │   ├── matrix-multiply/index.mdx
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
| Frontend | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| API | tRPC v11 |
| Auth | NextAuth.js v5 (GitHub + Google OAuth) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Queue | Redis (ioredis) |
| Code editor | Monaco Editor |
| Markdown | marked + highlight.js |
| Judge sandbox | Docker — `gcc:14` (C++), `nvidia/cuda:13.0.0-devel-ubuntu24.04` (CUDA) |

---

## Architecture

### Submission flow

```
Browser
  └─ trpc.submission.create
       └─ Creates Submission (PENDING) in Postgres
       └─ Pushes job to Redis queue
            ├─ judge:queue:cpp        (C++ problems)
            └─ judge:queue:cuda:13.0  (CUDA problems)

Judge worker (HTTP poll loop)
  └─ GET /api/judge/poll  →  job + test cases
  └─ Compiles + runs code in Docker sandbox
  └─ POST /api/judge/result  →  status, runtimeMs, output
       └─ Web API updates Submission in Postgres
       └─ Awards XP + updates streak on first ACCEPTED solve

Browser
  └─ Polls trpc.submission.getStatus every 1.5s until terminal status
```

### Judge architecture

Judge nodes are stateless HTTP clients. Each node declares its capabilities (e.g. `cpp` or `cpp,cuda:13.0`) when its token is created. The web API uses those capabilities to determine which queues to offer during polling — CPU judges only receive C++ jobs, GPU judges receive both.

Judges have no direct access to the database or Redis. All state transitions happen through the web API.

### Authentication

NextAuth.js v5 with GitHub and Google providers. Sessions are JWTs stored in httpOnly cookies. On first sign-in, users are redirected to `/setup-username` before reaching any platform page.

Public routes: `/`, `/signin`, `/roadmap`, `/problems`, `/problems/*`
Protected: everything else, plus tRPC mutations using `protectedProcedure`

### tRPC routers

| Router | Procedures |
|---|---|
| `user` | `me`, `setUsername` |
| `roadmap` | `getTracks`, `getUserProgress` |
| `problems` | `list`, `getBySlug` |
| `submissions` | `create`, `getStatus` |
| `profile` | `getByUsername` |

### Database schema

```
User           id, email, username, xp, streakDays, role
Track          id, slug, title, color, order
Problem        id, slug, title, difficulty, trackId, tags[], xpReward,
               executionRuntime, cppStandard, cudaVersion, computeCap
Submission     id, userId, problemId, code, language, status,
               runtimeMs, output, errorMsg,
               cppStandard, cudaVersion, computeCap
UserProgress   userId, problemId, trackId, solvedAt, attempts
RoadmapNode    id, slug, title, type, trackId, prerequisites[]
Comment        id, userId, problemId, body, upvotes
JudgeToken     id, name, token (SHA-256), capabilities[], isActive, lastSeenAt
```

Key enums: `ExecutionRuntime { CPP CUDA }` · `CppStandard { CPP14 CPP17 CPP20 CPP23 }` · `CudaVersion { CUDA_13_0 }` · `ComputeCap { SM_86 SM_120 }` · `SubmissionStatus { PENDING RUNNING ACCEPTED WRONG_ANSWER RUNTIME_ERROR TIME_LIMIT }`

---

## Problem format (MDX)

Every problem lives at `problems/{track}/{slug}/index.mdx` with five sections:

```
---
[YAML frontmatter]
---

[Markdown description — rendered to HTML with syntax highlighting]

---starter-code---
[C++ / CUDA starter code shown in Monaco editor]

---test-cases---
[YAML array of {name, input, expected} test cases]

---solution---
[Reference solution — never sent to the client]

---harness---
[C++ main() that parses stdin, calls solve(), prints result to stdout]
```

The harness is appended to the user's submitted code before compilation, supplying the `main()` entry point. Users write only the kernel(s) and `solve()` — the harness wires everything up and handles I/O.

### Test case format

Test case `input` is fed verbatim to the compiled binary via stdin. `expected` is compared against stdout using float-tolerant line-by-line matching (tolerance ±0.001).

Harnesses support a compact `fill:X` input shorthand for uniform arrays (e.g. `fill:1.0` fills N elements with 1.0). Expected values support `fill:N:X` shorthand (e.g. `fill:256:16.0` expands to 256 space-separated `16.0` values before comparison).

Self-verifying test cases output `1` (pass) or `0` (fail) — the harness computes the CPU reference internally and compares against the GPU result.

### Frontmatter fields

MDX frontmatter is the **single source of truth** for all problem metadata. The database is a derived cache populated by `db:sync`.

```yaml
slug: vector-add           # lowercase alphanumeric + hyphens; must match directory name
title: Vector Addition
difficulty: easy           # easy | medium | hard
track: cuda                # cuda | ml-systems | kubernetes-ai | foundations
tags:
  - memory
  - threads
status: published          # published | draft
xp: 100
author: community

# Execution runtime (determines which judge queue receives this problem)
runtime: cuda              # cpp | cuda
cpp_standard: "17"         # "14" | "17" | "20" | "23"
cuda_version: "13.0"       # cuda only
compute_cap: "sm_120"      # cuda only
```

For C++ problems omit `cuda_version` and `compute_cap`.

### Adding a problem

1. Create `problems/{track}/{slug}/index.mdx` following the frontmatter schema above
2. Write the description, starter code, test cases, and solution sections
3. Open a PR — CI validates frontmatter on merge
4. On merge to main, GitHub Actions automatically syncs the problem to the DB

```bash
# Manual sync for local development
pnpm --filter @leetscuda/web db:sync
```

---

## Adding theory content

Theory pages live at `/learn/{slug}` and are powered by MDX files in `theory/` at the monorepo root.

### Directory structure

```
theory/
  cuda/
    cuda-intro/index.mdx
    cuda-threads/index.mdx
    cuda-memory/index.mdx
    cuda-streams/index.mdx
  ml-systems/
    ml-inference-basics/index.mdx
    quantization-intro/index.mdx
  kubernetes-ai/
    k8s-basics/index.mdx
    gpu-operator/index.mdx
  foundations/
    memory-model/index.mdx
    simd-basics/index.mdx
    profiling-basics/index.mdx
```

### Frontmatter schema

```yaml
---
slug: cuda-intro
title: Introduction to CUDA
track: cuda
type: concept
tags:
  - gpu
  - programming-model
status: published
author: team
---
```

Required fields: `slug`, `title`, `track`, `type` (must be `concept`), `status` (`published` or `draft`).

### Adding a new theory page

1. Create `theory/{track}/{slug}/index.mdx` with the correct frontmatter
2. The `slug` must match an existing `CONCEPT` `RoadmapNode` slug in `apps/web/prisma/seed.ts`
3. Run `pnpm theory:sync` to validate frontmatter and verify all CONCEPT nodes are covered
4. On merge to main, the page is immediately available at `/learn/{slug}`

```bash
pnpm --filter @leetscuda/web theory:sync
```

---

## Judge node setup

Judge nodes are standalone processes that poll the web API for jobs, compile and run code in an isolated Docker sandbox, and POST results back. They have **zero** direct database or Redis access.

### 1. Generate a token

Run from the repo root (requires `DATABASE_URL` in your environment):

```bash
# CPU-only judge
pnpm --filter @leetscuda/web judge:token --name "cpu-worker-1" --capabilities "cpp"

# GPU judge (CUDA 13.0)
pnpm --filter @leetscuda/web judge:token --name "gpu-helsinki" --capabilities "cpp,cuda:13.0"
```

The token is printed **once** to stdout and never retrievable again. Store it in a secret manager immediately.

### 2. Configure the judge

```bash
cp apps/judge/.env.example apps/judge/.env
```

```
JUDGE_API_URL=https://leetscuda.com
JUDGE_API_TOKEN=jt_...
JUDGE_CAPABILITIES=cpp,cuda:13.0

# Required when running the judge inside Docker with the host Docker socket.
# Set to the absolute host path of apps/judge/tmp (must match the -v mount below).
JUDGE_HOST_TMP_DIR=/your/repo/apps/judge/tmp
```

### 3. Pre-pull sandbox images (once per machine)

```bash
docker pull gcc:14
docker pull nvidia/cuda:13.0.0-devel-ubuntu24.04
```

### 4. Run

```bash
# Local dev (CPU only)
pnpm --filter @leetscuda/judge dev

# Production — CPU judge
docker build -t leetscuda-judge -f apps/judge/Dockerfile .
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /your/repo/apps/judge/tmp:/app/apps/judge/tmp \
  --env-file apps/judge/.env \
  leetscuda-judge

# Production — GPU judge
docker build -t leetscuda-judge -f apps/judge/Dockerfile .
docker run \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /your/repo/apps/judge/tmp:/app/apps/judge/tmp \
  --gpus all \
  --env-file apps/judge/.env \
  leetscuda-judge
```

> **DinD path note:** The judge runs sibling Docker containers via the host socket. Volume mounts on those containers must reference host-side paths. The `-v .../tmp:/app/apps/judge/tmp` mount exposes the same directory under the same path to both the judge container and the Docker daemon, and `JUDGE_HOST_TMP_DIR` tells the judge which host path to use for those mounts.

GPU hosts additionally require NVIDIA drivers with CUDA 13.0 and `nvidia-container-toolkit`.

### Job routing

| Problem `executionRuntime` | Redis queue |
|---|---|
| `CPP` | `judge:queue:cpp` |
| `CUDA` (version 13.0) | `judge:queue:cuda:13.0` |

CPU judges (capabilities: `cpp`) only dequeue from `judge:queue:cpp`.
GPU judges (capabilities: `cpp,cuda:13.0`) dequeue from both.

### Sandbox behaviour

| Runtime | Docker image | Compile command |
|---|---|---|
| C++ | `gcc:14` | `g++ -std=c++{N} -O2 -o solution solution.cpp` |
| CUDA | `nvidia/cuda:13.0.0-devel-ubuntu24.04` | `nvcc -std=c++{N} -arch={cap} -O2 -o solution solution.cu` |

C++ containers: `--memory 256m --cpus 0.5 --ulimit nproc=64 --network none`
CUDA containers: `--memory 512m --gpus device=0 --ulimit nproc=128 --network none`

### Revoke a judge node

Set `isActive = false` on the `JudgeToken` row in the database. The next poll attempt returns 401 and the process exits.

---

## Development commands

```bash
# Web app
pnpm dev                                    # start Next.js dev server
pnpm --filter @leetscuda/web lint
pnpm --filter @leetscuda/web build

# Judge worker
pnpm --filter @leetscuda/judge dev          # watch mode

# Database
pnpm --filter @leetscuda/web db:migrate     # apply pending migrations
pnpm --filter @leetscuda/web db:generate    # regenerate Prisma client after schema changes
pnpm --filter @leetscuda/web db:seed        # seed tracks, roadmap nodes, 12 problems
pnpm --filter @leetscuda/web db:studio      # open Prisma Studio

# Token management
pnpm --filter @leetscuda/web judge:token --name <name> --capabilities <csv>
```

---

## Environment variables

### Web app (`apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | JWT signing secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full public URL, e.g. `http://localhost:3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `GITHUB_CLIENT_ID` | Yes* | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes* | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

\* At least one OAuth provider must be configured.

### Judge (`apps/judge/.env`)

| Variable | Required | Description |
|---|---|---|
| `JUDGE_API_URL` | Yes | Base URL of the web app, e.g. `https://leetscuda.com` |
| `JUDGE_API_TOKEN` | Yes | Token generated by `judge:token` (starts with `jt_`) |
| `JUDGE_CAPABILITIES` | Yes | Comma-separated list, e.g. `cpp` or `cpp,cuda:13.0` |
| `JUDGE_HOST_TMP_DIR` | When Dockerized | Absolute host path of `apps/judge/tmp`; required when the judge itself runs inside Docker so that sibling container volume mounts resolve on the host filesystem |

---

## Build phases

| Phase | Status | What was built |
|---|---|---|
| 1 | Done | Monorepo scaffold, Prisma schema, NextAuth, tRPC, middleware |
| 2 | Done | Sign-in page, username setup, session management |
| 3 | Done | Roadmap page with prerequisite graph |
| 4 | Done | Problems listing with track/difficulty/tag filters |
| 5 | Done | Problem detail — Monaco editor, MDX rendering, submission polling |
| 6 | Done | Judge worker — Docker sandbox, test case verification, XP + streak |
| 6.5 | Done | Error boundaries, skeletons, submission hardening, env validation, observability |
| 7 | Done | Profile page, tRPC profile router, streak logic |
| 9 | Done | Mobile layout, metadata, favicon, copy-code button, submit spinner |
| 10 | Done | Distributed judge — HTTP API, capability-aware queue routing, JudgeToken, runtime enums |
| 10.5 | Done | Judge end-to-end fix — DinD volume path, harness pipeline, CUDA banner bypass; all CUDA problems judged |
