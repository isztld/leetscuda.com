# Project Context

## Purpose
LeetsCUDA is an AI infrastructure interview prep platform — a LeetCode-style coding practice site specialized for senior/staff-level interviews at GPU-cloud and AI infrastructure companies (Nebius, Groq, Crusoe, Lambda Labs, Anyscale, etc.). Users write and submit CUDA kernels, C++ code, ML inference primitives, and Kubernetes manifests that are executed in sandboxed Docker containers on distributed judge nodes.

## Tech Stack

### Frontend & Web
- **Next.js 16** (App Router) with **React 19**
- **TypeScript 5.6+** (strict mode)
- **Tailwind CSS v4** for styling
- **Monaco Editor** (VS Code engine) for the code editor
- **tRPC v11** with React Query v5 for type-safe API calls
- **marked + highlight.js** for Markdown rendering and syntax highlighting

### Backend & Data
- **tRPC** routers for all API endpoints
- **PostgreSQL** via **Prisma ORM v7**
- **NextAuth.js v5** (GitHub + Google OAuth, JWT sessions)
- **Redis** (ioredis) for job queues and caching

### Judge (Code Execution)
- **TypeScript** (ts-node via tsx) — stateless HTTP workers
- **Docker** sandboxing with seccomp profiles
- Base images: `gcc:14` (C++), `nvidia/cuda:13.0.0-devel-ubuntu24.04` (CUDA), custom `kubeconform` (K8s)
- Capability-aware queue routing (CPU vs GPU judges)

### DevOps
- **pnpm workspaces** monorepo
- **GitHub Actions** for CI/CD (problem sync on merge)
- **Docker Compose** for local dev (Postgres + Redis)

## Project Conventions

### Code Style
- **Path aliases**: `@/*` for imports from the web app root (e.g., `import { prisma } from '@/lib/prisma'`)
- **Components**: PascalCase (`MonacoEditor`, `ProblemDetail`)
- **Functions**: camelCase (`loadProblemContent`, `runInSandbox`)
- **Slugs/IDs**: kebab-case (`vector-add`, `cuda-core`)
- **Environment constants**: UPPER_SNAKE_CASE
- **Enums** (Prisma): PascalCase values (`CPP`, `CUDA`, `K8S`)

### Architecture Patterns
- **Monorepo layout**: `apps/web` (Next.js), `apps/judge` (worker), `packages/ui`, `packages/types`, `learning/` (content)
- **Server Components** with App Router — protected routes enforced at middleware level
- **tRPC routers**: `user`, `roadmap`, `problems`, `submissions`, `profile`
- **Content as code**: MDX files in `learning/` are the single source of truth; synced to DB via `db:sync` and `theory:sync` scripts
- **Submission flow**: User submits → Redis queue → Judge polls → Docker sandbox execution → Results reported back → DB updated
- **Submission guards**: Rate limiting (per-minute), daily caps, max code size, duplicate prevention
- **Judge architecture**: Stateless workers with capability declarations, heartbeat tracking, orphaned container cleanup, submission watchdog for stuck jobs

### Testing Strategy
No formal test framework is configured. Testing is manual via local dev and judge integration. CI validates MDX frontmatter on PR merge. A `validate:tracks` script ensures track.mdx nodes have matching problem files.

### Git Workflow
- **Primary branch**: `main-dev`
- **Commit style**: Conventional commits (`feat:`, `fix:`, `refactor:`, `audit:`, `chore:`)
- **CI**: GitHub Actions triggers problem sync on push to `main` branch for `learning/**/*.mdx` changes

## Domain Context
- **Execution runtimes**: C++ (gcc:14), CUDA (nvidia/cuda 13.0), Kubernetes (kubeconform validation)
- **Problem format**: MDX with YAML frontmatter + delimited sections (`---starter-code---`, `---test-cases---`, `---solution---`, `---harness---`, `---editorial---`)
- **Track structure**: Each track (cuda-core, cuda-hpc, gpu-llm, ml-systems, kubernetes-ai, foundations) contains problems, theory articles, and long-form articles organized by roadmap nodes
- **XP & streaks**: Users earn XP for accepted submissions and build daily streaks
- **Judge capabilities**: Judges declare what runtimes they support (e.g., `cpp`, `cpp,cuda:13.0`); queue routing matches jobs to capable judges

## Important Constraints
- **Security**: Docker sandboxes use seccomp profiles, non-root execution, memory/CPU limits, network isolation, and SIGTERM→SIGKILL timeouts
- **Environment**: Judge requires host Docker socket access; GPU judges need NVIDIA Docker runtime
- **Env file**: `apps/web/.env` (copy from `apps/web/.env.example`)
- **At least one OAuth provider** (GitHub or Google) must be configured
- **Node.js 20+** required

## External Dependencies
- **PostgreSQL**: Primary database, schema managed via Prisma migrations
- **Redis**: Submission job queue and caching
- **GitHub/Google OAuth**: User authentication providers
- **NVIDIA Docker runtime**: Required for GPU judge execution
- **Docker Hub images**: `gcc:14`, `nvidia/cuda:13.0.0-devel-ubuntu24.04`
