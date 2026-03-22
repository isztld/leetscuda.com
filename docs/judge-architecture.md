# leetscuda.com Judge — Technical Architecture

> Version: 0.0.1
> Last updated: 2026-03-22
> Runtimes supported: C++ (cpu), CUDA (gpu), Kubernetes YAML (k8s)

## Table of Contents

- [1. Overview](#1-overview)
  - [1.1 Design principles](#11-design-principles)
  - [1.2 Supported runtimes](#12-supported-runtimes)
- [2. System architecture](#2-system-architecture)
  - [2.1 High-level architecture diagram](#21-high-level-architecture-diagram)
  - [2.2 Judge node variants](#22-judge-node-variants)
  - [2.3 Network topology](#23-network-topology)
- [3. Authentication and token system](#3-authentication-and-token-system)
  - [3.1 Token format and generation](#31-token-format-and-generation)
  - [3.2 Token capabilities](#32-token-capabilities)
  - [3.3 Authentication flow](#33-authentication-flow)
  - [3.4 Timing-safe comparison](#34-timing-safe-comparison)
  - [3.5 Token revocation](#35-token-revocation)
- [4. Job lifecycle — end to end](#4-job-lifecycle--end-to-end)
  - [4.1 Complete sequence diagram](#41-complete-sequence-diagram)
  - [4.2 Job payload structure](#42-job-payload-structure)
  - [4.3 Result payload structure](#43-result-payload-structure)
- [5. MDX problem format and judge integration](#5-mdx-problem-format-and-judge-integration)
  - [5.1 MDX section anatomy](#51-mdx-section-anatomy)
  - [5.2 Test case parsing](#52-test-case-parsing)
  - [5.3 Security: solution never leaves the server](#53-security-solution-never-leaves-the-server)
  - [5.4 K8s problems: k8s-checks format](#54-k8s-problems-k8s-checks-format)
- [6. Sandbox execution — C++ and CUDA](#6-sandbox-execution--c-and-cuda)
  - [6.1 Docker-in-Docker architecture](#61-docker-in-docker-architecture)
  - [6.2 Temp directory lifecycle](#62-temp-directory-lifecycle)
  - [6.3 Docker run flags — security rationale](#63-docker-run-flags--security-rationale)
  - [6.4 Compilation step](#64-compilation-step)
  - [6.5 Execution and timing](#65-execution-and-timing)
  - [6.6 Timeout enforcement — two-phase kill](#66-timeout-enforcement--two-phase-kill)
  - [6.7 Orphan container cleanup](#67-orphan-container-cleanup)
  - [6.8 Output sanitization and size limits](#68-output-sanitization-and-size-limits)
  - [6.9 Direct execution fallback](#69-direct-execution-fallback)
- [7. Output verification](#7-output-verification)
  - [7.1 Verifier logic](#71-verifier-logic)
  - [7.2 Fill shorthand expansion](#72-fill-shorthand-expansion)
  - [7.3 Determining final status](#73-determining-final-status)
- [8. Kubernetes manifest validation](#8-kubernetes-manifest-validation)
  - [8.1 Why kubectl is not used](#81-why-kubectl-is-not-used)
  - [8.2 Validation pipeline](#82-validation-pipeline)
  - [8.3 JSONPath resolver](#83-jsonpath-resolver)
  - [8.4 Assertion operators](#84-assertion-operators)
  - [8.5 K8s judge node — no Docker socket needed](#85-k8s-judge-node--no-docker-socket-needed)
- [9. Submission limits and hardening](#9-submission-limits-and-hardening)
  - [9.1 Validation layers](#91-validation-layers)
  - [9.2 Rate limiting implementation](#92-rate-limiting-implementation)
  - [9.3 Submission cancellation](#93-submission-cancellation)
  - [9.4 Environment variables reference](#94-environment-variables-reference)
- [10. Observability and debugging](#10-observability-and-debugging)
  - [10.1 Log format](#101-log-format)
  - [10.2 Common failure modes and diagnosis](#102-common-failure-modes-and-diagnosis)
  - [10.3 Health check](#103-health-check)
- [11. Operating a judge node](#11-operating-a-judge-node)
  - [11.1 CPU judge setup](#111-cpu-judge-setup)
  - [11.2 GPU judge setup](#112-gpu-judge-setup)
  - [11.3 K8s judge setup](#113-k8s-judge-setup)
  - [11.4 DinD host path mapping](#114-dind-host-path-mapping)
  - [11.5 Revoking a judge node](#115-revoking-a-judge-node)
- [12. Security considerations](#12-security-considerations)
  - [12.1 Threat model](#121-threat-model)
  - [12.2 Known limitations](#122-known-limitations)
- [Appendix A — Data flow diagrams](#appendix-a--data-flow-diagrams)
- [Appendix B — Queue message format](#appendix-b--queue-message-format)
- [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Overview

The leetscuda judge is a standalone Node.js worker process that evaluates user code submissions against predefined test cases and reports the outcome back to the web application. It exists as a separate service rather than running inside Next.js because code execution requires either GPU hardware (NVIDIA CUDA), long-running container sandboxes, or both — workloads that are incompatible with serverless/edge compute environments like Vercel. Separating the judge also allows the web application to remain stateless and deploy anywhere, while one or more judge nodes can be provisioned on dedicated hardware with the exact capabilities each runtime demands.

### 1.1 Design principles

- **Pull-based polling** — the judge initiates all communication. It long-polls the web app's `/api/judge/poll` endpoint for work. The judge machine never needs an inbound port opened, no reverse proxy, no webhook delivery. This makes it trivial to run behind NAT or in an ephemeral cloud VM.
- **Capability-aware routing** — each judge token declares what it can run (`cpp`, `cuda:13.0`, `k8s`). The poll endpoint uses those capabilities to BLPOP from only the queues that token can service. A CPU-only judge never receives CUDA jobs.
- **Defense in depth** — security is layered: bearer-token authentication, SHA-256 hashed token storage, timing-safe comparison, Docker network isolation, memory/CPU limits, ulimits, output size caps, and a secondary code-size check inside the judge itself.
- **Stateless judge** — the judge holds no local database, no Redis connection, and no persistent state between jobs. All state (submission records, user progress, XP) lives in the web app's Postgres database. The judge is disposable: kill it, restart it, and it resumes with a fresh orphan-container cleanup pass.

### 1.2 Supported runtimes

| Runtime | Queue | Docker image | Use case |
|---------|-------|-------------|----------|
| `cpp` | `judge:queue:cpp` | `gcc:14` | C++ problems (compiled with g++) |
| `cuda` | `judge:queue:cuda:{version}` (e.g. `judge:queue:cuda:13.0`) | `nvidia/cuda:13.0.0-devel-ubuntu24.04` | GPU kernel problems (compiled with nvcc) |
| `k8s` | `judge:queue:k8s` | n/a (runs `kubeconform` directly) | Kubernetes manifest validation |

---

## 2. System architecture

### 2.1 High-level architecture diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                    │
│                                                                             │
│  1. POST /api/trpc/submission.create  ──────────────────────────────────►  │
│  4. GET  /api/trpc/submission.getStatus (polls every 1500 ms) ──────────►  │
│  10. receives terminal status, renders result panel                         │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTPS (tRPC over HTTP)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js Web App (Vercel)                                                   │
│                                                                             │
│  submission.create mutation:                                                │
│    2. validateSubmission() → INSERT Submission (PENDING)                    │
│    3. RPUSH judge:queue:{runtime} {jobPayload}  ──────────────────────────►│
│                                                                             │
│  /api/judge/poll (GET, long-poll):                                          │
│    5. authenticate judge token (SHA-256 + timingSafeEqual)                  │
│    6. BLPOP queues (blocks up to 30 s) ◄──────────────────────────────────│
│    7. load test cases / k8s-checks from MDX file                            │
│    8. UPDATE Submission status → RUNNING                                    │
│    9. return job payload to judge  ────────────────────────────────────────►│
│                                                                             │
│  /api/judge/result (POST):                                                  │
│    11. authenticate judge token                                             │
│    12. validate result payload (zod)                                        │
│    13. UPDATE Submission (status, runtimeMs, testResults, errorMsg)         │
│    14. if ACCEPTED: upsert UserProgress, award XP, updateStreak()           │
│    15. return { received: true, firstSolve: boolean }                       │
└──────────┬───────────────────────────────────────────────────────┬──────────┘
           │ Redis RPUSH/BLPOP                                     │ Prisma/pg
           ▼                                                       ▼
┌─────────────────────┐                               ┌───────────────────────┐
│  Redis              │                               │  PostgreSQL (Supabase)│
│                     │                               │                       │
│  judge:queue:cpp    │                               │  Submission           │
│  judge:queue:cuda:* │                               │  JudgeToken           │
│  judge:queue:k8s    │                               │  Problem              │
│  submission:daily:* │                               │  UserProgress         │
│  submission:ratelimit:* │                           │  User                 │
└─────────────────────┘                               └───────────────────────┘

           ▲ HTTPS poll (outbound only from judge)
           │
┌──────────┴──────────────────────────────────────────────────────────────────┐
│  Judge Node (remote machine, any cloud VM or bare-metal server)             │
│                                                                             │
│  worker.ts (Node.js process)                                                │
│    ├── pollForJob() → GET /api/judge/poll                                   │
│    ├── runCppJob()  → runInSandbox() → runDocker() / runDirect()            │
│    ├── runK8sJob()  → validateK8sManifest() → kubeconform                  │
│    └── submitResult() → POST /api/judge/result                              │
│                                                                             │
│  Docker daemon (host socket: /var/run/docker.sock)                          │
│    └── spawns sibling sandbox containers:                                   │
│         ├── gcc:14             (cpp problems)                               │
│         └── nvidia/cuda:13.0.0-devel-ubuntu24.04  (cuda problems)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

Every arrow labeled HTTPS is an outbound request from the judge. The judge never accepts inbound connections.

### 2.2 Judge node variants

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CPU Judge                                                                  │
│  JUDGE_CAPABILITIES=cpp                                                     │
│                                                                             │
│  Polls: judge:queue:cpp                                                     │
│  Spawns: gcc:14 containers                                                  │
│  Needs: Docker socket                                                       │
│  Does NOT need: NVIDIA drivers, nvidia-container-toolkit                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  GPU Judge                                                                  │
│  JUDGE_CAPABILITIES=cpp,cuda:13.0                                           │
│                                                                             │
│  Polls: judge:queue:cpp AND judge:queue:cuda:13.0                           │
│  Spawns: gcc:14 containers (cpp jobs)                                       │
│          nvidia/cuda:13.0.0-devel-ubuntu24.04 containers (cuda jobs)        │
│  Needs: Docker socket + NVIDIA drivers + nvidia-container-toolkit           │
│  Run flag for CUDA containers: --gpus device=0                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  K8s Judge                                                                  │
│  JUDGE_CAPABILITIES=k8s                                                     │
│                                                                             │
│  Polls: judge:queue:k8s                                                     │
│  Spawns: nothing (runs kubeconform as child process)                        │
│  Needs: kubeconform in PATH                                                 │
│  Does NOT need: Docker, NVIDIA drivers                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

A GPU judge can serve both `cpp` and `cuda` queues simultaneously — on each poll it BLPOPs from both queues, taking whichever has a job first. This is efficient because CUDA hardware is generally faster at C++ serial workloads too, so there is no reason to leave CPU jobs unserved on a GPU machine.

### 2.3 Network topology

The judge requires only **outbound HTTPS** to the web app domain. Specifically:

- `GET https://{JUDGE_API_URL}/api/judge/poll` — long-polls for work
- `POST https://{JUDGE_API_URL}/api/judge/result` — delivers outcomes

The judge machine needs no inbound ports, no firewall rules that accept connections, and no domain name. It can sit behind NAT, in a cloud VPC with no public IP, or in any environment that allows outbound HTTPS.

The judge **never connects to Redis or Postgres directly**. Redis and Postgres are accessed exclusively by the web app. The judge is fully stateless between jobs — restarting it at any time is safe, because all durable state lives in the web app's database.

---

## 3. Authentication and token system

### 3.1 Token format and generation

Judge tokens follow the format `jt_` + 64 hex characters (32 random bytes encoded as hex), for a total of 67 characters. Example:

```
jt_a3f8e1c24b9d06e5f2a8c3d7e1b9f04a6d2c8e3b1f7a9d5e2c4b6f8a1d3e7c9
```

Generation uses Node's `crypto` module:

```typescript
const raw = 'jt_' + crypto.randomBytes(32).toString('hex')
```

**Storage:** the raw token is shown exactly once (at generation time) and never stored. What gets stored is the SHA-256 hash of the raw token:

```typescript
const hash = crypto.createHash('sha256').update(raw).digest('hex')
// stored in JudgeToken.token column
```

This means that even if the database is compromised, an attacker cannot recover the plaintext token — they would need to break SHA-256 to do so.

> **Note:** The codebase uses SHA-256 (not bcrypt) because SHA-256 enables deterministic lookup: the token hash is the primary key used to find the judge record (`prisma.judgeToken.findUnique({ where: { token: incomingHash } })`). bcrypt's per-hash random salt makes this lookup-by-hash pattern impossible.

### 3.2 Token capabilities

Each `JudgeToken` row has a `capabilities: String[]` field that declares what the judge can execute. Examples:

- `["cpp"]` — CPU judge, serves only `judge:queue:cpp`
- `["cpp", "cuda:13.0"]` — GPU judge, serves `judge:queue:cpp` and `judge:queue:cuda:13.0`
- `["k8s"]` — K8s judge, serves only `judge:queue:k8s`

At poll time, the web app reads `judge.capabilities` and constructs the exact set of Redis queue names to BLPOP from. A judge with `["cpp"]` capabilities can never receive a CUDA job — it simply never touches `judge:queue:cuda:*`.

Capabilities are also forwarded by the judge in the `X-Judge-Capabilities` HTTP header on every request, providing an additional observability signal (the server logs which judge is talking).

### 3.3 Authentication flow

```
Judge ──GET /api/judge/poll──────────────────────────────────────────────────►
       Authorization: Bearer jt_a3f8e1c24b9...
       X-Judge-Capabilities: cpp,cuda:13.0

Web app:
  1. Extract raw token from Authorization header
  2. Check that token starts with "jt_" prefix (fast reject)
  3. Compute: incomingHash = SHA-256(rawToken)
  4. SELECT * FROM JudgeToken WHERE token = incomingHash
  5. If not found → return 401
  6. If judgeToken.isActive === false → return 401
  7. timingSafeEqual(storedBuf, incomingBuf)   [defence-in-depth]
  8. If not equal → return 401
  9. UPDATE JudgeToken SET lastSeenAt = NOW()  [non-blocking, fire-and-forget]
  10. Return AuthenticatedJudge { id, name, capabilities }

◄── 200 OK + job payload  (or 204 No Content if queue empty after 30s)
```

### 3.4 Timing-safe comparison

After finding the stored hash by database lookup, the code performs a second comparison using `crypto.timingSafeEqual`:

```typescript
const storedBuf  = Buffer.from(judgeToken.token, 'hex')
const incomingBuf = Buffer.from(incomingHash,    'hex')
if (!crypto.timingSafeEqual(storedBuf, incomingBuf)) return null
```

A naive `===` string comparison short-circuits on the first differing character, which makes execution time slightly dependent on how many characters match. An attacker who can make millions of requests and measure response time with microsecond precision could exploit this to reconstruct a valid hash byte-by-byte. `timingSafeEqual` takes constant time regardless of where the buffers first differ, eliminating this timing oracle. In practice, the database round-trip dwarfs any comparison timing, but defence-in-depth means never relying on "probably not exploitable."

### 3.5 Token revocation

To revoke a judge node immediately:

```sql
UPDATE "JudgeToken" SET "isActive" = false WHERE name = 'gpu-1';
```

The judge's next poll request hits the `if (!judgeToken.isActive) return null` check and receives a 401. The `api-client.ts` treats 401 as fatal:

```typescript
if (res.status === 401) {
  console.error('[judge] 401 Unauthorized — check JUDGE_API_TOKEN. Exiting.')
  process.exit(1)
}
```

Any job the judge is currently executing completes normally — revocation only stops future poll requests. This provides a clean shutdown: the current job finishes and its result is submitted, then the judge exits.

---

## 4. Job lifecycle — end to end

### 4.1 Complete sequence diagram

```
Browser
  │
  ├── POST /api/trpc/submission.create
  │     body: { problemSlug, code, language }
  │
  ▼
Web app — submission.create mutation (server/routers/submissions.ts)
  │
  ├── 1. Fetch Problem from DB (by slug)
  ├── 2. validateSubmission():
  │     a. code size ≤ 16 KB
  │     b. code not empty, no null bytes or control chars
  │     c. language in ['cpp', 'yaml']
  │     d. no existing PENDING/RUNNING submission for this user+problem
  │     e. daily submission count < limit (DB query)
  │     f. per-minute rate limit (Redis INCR)
  ├── 3. INSERT Submission { status: PENDING, code, language, ... }
  ├── 4. INCR Redis key submission:daily:{userId}:{date}
  ├── 5. RPUSH judge:queue:{runtime} { submissionId, problemSlug, code, ... }
  └── return { submissionId }
  │
  ◄── { submissionId: "clh1234..." }
  │
Browser
  │
  ├── starts polling GET /api/trpc/submission.getStatus?submissionId=clh1234
  │   (every 1500 ms until terminal status)
  │
  ▼                              [meanwhile, on judge machine...]

Judge worker (worker.ts — tight loop)
  │
  ├── GET /api/judge/poll
  │     Authorization: Bearer jt_...
  │     [web app BLPOPs from queue, blocks up to 30 s waiting for a job]
  │
  ▼
Web app — /api/judge/poll (GET)
  │
  ├── 1. authenticateJudge(req)
  ├── 2. rate-limit check (60 req/min per token)
  ├── 3. build queue list from judge.capabilities
  ├── 4. BLPOP judge:queue:cpp judge:queue:cuda:13.0 (timeout 30 s)
  │     [blocks here until job arrives or timeout]
  ├── 5. parse job payload from queue
  ├── 6. fetch Submission + Problem + Track from Postgres
  ├── 7. UPDATE Submission status → RUNNING
  ├── 8. loadProblemContent(trackSlug, problemSlug)
  │     [reads MDX file, parses test cases / k8s-checks]
  │     [solution section is parsed but NEVER included in response]
  └── return job payload (JSON)
  │
  ◄── 200 OK + { submissionId, problemSlug, code, harness, testCases, ... }
  │
Judge worker
  │
  ├── validate JudgeJobSchema (zod discriminated union)
  ├── check code size ≤ JUDGE_MAX_CODE_BYTES (secondary guard)
  │
  ├── [if runtime === 'k8s']
  │     validateK8sManifest(code, k8sChecks, opts)
  │       → parse YAML
  │       → run each check (schema / assertion / kubectl-dry-run)
  │       → aggregate results
  │
  ├── [if runtime === 'cpp' or 'cuda']
  │     for each testCase:
  │       runInSandbox(code + '\n' + harness, testCase.input, opts)
  │         → mkdirSync /app/apps/judge/tmp/{submissionId}-{tcIdx}/
  │         → writeFileSync solution.cpp / solution.cu
  │         → runDocker() or runDirect()
  │             compile: g++ / nvcc
  │             run:     ./solution < input (with timeout)
  │         → rmSync (finally block)
  │       verify(stdout, expected)
  │       if TIME_LIMIT or RUNTIME_ERROR → break early
  │
  └── POST /api/judge/result { submissionId, status, runtimeMs, testResults, ... }
  │
  ▼
Web app — /api/judge/result (POST)
  │
  ├── 1. authenticateJudge(req)
  ├── 2. parse + validate ResultSchema (zod)
  ├── 3. UPDATE Submission { status, runtimeMs, errorMsg, testResults, ... }
  ├── 4. if ACCEPTED:
  │     a. fetch submission+problem from DB
  │     b. upsert UserProgress { attempts++ }
  │     c. if first solve: UPDATE User SET xp += problem.xpReward
  │     d. updateStreak(userId)
  └── return { received: true, firstSolve: boolean }
  │
Browser (polling)
  │
  ├── getStatus returns terminal status (ACCEPTED / WRONG_ANSWER / ...)
  ├── renders result panel with test case breakdown
  ├── if firstSolve && ACCEPTED → confetti animation + XP banner
  └── if ACCEPTED → editorial tab unlocks
```

### 4.2 Job payload structure

The job payload is a discriminated union on `runtime`. Two shapes are possible:

**C++ / CUDA job** (`CppJudgeJob`):

```typescript
{
  submissionId: string      // cuid — uniquely identifies this submission
  problemSlug:  string      // slug of the problem, e.g. "vector-add"
  code:         string      // user's source code (the kernel / solve function only)
  harness:      string      // test harness from MDX ---harness--- section
                            // (contains main(), I/O reading, verification logic)
  language:     'cpp'       // always 'cpp' for both C++ and CUDA jobs
  runtime:      'cpp' | 'cuda'  // distinguishes g++ from nvcc
  cppStandard:  '14' | '17' | '20' | '23'  // passed to -std=c++XX flag
  cudaVersion?: string      // e.g. "13.0" — used to select Docker image
  computeCap?:  string      // e.g. "sm_120" — passed to nvcc -arch flag
  testCases:    Array<{ input: string; expected: string }>
                            // test cases from MDX ---test-cases--- section
                            // NOTE: solution section is never included
  timeoutMs:    number      // execution timeout in ms (capped at JUDGE_MAX_TIMEOUT_MS)
}
```

The `code` and `harness` fields are concatenated before compilation:

```typescript
runInSandbox(job.code + '\n' + job.harness, tc.input, opts)
```

This means the user implements a function (e.g. `vecAdd`, `solve`) and the harness provides `main()` with I/O parsing and invocation. The harness is never shown to users — it is part of the problem definition.

**Kubernetes job** (`K8sJudgeJob`):

```typescript
{
  submissionId: string      // cuid
  problemSlug:  string      // e.g. "deploy-inference-server"
  code:         string      // user's YAML manifest
  language:     'yaml'
  runtime:      'k8s'
  k8sMultiDoc:  boolean     // true if manifest contains multiple --- separated docs
  k8sChecks:    K8sCheck[]  // checks from MDX ---k8s-checks--- section
  timeoutMs:    number      // timeout for kubeconform (10 s)
}
```

### 4.3 Result payload structure

```typescript
{
  submissionId: string      // must match the job's submissionId
  status:       'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  runtimeMs:    number      // max runtime across all test cases (0 for k8s jobs)
  errorMsg?:    string      // first stderr output, or error description
  testResults?: Array<{
    index:     number       // 0-based test case index
    passed:    boolean
    input:     string       // test case input (or k8s checkId)
    expected:  string       // expected output (or check description)
    actual:    string       // actual stdout (or result message)
    runtimeMs: number       // per-test-case runtime
  }>
  cppStandard?: string      // echoed back from job, stored on Submission row
  cudaVersion?: string      // echoed back from job, stored on Submission row
  computeCap?:  string      // echoed back from job, stored on Submission row
}
```

The `cppStandard`, `cudaVersion`, and `computeCap` fields are echoed back so the web app can store exactly which compiler flags were used for each submission — useful for historical display and debugging.

---

## 5. MDX problem format and judge integration

### 5.1 MDX section anatomy

Every problem is defined in a single MDX file at:

```
learning/{track-slug}/problems/{problem-slug}/index.mdx
```

The file begins with YAML frontmatter (parsed by `gray-matter`), followed by the body divided into sections by delimiter strings. The `loadProblemContent()` function in `lib/problems-content.ts` parses all sections.

**C++ / CUDA problem structure:**

```
---                          ← frontmatter (slug, title, runtime, cuda_version, etc.)
[frontmatter YAML]
---
[description markdown]       ← rendered to HTML, shown in problem panel

---starter-code---
[C++/CUDA source code]       ← loaded into Monaco editor as initial code

---test-cases---
[YAML array]                 ← parsed into TestCase[], sent to judge in job payload

---solution---
[reference solution]         ← NEVER sent to judge or browser; server-side only

---harness---
[C++ harness with main()]    ← concatenated with user code before compilation

---editorial---
[markdown]                   ← rendered to HTML, shown after ACCEPTED

---end---
```

**K8s problem structure:**

```
---
[frontmatter YAML]           ← includes k8s_multi_doc: true/false
---
[description markdown]

---starter-code---
[YAML skeleton]              ← loaded into Monaco editor

---k8s-checks---
[YAML array of K8sCheck]     ← sent to judge in job payload

---solution---
[reference YAML manifest]    ← never sent to judge or browser

---editorial---
[markdown]
```

| Section | Delimiter | Used by | Purpose |
|---------|-----------|---------|---------|
| Description | (before `---starter-code---`) | Web app render | Shown to user in problem panel |
| Starter code | `---starter-code---` | Monaco editor | Initial code loaded into editor |
| Test cases | `---test-cases---` | Judge (via poll endpoint) | Input/expected pairs for verification |
| K8s checks | `---k8s-checks---` | Judge (via poll endpoint) | Check definitions for K8s problems |
| Solution | `---solution---` | Parsed server-side, never forwarded | Reference solution for editorial |
| Harness | `---harness---` | Judge (via poll endpoint) | `main()` for C++/CUDA problems |
| Editorial | `---editorial---` | Web app (post-solve) | Shown after first ACCEPTED |

### 5.2 Test case parsing

Test cases are stored as YAML between `---test-cases---` and `---solution---`. The raw format:

```yaml
- name: "Small vectors"
  input: "4\n1.0 2.0 3.0 4.0\n10.0 20.0 30.0 40.0"
  expected: "11.0 22.0 33.0 44.0"

- name: "Large uniform array (1M elements)"
  input: "1000000\nfill:1.0\nfill:2.0"
  expected: "fill:3.0"
```

The `fill:N:V` shorthand (e.g. `fill:1.0` when followed by a count) is a compact notation to represent large repeated values without storing millions of numbers in the YAML file. The verifier expands this shorthand when comparing expected output (see §7.2).

Parsing in `loadProblemContent()`:

```typescript
const trimmed = testCasesPart.trim()
testCases = yaml.load(trimmed) as TestCase[]
```

The poll endpoint extracts only `input` and `expected` from each test case before including them in the job payload:

```typescript
testCases = content.testCases.map(({ input, expected }) => ({ input, expected }))
```

The `name` field is dropped — it is for human readability in the MDX file and is not used during evaluation.

### 5.3 Security: solution never leaves the server

The solution section is parsed by `loadProblemContent()` but is never returned in its output type (`ProblemContent`). The `ProblemContent` type has no `solution` field. The poll endpoint only forwards `testCases` (input/expected pairs), `harness`, and `k8sChecks` to the judge. No reference solution code ever reaches the judge process or the browser.

This means:
- A judge node being compromised cannot obtain reference solutions.
- A network sniff between the web app and judge cannot reveal solutions.
- The browser never receives solution code regardless of client-side manipulation.

### 5.4 K8s problems: k8s-checks format

K8s checks are stored as YAML between `---k8s-checks---` and `---solution---`. Three check types are supported:

**Schema check** — verifies that a resource of a specific kind/apiVersion exists in the manifest:

```yaml
- id: has-deployment
  description: "Manifest must contain a Deployment resource (apps/v1)"
  type: schema
  assert:
    kind: Deployment
    apiVersion: apps/v1
```

**Assertion check** — resolves a JSONPath expression against the parsed YAML and applies a comparison operator:

```yaml
- id: gpu-requested
  description: "Must request at least 1 NVIDIA GPU"
  type: assertion
  path: "spec.template.spec.containers[0].resources.requests[nvidia.com/gpu]"
  op: exists
```

```yaml
- id: correct-image
  description: "Must use the vllm/vllm-openai:v0.4.0 image"
  type: assertion
  path: "spec.template.spec.containers[0].image"
  op: eq
  value: "vllm/vllm-openai:v0.4.0"
```

**kubectl-dry-run check** — runs `kubeconform` against the entire manifest for schema validation:

```yaml
- id: dry-run
  description: "Must pass kubeconform strict schema validation"
  type: kubectl-dry-run
```

Checks are evaluated in order, and results are aggregated into the final `testResults` array. Each check maps to one entry in `testResults`, with the `checkId` stored in the `input` field and the check `description` in the `expected` field.

---

## 6. Sandbox execution — C++ and CUDA

### 6.1 Docker-in-Docker architecture

The most architecturally significant aspect of the judge is how it runs user code in isolation while itself running inside Docker. This is achieved by mounting the host Docker socket into the judge container — a pattern sometimes called "Docker-in-Docker" (DinD), though technically it is more accurate to call it "Docker socket mounting" because no Docker daemon runs inside the judge container. The judge is a client of the host daemon.

```
Host machine
│
├── Docker daemon (/var/run/docker.sock)
│
├── Judge container  [leetscuda-judge image]
│   ├── Volume mount: /var/run/docker.sock → /var/run/docker.sock
│   ├── Volume mount: /host/path/to/judge/tmp → /app/apps/judge/tmp
│   │   (required for DinD temp directory access — see §6.2)
│   ├── Runs: tsx src/worker.ts
│   └── Executes: docker run gcc:14 ...  (via the mounted socket)
│
└── Sandbox container  [gcc:14 or nvidia/cuda image]  ← SIBLING, not child
    ├── Image: gcc:14
    ├── Volume mount: /host/path/to/judge/tmp/{submissionId}/ → /work/
    ├── Network: none  (no outbound connections possible)
    ├── Memory: 256m (cpp) / 512m (cuda)
    └── Runs: g++ compile, then ./solution < input
```

**Critical DinD subtlety:** When the judge calls `docker run -v /app/apps/judge/tmp/xyz:/work ...`, the Docker daemon receives this volume path and resolves it on the **host filesystem**, not inside the judge container. This means the path `/app/apps/judge/tmp/xyz` must exist on the host, not just inside the judge container. The `JUDGE_HOST_TMP_DIR` environment variable provides the mapping:

```
JUDGE_HOST_TMP_DIR=/actual/host/path/to/apps/judge/tmp
```

When set, the sandbox uses this host-side path for volume mounts:

```typescript
const hostTmpDir = env.hostTmpDir
  ? path.join(env.hostTmpDir, opts.submissionId)
  : tmpDir
// hostTmpDir is used in -v flag; tmpDir is used for file writes inside judge container
```

If `JUDGE_HOST_TMP_DIR` is not set, the judge assumes it is running directly on the host (not inside Docker) and uses the container-internal path.

### 6.2 Temp directory lifecycle

Each test case within a submission gets its own isolated temp directory, using `{submissionId}-{testCaseIndex}` as the directory name to avoid conflicts when test cases run sequentially:

```
Step 1 — CREATE
  tmpBase = /app/apps/judge/tmp          (relative to worker.ts, resolved at runtime)
  tmpDir  = tmpBase/{submissionId}-{tcIdx}
  fs.mkdirSync(tmpDir, { recursive: true })

Step 2 — WRITE SOURCE FILE
  /app/apps/judge/tmp/{submissionId}-{tcIdx}/solution.cpp   (C++ problems)
  /app/apps/judge/tmp/{submissionId}-{tcIdx}/solution.cu    (CUDA problems)
  Content: job.code + '\n' + job.harness  (concatenated before write)

Step 3 — MOUNT INTO SANDBOX CONTAINER
  docker run -v {hostTmpDir}/{submissionId}-{tcIdx}:/work ...
  Container sees the source file at /work/solution.cpp (or .cu)
  Container writes compiled binary to /work/solution

Step 4 — COMPILE (inside container, separate docker run invocation)
  g++ -std=c++{standard} -O2 -o /work/solution /work/solution.cpp
  OR
  nvcc -std=c++{standard} -arch={computeCap} -O2 -o /work/solution /work/solution.cu
  Compile errors: exit code ≠ 0 → return RUNTIME_ERROR with stderr

Step 5 — RUN (inside container, named container for timeout control)
  /work/solution  (stdin receives test case input, stdout is captured)
  Runtime is measured: start = Date.now(), end = Date.now()

Step 6 — CLEANUP (always, in finally block — even if compile/run throws)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  If cleanup fails, the error is swallowed (best-effort)
```

The `finally` block ensures cleanup happens even if:
- The compile step crashes the judge process
- The Docker spawn throws an exception
- The judge receives SIGTERM mid-execution

If cleanup fails (e.g. permission error, disk full), the error is silently ignored. The orphan container cleanup on next startup (§6.7) handles container leftovers; temp directories that survive a crash are cleaned on next restart or by a cron job.

### 6.3 Docker run flags — security rationale

Each sandbox container is launched with a fixed set of flags. Here is the complete set with rationale:

| Flag | C++ value | CUDA value | Purpose |
|------|-----------|------------|---------|
| `--rm` | ✓ | ✓ | Auto-remove container filesystem after exit. Prevents disk accumulation from thousands of submissions. |
| `--network none` | ✓ | ✓ | Disable all network interfaces inside the container. User code cannot exfiltrate data, call external APIs, or initiate network connections of any kind. This is the primary data exfiltration defence. |
| `--memory 256m` | ✓ | — | Hard memory limit. The kernel OOM-kills the process if it exceeds this. Prevents a submission from consuming all host RAM. |
| `--memory 512m` | — | ✓ | CUDA programs need more memory for CUDA runtime initialization and GPU buffers. |
| `--cpus 0.5` | ✓ | — | Limits the container to 50% of one CPU core. Prevents CPU monopolization on multi-tenant judge nodes. Not applied to CUDA containers because the interesting work happens on the GPU, not the CPU. |
| `--ulimit nproc=64` | ✓ | — | Limits the number of processes the container can spawn. Prevents fork bombs: a fork bomb that doubles processes until system resources are exhausted. With 64 as the ceiling, the impact is bounded. |
| `--ulimit nproc=128` | — | ✓ | CUDA runtime spawns more internal threads, so the limit is raised for CUDA containers. |
| `--label leetscuda-judge=1` | ✓ | ✓ | Tags every judge-spawned container. Used by the orphan cleanup routine (§6.7) to identify and stop leftover containers after a crash. |
| `--gpus device=0` | — | ✓ | Attaches the first GPU (device 0) to the container. Without this, `cudaMalloc` returns `cudaErrorNoDevice`. Requires `nvidia-container-toolkit` on the host. |
| `--name lc-judge-{submissionId}` | ✓ (run phase) | ✓ (run phase) | Names the run-phase container so the timeout handler can issue `docker stop lc-judge-{submissionId}` by name without needing to track a container ID. |
| `--stop-timeout` | handled via `docker stop --time 5` | same | See §6.6 for the two-phase kill sequence. |

Compile-phase containers are not named (they use `--rm` and exit quickly with a 30-second hard timeout via SIGKILL from `runProcess`). Only run-phase containers are named for timeout control.

### 6.4 Compilation step

Compilation runs in a short-lived Docker container (no named container, no timeout management beyond a 30-second hard SIGKILL). The compile step is separate from the run step so that:
1. Compile errors are clearly distinguished from runtime errors (exit code and stderr are distinct).
2. The compiled binary can be reused across test cases without recompiling (currently the binary is reused within the same test case directory — future optimization could share across test cases).

**C++ compilation:**

```bash
g++ -std=c++{cppStandard} -O2 -o /work/solution /work/solution.cpp
```

**CUDA compilation:**

```bash
nvcc -std=c++{cppStandard} -arch={computeCap} -O2 -o /work/solution /work/solution.cu
```

`-O2` enables standard optimizations (inlining, loop unrolling, constant folding) without the extreme compile times of `-O3`. It is appropriate for a judge because it reflects realistic production performance.

`-arch=sm_120` (or whichever compute capability is configured) tells `nvcc` to generate PTX and SASS code for a specific GPU microarchitecture. The compute capability is a two-part number: `sm_XY` where X is the major version and Y is the minor version. For example:
- `sm_86` — Ampere architecture (A100, RTX 3090)
- `sm_120` — Blackwell architecture (B200)

Using the wrong `-arch` flag causes the compiled binary to either fall back to a lower-capability path (if `nvcc` generates generic PTX) or fail entirely if the GPU does not support the requested feature set. The compute capability is stored on the `Problem` row and forwarded in the job payload.

If compilation fails (exit code ≠ 0), the sandbox returns immediately with `exitCode = compileResult.exitCode` and the compile error in `stderr`. The judge records this as `RUNTIME_ERROR` with the error message from stderr.

### 6.5 Execution and timing

After compilation, the run-phase container is started. Timing is measured using `Date.now()` around the container spawn:

```typescript
const start = Date.now()
const runPromise = runProcess('docker', runArgs, input, opts.timeoutMs + 30_000)
const timeoutP = new Promise<'TIMEOUT'>((resolve) =>
  setTimeout(() => resolve('TIMEOUT'), opts.timeoutMs),
)
const race = await Promise.race([
  runPromise.then((r) => ({ tag: 'done', ...r })),
  timeoutP,
])
const runtimeMs = Date.now() - start
```

**What `runtimeMs` includes:**
- Docker container startup time (typically 50–200 ms for a warm image)
- Time for the process to read stdin
- Time for all computation to complete
- Time to write stdout

**What `runtimeMs` does not include:**
- Queue wait time (time the submission spent in `PENDING` state)
- Web app processing time (poll endpoint latency)
- Network round-trip time
- The compile step (compile is measured separately and not reported)

For multiple test cases, the judge tracks the maximum runtime across all test cases:

```typescript
if (sandboxResult.runtimeMs > maxRuntimeMs) maxRuntimeMs = sandboxResult.runtimeMs
```

The reported `runtimeMs` in the result payload is this maximum, representing the worst-case performance across all inputs.

### 6.6 Timeout enforcement — two-phase kill

When the `opts.timeoutMs` timeout fires before the container exits:

```
1. Promise.race resolves with 'TIMEOUT'
   runtimeMs is recorded at this point

2. console.log('[judge] TIMEOUT {submissionId} — SIGTERM sent, waiting 5s')

3. execSync('docker stop --time 5 {containerName}')
   docker stop:
     a. Sends SIGTERM to PID 1 inside the container (the solution binary)
     b. Waits up to 5 seconds for the container to exit gracefully
     c. If still running after 5 seconds: sends SIGKILL (cannot be ignored)
   The execSync itself has a 15-second timeout as an outer failsafe.

4. runPromise is awaited to drain (prevent unhandled promise rejection)

5. Return { stdout: '', stderr: '', exitCode: 124, runtimeMs, timedOut: true }
```

Exit code `124` is the conventional Unix exit code for "process killed by timeout" (it is what the `timeout(1)` command returns). The judge uses this to distinguish timeout from other non-zero exit codes.

**Why two phases?** SIGTERM allows a well-behaved process to flush buffers, release resources, and exit cleanly. Some CUDA programs have cleanup code in destructors that should run. SIGKILL is the fallback because it cannot be caught or ignored — it is the kernel forcibly removing the process. A malicious program that catches SIGTERM and ignores it will always be killed by SIGKILL within 5 seconds.

### 6.7 Orphan container cleanup

When the judge process crashes mid-execution (power loss, OOM kill, SIGKILL), any running sandbox container is left alive on the host Docker daemon. On next startup:

```typescript
// worker.ts, called once before entering the main loop
async function cleanupOrphanedContainers(): Promise<void> {
  const ids = execSync(
    'docker ps --filter label=leetscuda-judge --filter status=running -q',
    { encoding: 'utf8' }
  ).trim()

  const containerIds = ids.split('\n').filter(Boolean)
  console.log(`[judge] CLEANUP found ${containerIds.length} orphaned containers, stopping`)

  for (const id of containerIds) {
    execSync(`docker stop --time 1 ${id}`, { stdio: 'ignore' })
  }
}
```

This runs only for CPU/GPU judges (not K8s judges, which spawn no containers). It finds all running containers with the `leetscuda-judge` label and stops them with a 1-second grace period. Orphan cleanup is important because:
- Orphaned containers consume CPU, memory, and GPU resources indefinitely.
- An orphaned CUDA container that holds the GPU prevents new submissions from acquiring it.
- Accumulating orphans can exhaust the host's process table.

### 6.8 Output sanitization and size limits

All stdout and stderr captured from sandbox containers is passed through `sanitizeOutput()`:

```typescript
function sanitizeOutput(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')  // strip ANSI CSI escape sequences
    .replace(/\x1b[^[]/g, '')                // strip other ESC sequences
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '') // keep: tab, LF, CR, printable ASCII
}
```

This prevents ANSI escape codes from corrupting the terminal when error messages are displayed to users, and strips non-printable bytes that could cause issues in JSON encoding or database storage.

Output is also capped at 64 KB per stream:

```typescript
const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KB per stream
```

If stdout exceeds 64 KB, the string is truncated and `'\n[output truncated]'` is appended, and the process is SIGKILL'd. This prevents a submission that prints gigabytes of output from consuming all judge memory.

### 6.9 Direct execution fallback

If Docker is not available on the judge machine (e.g. during development without Docker installed), the sandbox falls back to `runDirect()`, which runs `g++`/`nvcc` and the compiled binary directly on the host without any container isolation:

```typescript
const result = isDockerAvailable()
  ? await runDocker(tmpDir, input, opts)
  : await runDirect(tmpDir, input, opts)
```

`isDockerAvailable()` caches its result after the first check (via a module-level `dockerAvailable` variable). This fallback is intended for local development and testing only — **never run user-submitted code with the direct fallback in production**, as there is no isolation, no network restriction, and no resource limits.

---

## 7. Output verification

### 7.1 Verifier logic

The verifier in `verifier.ts` compares actual stdout against expected output from the test case, with line-by-line comparison and floating-point tolerance:

```
verify(actual: string, expected: string) → boolean

1. Expand fill shorthand in expected (see §7.2)

2. Normalize both strings:
   - trim() leading/trailing whitespace
   - replace \r\n with \n (normalize Windows line endings)
   - split into lines

3. If line counts differ → false

4. For each line pair (actual[i], expected[i]):
   a. trim() both lines
   b. If actual[i] === expected[i] → continue (exact match, fast path)
   c. If both lines look like numbers (match /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/):
      → compare with ±0.001 absolute tolerance
      → if |parseFloat(actual) - parseFloat(expected)| ≤ 0.001 → continue
   d. Otherwise → false

5. All lines matched → true
```

**Why ±0.001 tolerance?** CUDA floating-point arithmetic is not perfectly reproducible across GPU architectures. The same kernel compiled for `sm_86` vs `sm_120` may produce slightly different floating-point results due to different FMA (fused multiply-add) instruction behavior and different rounding modes. A 0.001 absolute tolerance is tight enough to catch algorithmic errors (e.g. computing the wrong sum) while allowing for hardware-level floating-point variation. This tolerance is also appropriate for most single-precision GPU computations where values in test cases are on the order of 1–100.

### 7.2 Fill shorthand expansion

The verifier expands `fill:N:V` shorthands in the expected string before comparison:

```typescript
function expandFills(s: string): string {
  return s.replace(/fill:(\d+):([-\d.eE+]+)/g, (_, n, v) =>
    Array(parseInt(n, 10)).fill(v).join(' '),
  )
}
```

For example: `fill:256:0.0` expands to `0.0 0.0 0.0 ... (256 times)`.

The MDX test case format uses a different shorthand: `fill:value` (without the count) when count is provided as a separate field — but the YAML parser and harness handle that. The verifier handles the post-expansion `fill:N:V` form that has already been expanded by the judge's expected string processing. (Note: looking at the vector-add MDX, the `fill:` syntax appears in test case YAML as `"fill:1.0"` for the input side, and `"fill:3.0"` for expected — the verifier's regex handles the `fill:N:V` form where the count is embedded in the string.)

### 7.3 Determining final status

The judge evaluates test cases sequentially (not in parallel) and applies fail-fast rules for some statuses:

```
Initialize: finalStatus = 'ACCEPTED', maxRuntimeMs = 0

For each test case (index 0..N-1):

  sandboxResult = runInSandbox(...)

  Update maxRuntimeMs

  if sandboxResult.exitCode === 124:        [timeout]
    finalStatus = 'TIME_LIMIT'
    push testResult { passed: false }
    BREAK — stop running further test cases

  if sandboxResult.exitCode !== 0:          [compile error or runtime crash]
    finalStatus = 'RUNTIME_ERROR'
    push testResult { passed: false, actual: stderr }
    BREAK — stop running further test cases

  passed = verify(sandboxResult.stdout, tc.expected)
  push testResult { passed }

  if !passed:
    finalStatus = 'WRONG_ANSWER'
    BREAK — stop running further test cases

Final result: { status: finalStatus, runtimeMs: maxRuntimeMs, testResults }
```

**Fail-fast rationale:**
- `TIME_LIMIT` and `RUNTIME_ERROR` break immediately because further test cases would also fail (the program has a fundamental problem), and there is no value in running them. Additionally, a timed-out process has already consumed its full `timeoutMs` — running more test cases would multiply that cost.
- `WRONG_ANSWER` also breaks after the first failed test case. This is a design choice: users see which test case they failed at, which is sufficient for debugging. (Some online judges continue running all test cases for WRONG_ANSWER to show a pass rate; this judge uses early termination for simplicity and to limit compute cost.)

---

## 8. Kubernetes manifest validation

### 8.1 Why kubectl is not used

The original design considered `kubectl apply --dry-run=client` for manifest validation. This was replaced with `kubeconform` for the following reasons:

- `kubectl` requires a kubeconfig pointing to a cluster. Even with `KUBECONFIG=/dev/null`, `--validate=false`, and `--dry-run=client`, `kubectl` attempts DNS lookups and TLS handshakes to validate custom resource definitions (CRDs) from a running cluster.
- Even `kubectl apply --dry-run=client` makes network calls for resource type discovery in certain kubectl versions.
- `kubeconform -schema-location default` validates against JSON schemas **bundled inside the binary** at compile time. No network calls, no kubeconfig, no running cluster required.
- `kubeconform` is faster (no cluster round-trips) and produces structured JSON output that is easy to parse.

At startup, `env.ts` verifies that `kubeconform` is available and that offline validation works by running a test validation against a trivial ConfigMap manifest. If this check fails, the judge exits immediately rather than silently accepting all manifests.

### 8.2 Validation pipeline

```
Receive K8s job
  │
  ▼
Parse YAML (js-yaml)
  ├── Parse error → return single result:
  │     { checkId: 'yaml-parse', passed: false, message: error.message }
  └── Success → docs[] (array of parsed objects)
       │
       ├── if k8sMultiDoc: yaml.loadAll(manifest)  [multiple --- separated docs]
       └── if !k8sMultiDoc: [yaml.load(manifest)]  [single document]
       Filter out nulls (empty docs from trailing ---)
       │
       ▼
For each check in k8sChecks (in order):
  │
  ├── type === 'schema':
  │     Find any doc where kind and apiVersion match check.assert
  │     pass: found such a document
  │     fail: "Expected a {kind} resource with apiVersion {apiVersion}, but none was found"
  │
  ├── type === 'assertion':
  │     Resolve check.path against each doc (first doc that has the path wins)
  │     Apply check.op against resolved value
  │     pass: operator returned true
  │     fail: "Expected {path} to {op} {value}, got: {actual}"
  │
  └── type === 'kubectl-dry-run':
        Write manifest to temp file
        execFileAsync('kubeconform', ['-strict', '-summary', '-output', 'json',
                                      '-schema-location', 'default', tmpFile])
        Parse JSON output
        pass: no resources with status 'invalid' or 'error'
        fail: list of invalid resource names and messages

Aggregate results → K8sValidationResult[]
all passed → status: ACCEPTED
any failed → status: WRONG_ANSWER (firstFailed.message → errorMsg)
```

### 8.3 JSONPath resolver

The custom JSONPath resolver (`resolvePath()` in `k8s-validator.ts`) supports four notations:

| Notation | Example | Notes |
|----------|---------|-------|
| Dot notation | `spec.replicas` | Simple property access |
| Chained dots | `spec.template.spec.containers` | Nested property access |
| Array index | `spec.template.spec.containers[0].image` | 0-based numeric index |
| Bracket key | `resources.limits[nvidia.com/gpu]` | Key containing dots — cannot use dot notation |
| Bracket with slashes | `metadata.labels[app.kubernetes.io/name]` | Key containing slashes |

The resolver tokenizes the path string iteratively, consuming either a bracket segment `[...]` or a dot-delimited identifier at each step:

```typescript
while (remaining.length > 0) {
  const bracketMatch = remaining.match(/^\[([^\]]+)\](.*)$/)
  if (bracketMatch) {
    segments.push(bracketMatch[1])
    remaining = bracketMatch[2]
    if (remaining.startsWith('.')) remaining = remaining.slice(1)
    continue
  }
  const dotMatch = remaining.match(/^([^.[]+)(.*)$/)
  if (dotMatch) {
    segments.push(dotMatch[1])
    remaining = dotMatch[2]
    if (remaining.startsWith('.')) remaining = remaining.slice(1)
    continue
  }
  break
}
```

For multi-doc manifests, the resolver tries each document in order and returns the first document that has a non-`undefined` value at the given path.

### 8.4 Assertion operators

| Operator | Behaviour |
|----------|-----------|
| `exists` | `actual != null` — path must resolve to any non-null value |
| `eq` | `actual == expected` (loose equality — coerces strings to numbers for `"1" == 1`) |
| `neq` | `actual != expected` |
| `contains` | `typeof actual === 'string' && actual.includes(expected)` |
| `matches` | `typeof actual === 'string' && new RegExp(expected).test(actual)` |
| `gte` | `Number(actual) >= Number(expected)` |
| `lte` | `Number(actual) <= Number(expected)` |
| `gt` | `Number(actual) > Number(expected)` |
| `lt` | `Number(actual) < Number(expected)` |

Loose equality (`==` not `===`) for `eq` and `neq` is intentional: YAML may parse `nvidia.com/gpu: 1` as a number while Kubernetes and kubeconform expect the string `"1"`. Loose equality handles both forms transparently.

### 8.5 K8s judge node — no Docker socket needed

The K8s judge differs fundamentally from CPU/GPU judges in its infrastructure requirements:

- Does **not** need Docker installed on the host.
- Does **not** need `/var/run/docker.sock` mounted.
- Does **not** need `JUDGE_HOST_TMP_DIR` set.
- Only needs `kubeconform` in `PATH`.
- Runs `kubeconform` as a direct child process of `worker.ts` — no container is spawned.
- Temp files for `kubectl-dry-run` checks are written to `os.tmpdir()` (usually `/tmp`) and deleted immediately after each check.

This makes K8s judges simpler and cheaper to operate — they can run on any small cloud VM or even a shared server, with no GPU, no Docker daemon, and minimal resource requirements.

---

## 9. Submission limits and hardening

### 9.1 Validation layers

The system applies two independent layers of validation to prevent abuse:

```
Layer 1 — Web app (submission.create mutation, lib/submission-validator.ts):
  Applied before the submission is inserted into the DB or enqueued.

  a. Code size ≤ SUBMISSION_MAX_CODE_BYTES (default: 16 KB)
  b. Code is not empty after trim()
  c. Code contains no null bytes or control characters (ASCII 0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F, 0x7F)
  d. Language is 'cpp' or 'yaml'
  e. No existing PENDING or RUNNING submission for the same user+problem
     (prevents a user from queueing multiple jobs for the same problem)
  f. Today's submission count < daily limit (DB query against Submission table)
     Free users: 10/day; Admin: unlimited (dailyLimitPaid = 0)
  g. Per-minute rate limit (Redis INCR counter, expires in 60 s)
     Default: 5 submissions per minute per user

Layer 2 — Judge (worker.ts):
  Applied when the judge receives the job payload from the poll endpoint.

  a. Code size ≤ JUDGE_MAX_CODE_BYTES (default: 16 KB)
     If exceeded: submit RUNTIME_ERROR immediately, skip sandbox
  b. Timeout ≤ JUDGE_MAX_TIMEOUT_MS (default: 60 s)
     The judge clamps: effectiveTimeout = Math.min(job.timeoutMs, env.maxTimeoutMs)
```

The two-layer model exists because the judge is a separate, independently operated process. An operator error, a bug in the web app, or a compromised web app server could theoretically enqueue malicious payloads. The judge's secondary checks provide defence-in-depth: even if layer 1 fails entirely, layer 2 prevents the judge from executing oversized code or running indefinitely.

### 9.2 Rate limiting implementation

**Per-minute rate limit** (burst protection):

```typescript
const rateLimitKey = `submission:ratelimit:${userId}`
const count = await redis.incr(rateLimitKey)  // atomic increment
if (count === 1) {
  await redis.expire(rateLimitKey, 60)         // 60-second sliding window
}
if (count > SubmissionConfig.rateLimitPerMinute) {
  return { valid: false, code: 'RATE_LIMITED', ... }
}
```

**Daily limit** (tracked in Redis, falls back to DB):

```typescript
// Increment on new submission:
const key = `submission:daily:${userId}:${today}` // e.g. "2026-03-22"
await redis.incr(key)
await redis.expire(key, 86400)  // expires after 24 hours

// Read for display:
const val = await redis.get(dailyKey(userId))
const used = val ? parseInt(val, 10) : 0  // fallback to 0 if key missing
```

The poll endpoint also has its own rate limit: 60 requests per minute per judge token, preventing a misconfigured or runaway judge from hammering the API.

### 9.3 Submission cancellation

A user can cancel a `PENDING` submission (one that has not yet been picked up by the judge) via the `submission.cancel` mutation. The cancel flow uses Redis `LREM` for atomic removal:

```typescript
// Reconstruct the exact job payload that was pushed to the queue
const jobPayload = JSON.stringify({ submissionId, problemSlug, code, ... })

// Atomically remove the first occurrence of this exact payload from the queue
const removed = await redis.lrem(queueName, 1, jobPayload)

if (removed > 0) {
  // Job was still in the queue — successfully cancelled
  await prisma.submission.update({ data: { status: 'CANCELLED' } })
  // Refund the daily count
  const current = await redis.get(dailyKey(userId))
  if (current && parseInt(current) > 0) {
    await redis.decr(dailyKey(userId))
  }
  return { cancelled: true }
}

// removed === 0: judge already picked it up — cannot cancel
const current = await prisma.submission.findUnique(...)
return { cancelled: false, currentStatus: current.status }
```

The refund logic decrements the daily counter so a cancelled submission does not count against the user's daily limit. The counter is floored at 0 (it never goes negative).

### 9.4 Environment variables reference

**Judge process (`apps/judge/.env`):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `JUDGE_API_URL` | required | Web app base URL (e.g. `https://www.leetscuda.com`) |
| `JUDGE_API_TOKEN` | required | Bearer token (`jt_...`) for authenticating with the web app |
| `JUDGE_CAPABILITIES` | required | Comma-separated capability list (e.g. `cpp,cuda:13.0`) |
| `JUDGE_HOST_TMP_DIR` | unset | Host-side path of `apps/judge/tmp/` — required for DinD setups |
| `JUDGE_MAX_TIMEOUT_MS` | `60000` | Hard ceiling on execution timeout (ms) |
| `JUDGE_MAX_CODE_BYTES` | `16384` | Hard ceiling on code payload size (bytes) |

**Web app (`apps/web` / root `.env`):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | required | Postgres direct connection URL (used by Prisma migrations) |
| `DIRECT_URL` | unset | Postgres pooler URL (used at runtime; falls back to DATABASE_URL) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for queues and rate limiting |
| `SUBMISSION_DAILY_LIMIT_FREE` | `10` | Free user daily submission cap (0 = unlimited) |
| `SUBMISSION_DAILY_LIMIT_PAID` | `0` | Admin/paid user daily cap (0 = unlimited) |
| `SUBMISSION_MAX_CODE_BYTES` | `16384` | Primary code size limit (bytes) |
| `SUBMISSION_RATE_LIMIT_PER_MIN` | `5` | Per-minute rate limit per user |
| `SUBMISSION_TIMEOUT_MS` | `30000` | Default judge execution timeout (ms) |
| `SUBMISSION_MAX_TIMEOUT_MS` | `60000` | Maximum allowed timeout (ms) |
| `JUDGE_SUBMISSIONS_DISABLED` | `false` | Maintenance flag: disables all submissions when `true` |

---

## 10. Observability and debugging

### 10.1 Log format

All judge logs are prefixed with `[judge]`. Here is every log line the judge emits, with its meaning:

```
[judge] Judge worker ready
  → Worker started successfully, entering the poll loop.

[judge] Capabilities: cpp, cuda:13.0
  → Enumerates which queues this judge will poll. Verify this matches your intent.

[judge] API URL: https://www.leetscuda.com
  → Confirms JUDGE_API_URL is parsed correctly.

[judge] kubeconform available and offline validation confirmed — k8s validation enabled
  → Startup check passed for K8s judges. kubeconform is in PATH and can validate offline.

[judge] CLEANUP found 3 orphaned containers, stopping
  → Found N leftover containers from a previous crashed judge session. These are being stopped.

[judge] Processing clh1234abc — cuda c++17
  → About to execute a CUDA job, C++17 standard. submissionId is the cuid.

[judge] Processing clh5678def — k8s (7 checks)
  → About to validate a K8s manifest with 7 checks.

[judge] clh1234abc → ACCEPTED in 228ms
  → Job completed successfully. 228ms is the max runtime across all test cases.

[judge] clh1234abc → WRONG_ANSWER in 145ms
  → Job failed verification. Check testResults in the DB for which test case failed.

[judge] clh5678def → ACCEPTED (7/7 checks passed)
  → All K8s checks passed.

[judge] clh5678def → WRONG_ANSWER (5/7 checks passed)
  → 2 checks failed.

[judge] OVERSIZED clh9999xyz — rejected before sandbox
  → Code payload exceeded JUDGE_MAX_CODE_BYTES. Result submitted as RUNTIME_ERROR.

[judge] TIMEOUT clh1234abc — SIGTERM sent, waiting 5s
  → Job exceeded timeoutMs. docker stop is being called.

[judge] Network error during poll, retrying in 5s: [error]
  → DNS resolution failed, connection refused, or TLS error. Will retry with exponential backoff.

[judge] 401 Unauthorized — check JUDGE_API_TOKEN. Exiting.
  → Token is invalid or revoked. Process exits. Restart with a valid token.

[judge] 429 Too Many Requests — backing off 60s
  → Judge exceeded 60 requests/minute to the poll endpoint. Backs off for 60 seconds.

[judge] Shutting down...
  → SIGINT or SIGTERM received. Exiting cleanly.

[judge] Invalid job payload from server: [zod error message]
  → Poll returned a malformed job. This indicates a bug in the web app enqueue logic.

[judge] Error in main loop: [error]
  → Unexpected exception in the main loop. Sleeps 1 second and retries.
```

Web app logs from the result endpoint:

```
[judge-result] clh1234abc → ACCEPTED in 228ms (judge: gpu-1)
  → Confirmed receipt of result. "gpu-1" is the judge's name from the JudgeToken row.

[judge-result] Awarded 100 XP to user clhuser789
  → First solve detected, XP incremented.
```

### 10.2 Common failure modes and diagnosis

| Failure | Log indicator | Cause | Diagnosis | Fix |
|---------|--------------|-------|-----------|-----|
| Judge exits immediately | `401 Unauthorized — check JUDGE_API_TOKEN. Exiting.` | Token wrong, revoked, or not starting with `jt_` | Check `JUDGE_API_TOKEN` in judge `.env` | Regenerate token via admin panel, update `.env` |
| Submissions stuck in PENDING | No judge activity | Judge not running, wrong capabilities, or Redis issue | Check judge is running; check capabilities match problem runtime; check Redis connectivity from web app | Verify `JUDGE_CAPABILITIES` includes the required runtime; `redis-cli ping` on the Redis host |
| RUNTIME_ERROR on correct code | `exitCode: 1` in test results | Compilation failed | Check `errorMsg` field in submission — it contains compiler stderr | Fix compiler flags, ensure Docker image is pulled, check compute capability matches GPU |
| All CUDA jobs TIME_LIMIT | `TIMEOUT` in logs | GPU not attached to sandbox containers | Check `--gpus` flag on judge container; verify nvidia-container-toolkit | `docker run --rm --gpus all nvidia/cuda:13.0.0-devel-ubuntu24.04 nvidia-smi` |
| Orphan containers accumulating | `CLEANUP found N` on every startup | Judge crashing repeatedly mid-execution | Normal one-time cleanup; if recurring, the judge is crashing. Check main loop errors | Look for `[judge] Error in main loop:` or `[judge] Fatal error:` in logs |
| Disk full on judge machine | `ENOSPC` errors in sandbox | Temp dirs not cleaned up (prior crash, or cleanup failing) | `du -sh /tmp/leetscuda/*` or equivalent | Restart judge (triggers cleanup); clear `/tmp/leetscuda/` manually |
| Wrong answers on GPU problems | Failed verification | GPU computes slightly different floats than expected | The verifier has ±0.001 tolerance — if this is exceeded, the problem's expected values may be based on a different GPU | Re-generate expected outputs on the production GPU; check compute capability flag |
| Network errors, judge backing off | `Network error during poll, retrying in Xs` | Judge machine has no internet access, or web app is down | Check outbound HTTPS from judge machine | `curl https://www.leetscuda.com/api/health` from judge machine |

### 10.3 Health check

The web app exposes a health endpoint at `/api/health` that checks DB and Redis connectivity:

```bash
curl https://www.leetscuda.com/api/health
# 200 OK:
# {"status":"ok","timestamp":"2026-03-22T10:00:00.000Z","version":"unknown","checks":{"db":"ok","redis":"ok"}}

# 503 Degraded:
# {"status":"degraded","checks":{"db":"error","redis":"ok"}}
```

Note: the health endpoint does **not** check judge connectivity. The judge is a pull-based client with no inbound endpoint. To verify that a judge is alive and working:

1. Check judge logs for recent `→ ACCEPTED` or `→ WRONG_ANSWER` lines.
2. Check the `JudgeToken.lastSeenAt` field in the database — it is updated on every successful poll authentication.
3. Submit a test problem and observe whether it transitions from PENDING to RUNNING.

---

## 11. Operating a judge node

### 11.1 CPU judge setup

A CPU judge handles C++ problems only.

```bash
# 1. Generate a judge token via the admin panel or database
#    Store the displayed token — it is shown only once
#    Token example: jt_a3f8e1c24b9d06e5f2a8c3d7e1b9f04a6d2c8e3b1f7a9d5e2c4b6f8a1d3e7c9

# 2. Pre-pull Docker image on the judge machine
docker pull gcc:14

# 3. Configure judge environment
cp apps/judge/.env.example apps/judge/.env
# Edit apps/judge/.env:
#   JUDGE_API_URL=https://www.leetscuda.com
#   JUDGE_API_TOKEN=jt_...your-token...
#   JUDGE_CAPABILITIES=cpp
#   JUDGE_HOST_TMP_DIR=/absolute/host/path/to/apps/judge/tmp

# 4. Build the judge image
docker build -t leetscuda-judge -f apps/judge/Dockerfile .

# 5. Run the judge
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /absolute/host/path/to/apps/judge/tmp:/app/apps/judge/tmp \
  --env-file apps/judge/.env \
  --restart unless-stopped \
  leetscuda-judge
```

The double volume mount is critical:
- `-v /var/run/docker.sock:/var/run/docker.sock` — allows the judge to spawn sandbox containers via the host Docker daemon.
- `-v /absolute/host/path/to/apps/judge/tmp:/app/apps/judge/tmp` — ensures that the temp directories the judge creates inside the container are accessible on the host filesystem (because sandbox containers mount from the host path, not the judge container path).

`JUDGE_HOST_TMP_DIR` must be set to the same host path used in the second `-v` mount.

### 11.2 GPU judge setup

A GPU judge handles both C++ and CUDA problems. Additional prerequisites:

- NVIDIA drivers installed on the host (CUDA 13.0 compatible)
- `nvidia-container-toolkit` installed and configured
- Verify GPU runtime: `docker info | grep -i nvidia` should show `nvidia` as a runtime

```bash
# 1. Generate a token with cuda:13.0 capability
#    (or cpp,cuda:13.0 to also handle CPU jobs)

# 2. Pre-pull Docker images
docker pull gcc:14
docker pull nvidia/cuda:13.0.0-devel-ubuntu24.04

# 3. Configure
#   JUDGE_CAPABILITIES=cpp,cuda:13.0

# 4. Verify GPU is accessible
docker run --rm --gpus device=0 nvidia/cuda:13.0.0-devel-ubuntu24.04 nvidia-smi
# Should print GPU information

# 5. Run the judge
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /absolute/host/path/to/apps/judge/tmp:/app/apps/judge/tmp \
  --gpus all \
  --env-file apps/judge/.env \
  --restart unless-stopped \
  leetscuda-judge
```

Note: `--gpus all` on the judge container itself is only needed if `runDirect()` fallback is used. For the Docker-based sandbox (normal production mode), the judge container does not need GPU access — only the spawned sandbox containers do, and those get `--gpus device=0` when spawned.

### 11.3 K8s judge setup

The K8s judge uses a separate Dockerfile (`Dockerfile.k8s`) that installs `kubeconform` and pre-warms its bundled schemas at build time:

```bash
# 1. Generate a token with k8s capability

# 2. Build the K8s judge image (includes kubeconform)
docker build -t leetscuda-judge-k8s -f apps/judge/Dockerfile.k8s .

# 3. Configure
#   JUDGE_CAPABILITIES=k8s
#   (JUDGE_HOST_TMP_DIR is not needed — K8s judge uses os.tmpdir() directly)

# 4. Run (no Docker socket needed)
docker run \
  --env-file apps/judge/.env \
  --restart unless-stopped \
  leetscuda-judge-k8s
```

The `Dockerfile.k8s` pre-warms kubeconform schemas at build time:

```dockerfile
RUN printf 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: test\n' > /tmp/test.yaml \
    && kubeconform -schema-location default -summary /tmp/test.yaml \
    && rm /tmp/test.yaml
```

This causes kubeconform to download and cache its schema bundle during `docker build`, so the runtime container starts up instantly with no network schema downloads.

### 11.4 DinD host path mapping

When the judge runs inside Docker and spawns sibling sandbox containers, the temp directory path must be mapped correctly. The judge writes files to its internal path `/app/apps/judge/tmp/{id}/solution.cpp`. It then tells Docker to mount `{JUDGE_HOST_TMP_DIR}/{id}` into the sandbox container. If `JUDGE_HOST_TMP_DIR` is `/host/repo/apps/judge/tmp`, then:

```
Judge container internal path:  /app/apps/judge/tmp/abc123/solution.cpp
Host filesystem path:           /host/repo/apps/judge/tmp/abc123/solution.cpp
Sandbox container mount:        /host/repo/apps/judge/tmp/abc123 → /work
Sandbox container sees:         /work/solution.cpp   ✓
```

If `JUDGE_HOST_TMP_DIR` is wrong, the sandbox container's `/work` directory will be empty and compilation will fail with "No such file or directory."

### 11.5 Revoking a judge node

To immediately block a judge from receiving new jobs:

```sql
UPDATE "JudgeToken" SET "isActive" = false WHERE name = 'gpu-1';
```

Or to permanently delete the token:

```sql
DELETE FROM "JudgeToken" WHERE name = 'gpu-1';
```

The next poll request from that judge returns 401, and the judge process exits. Any job currently being executed completes normally and its result is submitted before the next poll attempt.

---

## 12. Security considerations

### 12.1 Threat model

| Threat | Mitigations |
|--------|-------------|
| Malicious code reading host filesystem | Docker volume mount provides read-write access only to `/work` (the temp dir). No other host directories are mounted. |
| Malicious code exfiltrating data via network | `--network none` disables all network interfaces inside the container. No TCP, UDP, or Unix socket connections to external systems are possible. |
| Fork bomb (exponential process spawning) | `--ulimit nproc=64` (cpp) / `--ulimit nproc=128` (cuda) caps total process count. A fork bomb is stopped before it exhausts the kernel process table. |
| Memory exhaustion | `--memory 256m` / `--memory 512m` hard OOM limit. Process is killed if it exceeds the limit. |
| CPU monopolization | `--cpus 0.5` limits CPU share. Timeout kills the process at `timeoutMs` regardless. |
| Infinite loop | `timeoutMs` (default 30 s) + two-phase SIGTERM/SIGKILL ensures the process is killed. |
| Infinite output | Output is capped at 64 KB per stream. Excess output causes SIGKILL. |
| Compromised judge token | Per-judge tokens allow instant revocation. A compromised token can be disabled without affecting other judges. |
| Solution extraction | Solution section is parsed server-side in `loadProblemContent()` but is never included in the job payload or API response. |
| Replay attacks | Each job's `submissionId` is a cuid (globally unique). The result endpoint writes to the specific submission row — replaying the same result is idempotent (overwrites with same data). |
| Container escape via writable Docker socket | See §12.2. |
| GPU memory snooping | See §12.2. |

### 12.2 Known limitations

The following are known security limitations that have not been fully mitigated:

**Docker socket privilege escalation:** The judge container is granted access to the host Docker socket (`/var/run/docker.sock`). This socket provides root-equivalent access to the Docker daemon. A sophisticated attacker who achieves code execution inside a *sandbox container* (not the judge container) would need to first escape the sandbox container's isolation (which requires exploiting a Docker vulnerability), then interact with the judge process or the Docker socket. However, the judge container itself has the Docker socket mounted — if the judge process is itself compromised (e.g. via a vulnerability in Node.js or the judge code), an attacker could use the socket to spawn privileged containers with full host filesystem access.

Mitigation: run the judge machine in an isolated network segment with no connectivity to internal infrastructure (no access to the production database, no access to internal services). Treat the judge machine as untrusted infrastructure.

**GPU memory isolation:** CUDA does not provide strong memory isolation between containers sharing a physical GPU. A malicious CUDA kernel could potentially read GPU memory from previous executions if that memory has not been zeroed. This is analogous to DRAM cold boot attacks. NVIDIA's MIG (Multi-Instance GPU) technology provides hardware-level isolation on A100/H100, but requires specific hardware and configuration.

Mitigation: use MIG where available; clear GPU memory between submissions (not currently implemented); or dedicate one GPU per judge with periodic resets.

**Timing side channels:** The reported `runtimeMs` is observable by the submitting user. A sufficiently careful attacker could submit variations of code and observe timing differences to infer information about test case content (e.g. input size, whether an early-exit condition is triggered). This is a low-risk attack for a coding platform — test case inputs are typically visible in the problem description anyway — but worth noting for problems with secret test cases.

---

## Appendix A — Data flow diagrams

### A.1 Happy path: correct solution submitted and accepted

```
t=0    Browser: user clicks "Submit"
        │
        ▼
t=1    POST /api/trpc/submission.create
        validateSubmission() → passes all checks
        INSERT Submission { status: PENDING }
        RPUSH judge:queue:cuda:13.0 { submissionId: "clh111" }
        → returns { submissionId: "clh111" }
        │
        ▼
t=1    Browser: starts polling getStatus every 1500 ms
        getStatus("clh111") → { status: "PENDING" }
        │
        ▼
t=2    Judge: GET /api/judge/poll
        authenticate → ok
        BLPOP judge:queue:cuda:13.0 → "clh111" job payload
        fetch Submission + Problem from DB
        loadProblemContent() → testCases, harness
        UPDATE Submission { status: RUNNING }
        return job payload
        │
t=2    Browser polling: getStatus → { status: "RUNNING" }
        │
        ▼
t=2    Judge: runInSandbox(code + harness, input[0], ...)
        mkdirSync /tmp/.../clh111-0/
        writeFileSync solution.cu
        docker run nvcc ... → exit 0 (compile success)
        docker run ./solution < "4\n1.0 2.0..." → stdout "11.0 22.0..."
        verify("11.0 22.0...", "11.0 22.0...") → true  ✓
        [repeat for test cases 1..N]
        rmSync /tmp/.../clh111-0/
        │
        ▼
t=3    Judge: POST /api/judge/result
        { submissionId: "clh111", status: "ACCEPTED", runtimeMs: 228, testResults: [...] }
        │
        ▼
t=3    Web app result endpoint:
        UPDATE Submission { status: ACCEPTED, runtimeMs: 228 }
        upsert UserProgress { attempts: 1 }
        firstSolve = true → User.xp += 100
        updateStreak(userId)
        → returns { received: true, firstSolve: true }
        │
        ▼
t=4    Browser polling: getStatus → { status: "ACCEPTED", firstSolve: true }
        Renders: result panel + all test cases green
        Triggers: confetti animation + "+100 XP" banner
        Unlocks: editorial tab
```

### A.2 Timeout flow: user submits an infinite loop

```
t=0    Browser: POST /api/trpc/submission.create
        INSERT Submission { status: PENDING }
        RPUSH judge:queue:cpp { submissionId: "clh222" }
        │
        ▼
t=1    Judge: poll → receives job
        UPDATE Submission { status: RUNNING }
        │
        ▼
t=1    Judge: runInSandbox(infiniteLoopCode, input, { timeoutMs: 10000 })
        docker run gcc:14 ... g++ compile → exit 0
        docker run --name lc-judge-clh222-0 ./solution < input
        [process runs indefinitely]
        │
        ▼
t=11   timeoutMs fires (10 seconds elapsed)
        Promise.race resolves with 'TIMEOUT'
        runtimeMs = 10000 ms
        console.log("[judge] TIMEOUT clh222-0 — SIGTERM sent, waiting 5s")
        execSync("docker stop --time 5 lc-judge-clh222-0")
          → SIGTERM sent to container
          → container doesn't exit within 5 s (ignoring SIGTERM)
          → SIGKILL sent by Docker
        return { exitCode: 124, runtimeMs: 10000 }
        │
        ▼
t=16   finalStatus = TIME_LIMIT
        break (stop running further test cases)
        │
        ▼
t=16   Judge: POST /api/judge/result
        { status: "TIME_LIMIT", runtimeMs: 10000, testResults: [{ passed: false }] }
        │
        ▼
t=16   Web app: UPDATE Submission { status: TIME_LIMIT }
        (no XP awarded, no UserProgress upsert)
        │
        ▼
t=17   Browser: getStatus → { status: "TIME_LIMIT" }
        Renders: result panel with "Time Limit Exceeded" status
        Shows: which test case timed out
```

### A.3 Concurrent submissions from two different users

```
User A submits "vector-add"          User B submits "vector-add"
        │                                    │
        ▼                                    ▼
INSERT Submission clhA (PENDING)    INSERT Submission clhB (PENDING)
RPUSH judge:queue:cuda:13.0 clhA   RPUSH judge:queue:cuda:13.0 clhB
        │                                    │
        ▼                                    │
Queue: [clhA, clhB]  ◄───────────────────────┘
        │
        │   [assuming two GPU judges are running: gpu-1 and gpu-2]
        │
        ▼                                    ▼
gpu-1 polls: BLPOP → gets clhA     gpu-2 polls: BLPOP → gets clhB
        │                                    │
        ▼                                    ▼
gpu-1: UPDATE clhA RUNNING         gpu-2: UPDATE clhB RUNNING
gpu-1: runInSandbox(clhA)          gpu-2: runInSandbox(clhB)
gpu-1: [executing on GPU device=0] gpu-2: [executing on GPU device=0]
        │  (both use device=0       │   (two separate machines, each
        │   on their respective     │    with their own GPU)
        │   machines)               │
        ▼                           ▼
gpu-1: POST /result clhA           gpu-2: POST /result clhB
UPDATE clhA status                 UPDATE clhB status
        │                                    │
        ▼                                    ▼
User A sees result                  User B sees result
(independently)                     (independently)
```

If only one GPU judge is running, clhA and clhB are processed sequentially — the BLPOP is atomic, so only one judge receives each job. User B sees PENDING status until User A's job completes.

---

## Appendix B — Queue message format

The following JSON structures are stored as strings in the Redis queues via `RPUSH`. These are the *queue messages* — a subset of the full job payload. The poll endpoint enriches them with test cases, harness, and k8s checks before returning the full job payload to the judge.

**`judge:queue:cpp`**

```json
{
  "submissionId": "clh1234567890abcdef",
  "problemSlug": "false-sharing",
  "code": "#include <thread>\n#include <chrono>\n...",
  "language": "cpp",
  "runtime": "cpp",
  "cppStandard": "17"
}
```

**`judge:queue:cuda:13.0`**

```json
{
  "submissionId": "clh9876543210fedcba",
  "problemSlug": "vector-add",
  "code": "__global__ void vecAdd(const float* a, const float* b, float* c, int n) {\n    ...\n}",
  "language": "cpp",
  "runtime": "cuda",
  "cppStandard": "17",
  "cudaVersion": "13.0",
  "computeCap": "sm_120"
}
```

**`judge:queue:k8s`**

```json
{
  "submissionId": "clhk8sabcdef123456",
  "problemSlug": "deploy-inference-server",
  "code": "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: vllm-server\n...",
  "language": "yaml",
  "runtime": "k8s"
}
```

Note: K8s queue messages do not include `k8sChecks` or `k8sMultiDoc`. These are loaded server-side from the MDX file by the poll endpoint and added to the full job payload returned to the judge. This keeps queue messages compact and ensures the judge always gets the latest check definitions from the MDX files.

---

## Appendix C — Glossary

**Sandbox container:** A Docker container spawned to execute user-submitted code in isolation. It has no network access, limited memory, limited CPU, and limited process count. It mounts only the submission's temp directory and exits after execution completes.

**Sibling container:** A container spawned by the judge that is a sibling of the judge container (both are children of the same Docker daemon) rather than a nested child. The judge spawns sandbox containers by communicating with the host Docker daemon via the mounted socket — the containers appear at the same level in the Docker daemon's process tree as the judge container itself.

**Docker-in-Docker (DinD) vs Docker socket mounting:** True DinD runs a second Docker daemon inside a container. Docker socket mounting (what this project uses) mounts the host's existing Docker daemon socket into the judge container, making the judge a client of the host daemon. Docker socket mounting is simpler (no nested daemon), but grants the judge container root-equivalent access to the host via the Docker API.

**Capability (judge capability):** A string that declares what kind of jobs a judge token can process. Examples: `"cpp"`, `"cuda:13.0"`, `"k8s"`. Not to be confused with Linux capabilities (`CAP_NET_ADMIN`, etc.) — these are application-level routing labels stored in the JudgeToken database row.

**Long-polling:** An HTTP request technique where the server holds the connection open until data is available or a timeout expires, rather than returning immediately. The judge's GET `/api/judge/poll` blocks for up to 30 seconds via Redis `BLPOP` before returning 204 if no job is available. This reduces the number of polling requests compared to short-polling (which would return immediately every time).

**Test harness:** C++ source code containing `main()` that reads input, calls the user's function (e.g. `solve()` or `vecAdd()`), and prints output. The harness is stored in the MDX `---harness---` section and is concatenated with the user's code before compilation. Users implement only the kernel or algorithm function; the harness handles I/O, memory allocation, and result printing. The harness is never shown to users.

**Compute capability (`sm_XY`):** A versioning scheme for NVIDIA GPU architectures that indicates which GPU instructions and features are available. The first digit (X) is the major architecture generation (e.g. 8 = Ampere, 9 = Hopper, 12 = Blackwell). The second digit (Y) is the minor revision. `nvcc -arch=sm_120` compiles specifically for Blackwell-class GPUs. Using the wrong compute capability causes either incorrect code generation (if GPU does not support the target) or suboptimal code (if targeting too old an architecture). The compute capability is stored on the `Problem` row and flows through the queue message → job payload → nvcc invocation.

**BLPOP:** A Redis command that blocks until an element is available in one of the specified lists, then atomically removes and returns the leftmost element from the first non-empty list. `BLPOP list1 list2 30` blocks for up to 30 seconds watching both lists, returning from whichever has a value first. This is how the poll endpoint waits for jobs without busy-polling Redis in a tight loop.

**cuid:** A collision-resistant, URL-safe unique identifier. All `id` fields in the Prisma schema use `@default(cuid())`. A cuid looks like `clh1234567890abcdef` — it encodes a timestamp and random bits, making it sortable by creation time and guaranteed unique across distributed systems. Submission IDs are cuids.

**`fill:N:V` shorthand:** A compact notation in MDX test case expected outputs for large uniform arrays. `fill:256:0.0` means "256 copies of the value 0.0, space-separated." This allows test cases for million-element arrays to be stored compactly in MDX files without embedding millions of numbers. The verifier expands this shorthand before comparison. The matching `fill:value` notation in input YAML (e.g. `"fill:1.0"` with the count provided separately) is handled by the problem harness's stdin reader.

**Exponential backoff:** When the judge encounters network errors (DNS failure, connection refused, etc.), it waits before retrying: first 5 seconds, then 10, then 20, doubling each time up to a maximum of 60 seconds. This prevents a judge from hammering a temporarily unavailable API server. A successful response resets the backoff to 5 seconds.
