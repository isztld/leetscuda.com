# judge-cuda-cpp — Architecture

> Version: 0.1.0 (design, pre-implementation)
> Runtimes handled: `cpp` (g++), `cuda` (nvcc)
> Replaces: `apps/judge` (cpp + cuda paths only)

---

## Table of Contents

- [1. Purpose and scope](#1-purpose-and-scope)
- [2. Design principles](#2-design-principles)
- [3. Source layout](#3-source-layout)
- [4. REST API contract](#4-rest-api-contract)
- [5. Job lifecycle](#5-job-lifecycle)
- [6. Two-phase sandbox](#6-two-phase-sandbox)
  - [6.1 Phase 1 — Build container](#61-phase-1--build-container)
  - [6.2 Phase 2 — Eval container](#62-phase-2--eval-container)
  - [6.3 Why two containers?](#63-why-two-containers)
  - [6.4 Container naming and labels](#64-container-naming-and-labels)
  - [6.5 File injection via docker cp (no bind mounts)](#65-file-injection-via-docker-cp-no-bind-mounts)
  - [6.6 Timeout and two-phase kill](#66-timeout-and-two-phase-kill)
  - [6.7 Output capture and sanitization](#67-output-capture-and-sanitization)
  - [6.8 Orphan container cleanup](#68-orphan-container-cleanup)
- [7. Docker security hardening](#7-docker-security-hardening)
  - [7.1 Socket proxy](#71-socket-proxy)
  - [7.2 Container flags — build phase](#72-container-flags--build-phase)
  - [7.3 Container flags — eval phase](#73-container-flags--eval-phase)
  - [7.4 Seccomp profiles](#74-seccomp-profiles)
  - [7.5 CUDA-specific additions](#75-cuda-specific-additions)
  - [7.6 GPU memory isolation caveat](#76-gpu-memory-isolation-caveat)
- [8. Output verification](#8-output-verification)
- [9. Startup hardening](#9-startup-hardening)
- [10. Submission limits](#10-submission-limits)
- [11. Environment variables](#11-environment-variables)
- [12. Logging](#12-logging)
- [13. Deployment](#13-deployment)
  - [13.1 CPU judge (cpp only)](#131-cpu-judge-cpp-only)
  - [13.2 GPU judge (cpp + cuda)](#132-gpu-judge-cpp--cuda)
  - [13.3 Direct execution fallback (dev only)](#133-direct-execution-fallback-dev-only)
- [14. Threat model](#14-threat-model)

---

## 1. Purpose and scope

`judge-cuda-cpp` is a standalone Node.js worker that evaluates C++ and CUDA
submissions against test cases defined in MDX problem files. It polls the web
app for jobs, executes them in isolated Docker containers, and posts results
back via REST.

It handles only the `cpp` and `cuda` runtimes. Kubernetes manifest validation
is handled by `judge-k8s` (a completely separate process with no Docker socket
access).

---

## 2. Design principles

- **Pull-based polling**: the judge initiates all outbound HTTPS requests. No
  inbound port is ever opened. The judge can run behind NAT or in an ephemeral
  cloud VM. The web app never needs to reach the judge IP.

- **Stateless worker**: no local database, no Redis connection. All persistent
  state (submission records, XP, streak) lives in the web app's Postgres. Kill
  the judge, restart it, resume immediately.

- **Layered sandbox**: user code never touches the host filesystem. Two
  separate containers handle compilation and execution, each with the minimum
  capabilities required for its phase.

- **Minimal Docker surface via socket proxy**: the judge process never touches
  `/var/run/docker.sock` directly. A `docker-socket-proxy` sidecar exposes
  only the operations the judge needs (create, start, stop, rm, wait, logs,
  cp). Pulling images, exec, network management, and all other Docker API
  verbs are blocked at the proxy layer.

- **Defense in depth**: security is layered rather than singular. No single
  bypass grants useful access: bearer token auth → SHA-256 hashed token
  storage → timing-safe comparison → socket proxy allowlist → network none →
  cap-drop ALL → no-new-privileges → seccomp whitelist → user 65534 → tmpfs
  scratch space → output size cap → pids limit → memory/CPU limit.

- **Capability-aware routing**: the judge token declares what it can run
  (`cpp`, `cuda:13.0:sm_120`). Jobs requiring a higher CUDA version or
  compute capability than the judge declares are not claimed; the web app
  re-queues them.

---

## 3. Source layout

```
apps/judge-cuda-cpp/
├── ARCHITECTURE.md
├── src/
│   ├── main.ts              entry point — poll loop, startup checks, signal handling
│   ├── env.ts               zod env schema, capability parsing, startup validation
│   ├── types.ts             zod schemas + TypeScript types for jobs and results
│   ├── api-client.ts        pollForJob(), submitResult(), recoverStuckSubmissions()
│   ├── verifier.ts          output comparison, fill-shorthand expansion
│   └── sandbox/
│       ├── index.ts         runInSandbox() orchestrator — picks docker or direct
│       ├── build.ts         Phase 1: compile container lifecycle
│       ├── eval.ts          Phase 2: evaluation container lifecycle
│       ├── proxy.ts         verifyDockerProxy(), cleanupOrphanedContainers()
│       └── sanitize.ts      sanitizeOutput() — strip ANSI, non-printable chars
├── seccomp/
│   ├── cpp.json             seccomp allowlist for C++ eval containers
│   └── cuda.json            seccomp allowlist for CUDA eval containers (adds GPU ioctls)
├── Dockerfile               judge worker image (Node.js + docker CLI client)
├── Dockerfile.cuda-sandbox  CUDA sandbox image (adds nobody user uid 65534 with homedir)
├── docker-compose.yml       judge service + socket-proxy sidecar
├── .env.example
└── tsconfig.json
```

---

## 4. REST API contract

The judge consumes three endpoints on the web app. All requests carry:

```
Authorization: Bearer <JUDGE_API_TOKEN>
X-Judge-Capabilities: cpp,cuda:13.0:sm_120
Content-Type: application/json
```

### `GET /api/judge/poll`

Long-polls for a job (up to 30 s server-side BLPOP). Returns:

| Status | Meaning |
|--------|---------|
| `200`  | Job payload (JSON) |
| `204`  | No job available; poll again immediately |
| `401`  | Invalid token — judge exits |
| `429`  | Rate-limited — back off 60 s |

### `POST /api/judge/result`

Posts a completed result. Body: `JudgeResult` (see `src/types.ts`).

| Status | Meaning |
|--------|---------|
| `200`  | Accepted |
| `401`  | Invalid token — judge exits |

### `POST /api/judge/recover`

Called once on startup. Asks the web app to mark any submissions left in
`RUNNING` state as `RUNTIME_ERROR` (handles the previous judge crash case).

Response: `{ recovered: number }`

### `GET /api/judge/health` (local only)

Exposed by the judge itself on `JUDGE_HEALTH_PORT` (default `8080`) for
Docker/k8s health checks. Returns `200 { status: "ok", capabilities: [...] }`
when the poll loop is alive, `503` when not yet ready or shut down.

---

## 5. Job lifecycle

```
web app                          judge-cuda-cpp
─────────────────────────────────────────────────────────────────────
  BLPOP judge:queue:cpp
  BLPOP judge:queue:cuda
  ─ returns job payload ──────────────────────────────►  pollForJob()
                                                          zod validate payload
                                                          secondary code-size guard
                                                          for each test case:
                                                            runInSandbox()
                                                              ├─ buildContainer()  phase 1
                                                              └─ evalContainer()   phase 2
                                                          verify() outputs
                                                          assemble JudgeResult
  ◄── POST /api/judge/result ─────────────────────────  submitResult()
  UPDATE Submission, award XP, updateStreak()
```

**Error fast-path**: if any test case returns `TIME_LIMIT` or `RUNTIME_ERROR`,
the remaining test cases are skipped and the result is submitted immediately.

**Backoff**: on any network error during poll or result submission, the judge
backs off exponentially from 5 s to 60 s maximum. On `401`, it exits
immediately (token invalid; restart with correct token).

---

## 6. Two-phase sandbox

Each submission test case is executed in two short-lived Docker containers.

### 6.1 Phase 1 — Build container

Goal: compile user code into a static binary. The binary is extracted to the
host via `docker cp`, then the build container is removed.

```
docker create  --name lc-build-<submissionId>-<tcIdx>
               --network none
               --memory 512m          (nvcc is memory-hungry)
               --cpus 1.0
               --pids-limit 128       (compiler forks many subprocesses)
               --user 65534:65534
               --cap-drop ALL
               --security-opt no-new-privileges:true
               --security-opt seccomp=<build-seccomp>
               --tmpfs /sandbox:size=64m,mode=0777
               --tmpfs /tmp:size=64m,mode=1777
               --label leetscuda-judge=1
               --label leetscuda-phase=build
               <image>  /bin/sh -c "<compile command>"

docker cp <tempCodePath>  lc-build-..:/sandbox/solution.{cu,cpp}
docker start lc-build-...
docker wait  lc-build-...           (30 s compile timeout)
docker cp    lc-build-...:/sandbox/solution  <tempBinaryPath>
docker rm -f lc-build-...
```

If the build container exits non-zero, the test case result is
`RUNTIME_ERROR` with the captured stderr (compiler diagnostics).

The build container does **not** receive the test case input — it only sees
the source file.

### 6.2 Phase 2 — Eval container

Goal: run the pre-compiled binary against a single test case input. No compiler
is present in this container.

```
docker create  --name lc-eval-<submissionId>-<tcIdx>
               --network none
               --memory 256m          (128m for cpp, 512m for cuda)
               --cpus 0.5
               --pids-limit 32        (binary should not fork much)
               --user 65534:65534
               --cap-drop ALL
               --security-opt no-new-privileges:true
               --security-opt seccomp=<eval-seccomp>
               --tmpfs /sandbox:size=16m,mode=0777
               --tmpfs /tmp:size=16m,mode=1777
               --label leetscuda-judge=1
               --label leetscuda-phase=eval
               [--gpus device=0]      (cuda only)
               [--cap-add SYS_PTRACE] (cuda only — NVIDIA driver requires it)
               <image>  /bin/sh -c "/sandbox/solution < /sandbox/input.txt"

docker cp <tempBinaryPath>  lc-eval-...:/sandbox/solution
docker cp <tempInputPath>   lc-eval-...:/sandbox/input.txt
docker start  lc-eval-...
docker wait   lc-eval-...   (effectiveTimeout ms — race with sleep())
docker logs   lc-eval-...   → stdout / stderr
docker rm -f  lc-eval-...
```

The eval container has an even tighter resource envelope than the build
container. The binary is already compiled; the only work is running it.

### 6.3 Why two containers?

The current monolithic approach runs `compile && execute` in a single
container. Separating phases provides:

1. **Different resource envelopes**: compilation legitimately needs more pids
   and memory (compiler subprocesses, template instantiation). The eval phase
   can be much tighter.
2. **Binary inspection point**: between phases, the judge can sanity-check the
   binary exists and has a sane size before committing eval resources.
3. **Cleaner failure attribution**: a compilation failure can be clearly
   labelled `COMPILE_ERROR` rather than folded into `RUNTIME_ERROR`.
4. **Eval-container image minimalism**: the eval image does not need to contain
   `nvcc`, `g++`, or any compiler toolchain. A minimal image reduces the
   attack surface available if an exploit escapes the process boundary.

### 6.4 Container naming and labels

All containers are named `lc-{phase}-{submissionId}-{tcIdx}` and carry:

```
--label leetscuda-judge=1
--label leetscuda-phase=build|eval
```

The startup orphan-cleanup pass filters by `leetscuda-judge=1` to find and
stop all containers left by a previously crashed judge session. The label
approach is robust across multiple simultaneous judge workers (each processes
different submissions; the label namespace is shared, so all orphans from any
judge on this Docker host are cleaned up).

### 6.5 File injection via docker cp (no bind mounts)

User code, test input, and the compiled binary are injected into containers
via `docker cp` rather than host-path bind mounts. This is intentional:

- Bind mounts expose the host directory to the container; a path-traversal
  or symlink attack inside the container could reach host files outside the
  intended directory.
- `docker cp` writes into the container's overlay filesystem layer. The
  container process sees a flat `/sandbox` directory with no connection to
  the host path where the files originated.

Temp files on the host are written to `os.tmpdir()` under unique names and
deleted immediately after the `docker cp` completes (in a `finally` block).

### 6.6 Timeout and two-phase kill

Compile timeout: fixed at 30 s. The compiler is trusted not to infinite-loop
(it processes a fixed-size file), but a runaway template instantiation or
pathological input can wedge it.

Eval timeout: `min(job.timeoutMs, JUDGE_MAX_TIMEOUT_MS)`. The payload value
is clamped on arrival — the judge never trusts the payload to set an
arbitrarily long timeout.

Kill sequence for eval containers:

```
1. Promise.race([docker wait <container>, sleep(timeoutMs)])
2. If timeout fires:
     docker stop --time 5 <container>   (SIGTERM → 5 s grace → SIGKILL)
3. Return { exitCode: 124, timedOut: true }
```

Exit code `124` maps to `TIME_LIMIT` in the verifier.

### 6.7 Output capture and sanitization

`docker logs <container>` captures stdout and stderr after the container exits.

Both streams are:

- Truncated to `MAX_OUTPUT_BYTES` (64 KiB per stream). If the container is
  still running when the limit is hit (streaming), `docker stop` is issued.
- Sanitized: ANSI CSI escape sequences and all non-printable characters except
  `\t`, `\n`, `\r`, and printable ASCII (`0x20`–`0x7e`) are stripped. This
  prevents terminal injection attacks in the result UI.

### 6.8 Orphan container cleanup

On startup, before polling begins:

```typescript
docker ps --filter label=leetscuda-judge --filter status=running -q
// for each ID: docker stop --time 1 <id>
```

This handles the case where the judge process was killed mid-job, leaving a
running sandbox container consuming resources.

---

## 7. Docker security hardening

### 7.1 Socket proxy

The judge process never mounts `/var/run/docker.sock`. Instead, a
`ghcr.io/tecnativa/docker-socket-proxy` sidecar runs alongside the judge and
exposes only the minimal API surface needed:

| Permission | Value | Rationale |
|-----------|-------|-----------|
| `CONTAINERS` | `1` | create, start, stop, rm, wait, logs, cp |
| `POST` | `1` | required for container lifecycle |
| `EXEC` | `0` | blocked — no exec into containers |
| `IMAGES` | `0` | blocked — images must be pre-pulled; judge cannot pull |
| `NETWORKS` | `0` | blocked — no network manipulation |
| `BUILD` | `0` | blocked — no docker build |
| `VOLUMES` | `0` | blocked — no volume management |
| `INFO` | `0` | blocked — `docker info` is denied; use `docker ps` for health |
| All others | `0` | denied by default |

The proxy binds to `127.0.0.1:2375`. The judge container uses host networking
so that `DOCKER_HOST=tcp://127.0.0.1:2375` resolves to the proxy. The proxy
container itself is `read_only: true` with `/run` and `/tmp` on tmpfs.

If `DOCKER_HOST` is not set, the judge logs a warning and falls through to the
direct socket (acceptable in dev; forbidden in prod).

### 7.2 Container flags — build phase

| Flag | Value | Purpose |
|------|-------|---------|
| `--network` | `none` | Compiler has no network access |
| `--memory` | `512m` | nvcc needs more headroom than a running binary |
| `--cpus` | `1.0` | Compile in parallel but cap at one core |
| `--pids-limit` | `128` | Compiler spawns subprocesses (cc1plus, as, ld) |
| `--user` | `65534:65534` | nobody:nogroup — not root |
| `--cap-drop` | `ALL` | Drop all Linux capabilities |
| `--security-opt` | `no-new-privileges:true` | Prevent privilege escalation via setuid |
| `--security-opt` | `seccomp=<build-seccomp>` | Syscall allowlist (build profile is slightly broader to accommodate compiler) |
| `--tmpfs /sandbox` | `size=64m,mode=0777` | Source + binary scratch space |
| `--tmpfs /tmp` | `size=64m,mode=1777` | Compiler temp files |
| `--label` | `leetscuda-judge=1` | Orphan cleanup fingerprint |

### 7.3 Container flags — eval phase

Same as build phase except:

| Flag | Value | Change from build |
|------|-------|-------------------|
| `--memory` | `128m` (cpp) / `512m` (cuda) | Tighter for cpp; CUDA needs GPU memory headroom |
| `--cpus` | `0.5` | Binary runs on half a core |
| `--pids-limit` | `32` | Binary should not fork |
| `--tmpfs /sandbox` | `size=16m` | Only binary + input; no compiler output needed |
| `--tmpfs /tmp` | `size=16m` | Smaller; just runtime temp space |

### 7.4 Seccomp profiles

Two profiles are maintained under `seccomp/`:

**`cpp.json`** — allowlist for C++ eval containers. Permits standard POSIX
syscalls needed by a compiled binary (read, write, mmap, futex, clock_*, etc.)
while explicitly blocking dangerous syscalls: `ptrace`, `bpf`, `perf_event_open`,
`mount`, `unshare`, `setns`, `kexec_*`, `init_module`, `delete_module`, and
the full set of kernel modification calls.

`defaultAction` is `SCMP_ACT_ERRNO` — any syscall not on the allowlist fails
with `EPERM` rather than `SIGSYS` (which would kill the process and make
errors harder to debug).

**`cuda.json`** — extends `cpp.json` with the additional syscalls required by
the NVIDIA userspace driver (`ioctl` with broader arg ranges, `mmap` with
device memory flags). The CUDA profile also permits `SYS_PTRACE` at the
process level because the NVIDIA driver uses ptrace-based memory introspection
internally (separate from the `--cap-add SYS_PTRACE` Docker flag, which is
required for the GPU context to initialize).

Both profiles are mounted into the judge container at `/etc/judge/seccomp/`.
If a profile file is absent (dev environment without profiles deployed), the
judge logs a warning and runs without syscall filtering — never silently
assuming a missing profile means "allow all".

### 7.5 CUDA-specific additions

CUDA eval containers additionally receive:

```
--gpus device=0          assign GPU 0 (single-GPU machines)
--cap-add SYS_PTRACE     NVIDIA driver requires ptrace-based memory management
```

The `--gpus` flag is added only when `runtime === 'cuda'`. On multi-GPU
machines, the specific device can be configured via `JUDGE_GPU_DEVICE`
(default `0`).

### 7.6 GPU memory isolation caveat

GPU memory is **not** cleared between jobs. After a CUDA container exits, the
GPU driver may retain residual allocations or cache lines from the previous
process. A proper solution requires NVIDIA MIG (Multi-Instance GPU, available
on A100/H100) which provides hardware-level memory isolation between compute
instances.

On consumer/prosumer GPUs (RTX series, A-series without MIG):

- A warning is logged after every CUDA job: `GPU memory not cleared — potential
  data leakage between submissions`.
- The two containers are always started sequentially (not concurrently) to
  bound the window where stale GPU state could be observed.
- MIG configuration is documented in `docs/gpu-setup.md` for operators who
  require strict isolation.

---

## 8. Output verification

After each eval container exits with code `0`, `verifier.ts` compares
`stdout` against the expected output defined in the test case.

Supported expected formats:

- **Literal**: exact string match (after trimming trailing whitespace from
  each line).
- **Float tolerance**: `~0.001 3.14159` — passes if `|actual - expected| ≤ tolerance`.
- **Fill shorthand**: `fill(N, value)` — expands to N space-separated values.
  Used in test cases that output large arrays to avoid repeating the expected
  output N times in the MDX file.
- **Multi-line**: each line of `expected` is matched independently against the
  corresponding line of `stdout`. The test passes only if all lines match.

The verifier is pure (no I/O), trivially testable, and has no dependency on
Docker or the network.

---

## 9. Startup hardening

Before the poll loop begins, `main.ts` runs a sequence of startup checks:

1. **Env validation** (`env.ts`): zod parses `process.env`. Any missing or
   malformed env var throws immediately with a human-readable error listing
   every failing field.

2. **Seccomp profile check**: both `seccomp/cpp.json` and `seccomp/cuda.json`
   are stat'd. Missing profiles log a `WARNING` (not a fatal error, to allow
   dev without full profiles). In production, an operator-level check should
   fail the deployment if profiles are absent.

3. **Root process check**: if `process.getuid() === 0`, a warning is logged.
   The judge should run as a non-root user; sandbox containers already enforce
   `--user 65534:65534` regardless.

4. **Docker proxy check** (`proxy.ts`): `docker ps --filter label=leetscuda-judge`
   is executed through the proxy. If the proxy is unreachable, the judge exits
   with code `1` and a clear error message.

5. **Orphan container cleanup** (`proxy.ts`): all running containers labelled
   `leetscuda-judge=1` are stopped (`docker stop --time 1`).

6. **Stuck submission recovery**: `POST /api/judge/recover` is called once.
   The web app marks any submissions left in `RUNNING` state as `RUNTIME_ERROR`.
   This handles the previous-crash case where the judge died mid-job without
   posting a result.

7. **CUDA capability verification** (if declared): `nvidia-smi --query-gpu=compute_cap`
   is run and the reported SM version is logged alongside the declared capability
   for operator verification.

---

## 10. Submission limits

Two guards are applied at the judge level (independent of the web app's limits):

| Guard | Default | Env var |
|-------|---------|---------|
| Max code size | 16 KiB | `JUDGE_MAX_CODE_BYTES` |
| Max execution timeout | 60 000 ms | `JUDGE_MAX_TIMEOUT_MS` |

The code-size guard is applied **after** the job payload is received and parsed,
before the first container is created. Oversized payloads are rejected with
`RUNTIME_ERROR` and a descriptive `errorMsg`. This secondary guard is defense-in-depth
against a web app bug or a compromised job payload bypassing the primary limit.

The timeout is clamped with `Math.min(job.timeoutMs, env.maxTimeoutMs)` — the
judge never runs a container longer than its own configured ceiling regardless
of what the job payload requests.

---

## 11. Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JUDGE_API_URL` | Yes | — | Base URL of the web app (e.g. `https://leetscuda.com`) |
| `JUDGE_API_TOKEN` | Yes | — | Bearer token, must start with `jt_` |
| `JUDGE_CAPABILITIES` | Yes | — | Comma-separated capability strings: `cpp`, `cuda:13.0:sm_120` |
| `JUDGE_MAX_TIMEOUT_MS` | No | `60000` | Hard ceiling on per-test-case execution time |
| `JUDGE_MAX_CODE_BYTES` | No | `16384` | Hard ceiling on code payload size |
| `JUDGE_HEALTH_PORT` | No | `8080` | Port for the local health check HTTP server |
| `JUDGE_GPU_DEVICE` | No | `0` | GPU device index passed to `--gpus device=<N>` |
| `DOCKER_HOST` | No | (unix socket) | Docker socket proxy address, e.g. `tcp://127.0.0.1:2375` |

---

## 12. Logging

All log lines are prefixed with `[judge]` for easy grep in mixed Docker logs.

Structured format (one JSON object per line in production; human-readable
prefix in dev):

```
[judge] {level} {event} {details}
```

Key events:

| Event | Level | Meaning |
|-------|-------|---------|
| `startup:ready` | INFO | Poll loop started |
| `startup:orphan-cleanup` | INFO | N orphaned containers stopped |
| `startup:recovery` | INFO | N stuck submissions recovered |
| `job:received` | INFO | Job payload accepted and validated |
| `job:oversized` | WARN | Code exceeded MAX_CODE_BYTES, rejected |
| `sandbox:build-start` | INFO | Build container created |
| `sandbox:build-error` | WARN | Compilation failed (exit ≠ 0) |
| `sandbox:eval-timeout` | WARN | Eval container exceeded timeout |
| `sandbox:eval-done` | INFO | Eval container exited cleanly |
| `result:submitted` | INFO | JudgeResult posted to web app |
| `result:retry` | WARN | Network error on result post, retrying |
| `result:failed` | ERROR | Could not deliver result after retry |
| `poll:backoff` | WARN | Network error, backing off |
| `auth:rejected` | ERROR | 401 received — exiting |

---

## 13. Deployment

### 13.1 CPU judge (cpp only)

```yaml
# docker-compose.yml (excerpt)
services:
  socket-proxy:
    image: ghcr.io/tecnativa/docker-socket-proxy:latest
    environment:
      CONTAINERS: 1
      POST: 1
      EXEC: 0
      IMAGES: 0
      NETWORKS: 0
      BUILD: 0
      VOLUMES: 0
      INFO: 0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "127.0.0.1:2375:2375"
    read_only: true
    tmpfs: [/run, /tmp]

  judge:
    image: leetscuda-judge-cuda-cpp
    restart: unless-stopped
    depends_on: [socket-proxy]
    network_mode: host
    read_only: true
    tmpfs:
      - /tmp:size=512m
    environment:
      DOCKER_HOST: tcp://127.0.0.1:2375
    env_file: .env
```

Pre-pull the sandbox image on the host before starting the judge:

```bash
docker pull gcc:14
```

Seccomp profiles must be present at `/etc/judge/seccomp/cpp.json` and
`/etc/judge/seccomp/cuda.json` on the host, bind-mounted read-only into the
judge container at the same path.

### 13.2 GPU judge (cpp + cuda)

Same as CPU judge plus:

1. Install NVIDIA Container Toolkit on the host.
2. Build the custom CUDA sandbox image:
   ```bash
   docker build \
     --build-arg CUDA_IMAGE=nvidia/cuda:13.0.0-devel-ubuntu22.04 \
     -t leetscuda-cuda-sandbox:13.0 \
     -f Dockerfile.cuda-sandbox .
   ```
3. Set `JUDGE_CAPABILITIES=cpp,cuda:13.0:sm_120` in `.env`.
4. Verify: `nvidia-smi` must be available and the reported compute cap must
   match the declared `sm_NNN`.

The CUDA sandbox image adds a `nobody` user at uid 65534 with a real home
directory, because glibc's TLS initialization (used by the CUDA runtime)
requires a writable home. Without this, CUDA programs crash on startup before
`main()` even runs.

### 13.3 Direct execution fallback (dev only)

If `docker ps` fails on startup, the judge falls back to running `g++`/`nvcc`
directly on the host (no container isolation). This is intentionally loud:
a `WARNING: running in DIRECT mode — no sandbox isolation` message is printed
on every job. This mode is only for local development; it must never be used
in production.

---

## 14. Threat model

**Assets to protect**: host filesystem, host network, other users' submission
code, judge API token, other containers on the Docker host.

**Adversary**: a user submitting malicious C++ or CUDA code that attempts to:

| Attack vector | Mitigation |
|--------------|-----------|
| Read host filesystem | `docker cp` injection only; no bind mounts; `--network none` |
| Write host filesystem | No host-path mounts; overlay FS changes are discarded on `docker rm` |
| Exfiltrate via network | `--network none` — no outbound connections possible |
| Escalate privileges | `--cap-drop ALL`, `--security-opt no-new-privileges:true`, `--user 65534` |
| Kernel exploit via syscall | seccomp allowlist with `SCMP_ACT_ERRNO` default |
| DoS via fork bomb | `--pids-limit 32` (eval), `128` (build) |
| DoS via memory exhaustion | `--memory 128m / 512m` hard limit |
| DoS via CPU spin | `--cpus 0.5 / 1.0` throttle + eval timeout |
| DoS via disk fill | `--tmpfs` with `size=` limits |
| DoS via infinite output | Output truncation at 64 KiB per stream |
| Persist between jobs | Containers removed with `docker rm -f` in `finally` |
| Abuse Docker socket | Socket proxy allowlist; `EXEC: 0`, `IMAGES: 0`, `NETWORKS: 0` |
| Token theft | SHA-256 hashed storage; timing-safe comparison in web app |
| GPU memory snoop | Warning logged; MIG recommended for strict isolation |

**Known limitations**:

- GPU memory is not cleared between CUDA jobs (see §7.6).
- `perf_event_open` and side-channel timing attacks are not fully mitigated at
  the hypervisor level; seccomp blocks the syscall but bare-metal machines
  with shared CPU caches remain vulnerable to cache-timing attacks.
- The eval container image itself is trusted (pre-built by the operator). A
  compromised base image (`gcc:14`, `leetscuda-cuda-sandbox:13.0`) would bypass
  all container-level defenses.
