# System Architecture

> Last updated: 2026-03-29

## Table of Contents

- [1. Tech stack](#1-tech-stack)
- [2. Submission flow](#2-submission-flow)
- [3. Authentication](#3-authentication)
- [4. tRPC routers](#4-trpc-routers)
- [5. Database schema](#5-database-schema)
- [6. Environment variables](#6-environment-variables)

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| API | tRPC v11 |
| Auth | NextAuth.js v5 (GitHub + Google OAuth) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Queue | Redis (ioredis) |
| Code editor | Monaco Editor |
| Markdown | marked + highlight.js |
| C++/CUDA sandbox | Docker — `gcc:14` (C++), `nvidia/cuda:13.0.0-devel-ubuntu24.04` (CUDA) |
| K8s validation | kubeconform (bundled schemas, no cluster required) |

---

## 2. Submission flow

```
Browser
  └─ trpc.submission.create
       └─ Validates: code size, empty, language, duplicate pending, daily limit, rate limit
       └─ Creates Submission (PENDING) in Postgres
       └─ Pushes job to Redis queue
            ├─ judge:queue:cpp         (C++ problems)
            ├─ judge:queue:cuda        (CUDA problems)
            └─ judge:queue:k8s         (Kubernetes manifest problems)

Browser (cancel path)
  └─ trpc.submission.cancel
       └─ LREM from Redis queue — if count=0 judge already picked it up
       └─ Sets status CANCELLED on success

Judge worker (HTTP poll loop)
  └─ On startup: kills orphaned containers (label: leetscuda-judge)
  └─ GET /api/judge/poll  →  job + test cases / k8s checks
  └─ Guards code/manifest size; clamps timeout to JUDGE_MAX_TIMEOUT_MS
  └─ Compiles + runs code in Docker container (cpp/cuda) or runs kubeconform (k8s)
  └─ POST /api/judge/result  →  status, runtimeMs, testResults, errorMsg
       └─ Web API updates Submission in Postgres
       └─ Awards XP + updates streak on first ACCEPTED solve

Browser
  └─ On mount: trpc.submission.getLatestForProblem — auto-resumes polling if PENDING/RUNNING
  └─ Polls trpc.submission.getStatus every 1.5 s until terminal status
  └─ Shows live code size indicator (KB) and daily submission count
```

### System diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                    │
│                                                                             │
│  1. POST /api/trpc/submission.create  ───────────────────────────────────► │
│  4. GET  /api/trpc/submission.getStatus (polls every 1500 ms) ───────────► │
│  10. receives terminal status, renders result panel                         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS (tRPC over HTTP)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js Web App                                                            │
│                                                                             │
│  submission.create mutation:                                                │
│    2. validateSubmission() → INSERT Submission (PENDING)                   │
│    3. RPUSH judge:queue:{runtime} {jobPayload}  ─────────────────────────► │
│                                                                             │
│  /api/judge/poll (GET, long-poll):                                          │
│    5. authenticate judge token (SHA-256 + timingSafeEqual)                 │
│    6. BLPOP queues (blocks up to 30 s)                                      │
│    7. load test cases / k8s-checks from MDX file                           │
│    8. UPDATE Submission status → RUNNING                                   │
│    9. return job payload to judge  ────────────────────────────────────── ►│
│                                                                             │
│  /api/judge/result (POST):                                                  │
│    11. authenticate judge token                                             │
│    12. validate result payload (zod)                                        │
│    13. UPDATE Submission (status, runtimeMs, testResults, errorMsg)         │
│    14. if ACCEPTED: upsert UserProgress, award XP, updateStreak()          │
│    15. return { received: true, firstSolve: boolean }                       │
└──────────┬──────────────────────────────────────────────────────┬───────────┘
           │ Redis RPUSH/BLPOP                                    │ Prisma/pg
           ▼                                                      ▼
┌─────────────────────┐                              ┌────────────────────────┐
│  Redis              │                              │  PostgreSQL            │
│                     │                              │                        │
│  judge:queue:cpp    │                              │  Submission            │
│  judge:queue:cuda   │                              │  JudgeToken            │
│  judge:queue:k8s    │                              │  Problem               │
│  submission:daily:* │                              │  UserProgress          │
│  submission:ratelimit:* │                          │  User                  │
└─────────────────────┘                              └────────────────────────┘
          ▲
          │ HTTPS poll (outbound only from judge)
┌─────────┴───────────────────────────────────────────────────────────────────┐
│  Judge Node (remote VM or bare-metal)                                       │
│                                                                             │
│  C++/CUDA judge (apps/judge-cuda-cpp):                                      │
│    ├── pollForJob() → GET /api/judge/poll                                   │
│    ├── runInSandbox() → Docker build + eval containers                      │
│    └── submitResult() → POST /api/judge/result                              │
│                                                                             │
│  K8s judge (apps/judge-k8s):                                                │
│    ├── pollForJob() → GET /api/judge/poll                                   │
│    ├── validateK8sManifest() → kubeconform + in-process checks              │
│    └── submitResult() → POST /api/judge/result                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Queue routing

| Problem `executionRuntime` | Redis queue |
|---|---|
| `CPP` | `judge:queue:cpp` |
| `CUDA` | `judge:queue:cuda` |
| `K8S` | `judge:queue:k8s` |

CPU judges (capabilities: `cpp`) dequeue only from `judge:queue:cpp`.
GPU judges (capabilities: `cpp,cuda:13.0:sm_120`) dequeue from both `cpp` and `cuda` queues.
K8s judges (capabilities: `k8s`) dequeue only from `judge:queue:k8s`.

---

## 3. Authentication

NextAuth.js v5 with GitHub and Google providers. Sessions are JWTs stored in httpOnly cookies. On first sign-in, users are redirected to `/setup-username` before reaching any platform page.

**Public routes:** `/`, `/signin`, `/roadmap`, `/problems`, `/problems/*`
**Protected:** everything else, plus tRPC mutations using `protectedProcedure`

### Judge token authentication

Judge tokens follow the format `jt_` + 64 hex characters. The plaintext token is shown once at generation and never stored. The database stores only the SHA-256 hash, enabling constant-time lookup without bcrypt's per-hash salt.

Authentication flow on every poll/result request:
1. Extract raw token from `Authorization: Bearer` header
2. Fast-reject if prefix is not `jt_`
3. Compute `SHA-256(rawToken)` → look up by hash in `JudgeToken` table
4. Check `isActive === true`
5. `crypto.timingSafeEqual(storedHash, incomingHash)` — defence-in-depth against timing oracle
6. Update `lastSeenAt` (fire-and-forget)

To revoke a judge: `UPDATE "JudgeToken" SET "isActive" = false WHERE name = 'gpu-1';`

---

## 4. tRPC routers

| Router | Procedures |
|---|---|
| `user` | `me`, `setUsername` |
| `roadmap` | `getTracks`, `getUserProgress` |
| `problems` | `list`, `getBySlug` |
| `submissions` | `create`, `getStatus`, `getLatestForProblem`, `getDailyCount`, `cancel` |
| `profile` | `getByUsername` |

---

## 5. Database schema

```
User           id, email, username, xp, streakDays, role
Track          id, slug, title, color, order
Problem        id, slug, title, difficulty, trackId, tags[], xpReward,
               executionRuntime, cppStandard, cudaMinVersion, computeMinCap
Submission     id, userId, problemId, code, language, status,
               runtimeMs, testResults (JSON), errorMsg,
               cppStandard, cudaMinVersion, computeMinCap
UserProgress   userId, problemId, trackId, solvedAt, attempts
RoadmapNode    id, slug, title, type, trackId, prerequisites[]
Comment        id, userId, problemId, body, upvotes
JudgeToken     id, name, token (SHA-256), capabilities[], isActive, lastSeenAt
```

Key enums:
- `ExecutionRuntime` → `CPP | CUDA | K8S`
- `CppStandard` → `CPP14 | CPP17 | CPP20 | CPP23`
- `SubmissionStatus` → `PENDING | RUNNING | ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_LIMIT | CANCELLED`

CUDA problems store `cudaMinVersion` (e.g. `"13.0"`) and `computeMinCap` (e.g. `"sm_120"`) as optional strings on both `Problem` and `Submission`. These are used by the poll endpoint to route CUDA jobs to judges that meet the version and capability requirements.

---

## 6. Environment variables

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
| `SUBMISSION_DAILY_LIMIT_FREE` | No | Daily submission cap for free users (default: `10`) |
| `SUBMISSION_DAILY_LIMIT_PAID` | No | Daily cap for paid/admin users — `0` = unlimited (default: `0`) |
| `SUBMISSION_MAX_CODE_BYTES` | No | Maximum code payload in bytes (default: `16384`) |
| `SUBMISSION_RATE_LIMIT_PER_MIN` | No | Per-user per-minute rate limit (default: `5`) |
| `SUBMISSION_TIMEOUT_MS` | No | Default judge timeout in ms (default: `30000`) |
| `SUBMISSION_MAX_TIMEOUT_MS` | No | Hard ceiling on judge timeout in ms (default: `60000`) |

\* At least one OAuth provider must be configured.
