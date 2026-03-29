# Judge Nodes — Deployment and Operations

> Last updated: 2026-03-29

Judge nodes are standalone Node.js workers that poll the web API for jobs, execute them, and POST results back. They have **zero** direct database or Redis access — all state transitions happen through the web API.

For implementation details of each worker see:
- [`apps/judge-cuda-cpp/ARCHITECTURE.md`](../apps/judge-cuda-cpp/ARCHITECTURE.md) — C++/CUDA worker (Docker sandbox, seccomp, two-phase build/eval)
- [`apps/judge-k8s/ARCHITECTURE.md`](../apps/judge-k8s/ARCHITECTURE.md) — K8s worker (kubeconform, in-process YAML checks)

## Table of Contents

- [1. Node types](#1-node-types)
- [2. Token management](#2-token-management)
- [3. CPU judge setup](#3-cpu-judge-setup)
- [4. GPU judge setup](#4-gpu-judge-setup)
- [5. K8s judge setup](#5-k8s-judge-setup)
- [6. Environment variables](#6-environment-variables)
- [7. Health checks](#7-health-checks)
- [8. Revoking a judge node](#8-revoking-a-judge-node)

---

## 1. Node types

| Node type | Capabilities | Queues served | Requirements |
|---|---|---|---|
| CPU judge | `cpp` | `judge:queue:cpp` | Docker socket |
| GPU judge | `cpp,cuda:13.0:sm_120` | `judge:queue:cpp`, `judge:queue:cuda` | Docker socket + NVIDIA drivers + nvidia-container-toolkit |
| K8s judge | `k8s` | `judge:queue:k8s` | kubeconform in PATH; no Docker, no GPU |

A GPU judge serves both C++ and CUDA queues. On each poll it BLPOPs from both queues and takes whichever has a job first.

### Capability strings

The `JUDGE_CAPABILITIES` env var is a comma-separated list passed to the web API on every request:

- `cpp` — C++ only (g++ / gcc:14)
- `cpp,cuda:13.0:sm_120` — C++ + CUDA 13.0 on compute capability sm_120 (Blackwell)
- `cpp,cuda:12.6:sm_86` — C++ + CUDA 12.6 on sm_86 (Ampere)
- `k8s` — Kubernetes manifest validation only

All CUDA jobs land in `judge:queue:cuda` regardless of version. At poll time the web app checks the dequeued job's `cudaMinVersion` and `computeMinCap` against the judge's declared capability; incompatible jobs are re-queued and the judge receives a 204.

---

## 2. Token management

### Generate a token

Run from the repo root (requires `DATABASE_URL` in your environment):

```bash
# CPU-only judge
pnpm --filter @leetscuda/web judge:token --name "cpu-worker-1" --capabilities "cpp"

# GPU judge (CUDA 13.0, sm_120)
pnpm --filter @leetscuda/web judge:token --name "gpu-helsinki" --capabilities "cpp,cuda:13.0:sm_120"

# K8s judge
pnpm --filter @leetscuda/web judge:token --name "k8s-validator-1" --capabilities "k8s"
```

The token is printed **once** to stdout and never retrievable again. Store it in a secret manager immediately.

Tokens follow the format `jt_` + 64 hex characters. The database stores only the SHA-256 hash — the plaintext is never persisted.

### Revoke a token

```sql
UPDATE "JudgeToken" SET "isActive" = false WHERE name = 'gpu-helsinki';
```

The judge's next poll attempt returns 401 and the process exits.

---

## 3. CPU judge setup

Handles C++ problems only. Requires Docker.

### 1. Configure

```bash
cp apps/judge-cuda-cpp/.env.example apps/judge-cuda-cpp/.env
```

```env
JUDGE_API_URL=https://leetscuda.com
JUDGE_API_TOKEN=jt_...
JUDGE_CAPABILITIES=cpp
```

### 2. Pre-pull sandbox image

```bash
docker pull gcc:14
```

### 3. Build judge image

```bash
docker build -t leetscuda-judge-cuda-cpp -f apps/judge-cuda-cpp/Dockerfile apps/judge-cuda-cpp
```

### 4. Run

```bash
# Local dev
cd apps/judge-cuda-cpp && pnpm dev

# Production (docker-compose — includes socket-proxy sidecar)
docker compose -f apps/judge-cuda-cpp/docker-compose.yml up -d
```

The compose file starts a `docker-socket-proxy` sidecar that exposes only the minimal Docker API surface required (create, start, stop, rm, wait, logs, cp). The judge process never touches `/var/run/docker.sock` directly.

---

## 4. GPU judge setup

Handles C++ and CUDA problems. Requires Docker + NVIDIA hardware.

### 1. Install NVIDIA Container Toolkit

Follow https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html for your distro.

### 2. Configure

```bash
cp apps/judge-cuda-cpp/.env.example apps/judge-cuda-cpp/.env
```

```env
JUDGE_API_URL=https://leetscuda.com
JUDGE_API_TOKEN=jt_...
JUDGE_CAPABILITIES=cpp,cuda:13.0:sm_120
```

### 3. Build the CUDA sandbox image

```bash
docker build \
  --build-arg CUDA_IMAGE=nvidia/cuda:13.0.0-devel-ubuntu24.04 \
  -t leetscuda-cuda-sandbox:13.0 \
  -f apps/judge-cuda-cpp/Dockerfile.cuda-sandbox \
  apps/judge-cuda-cpp
```

This image adds a `nobody` user at uid 65534 with a real home directory — required because glibc's TLS initialization (used by the CUDA runtime) needs a writable home.

### 4. Pre-pull images

```bash
docker pull gcc:14
docker pull nvidia/cuda:13.0.0-devel-ubuntu24.04
```

### 5. Verify NVIDIA setup

```bash
nvidia-smi
# The reported compute capability must match the sm_NNN declared in JUDGE_CAPABILITIES
```

### 6. Run

```bash
docker compose -f apps/judge-cuda-cpp/docker-compose.yml up -d
```

---

## 5. K8s judge setup

Handles Kubernetes manifest validation. Requires no Docker socket, no GPU.

### 1. Configure

```bash
cp apps/judge-k8s/.env.example apps/judge-k8s/.env
```

```env
JUDGE_API_URL=https://leetscuda.com
JUDGE_API_TOKEN=jt_...
JUDGE_CAPABILITIES=k8s
```

### 2. Build judge image

```bash
docker build -t leetscuda-judge-k8s -f apps/judge-k8s/Dockerfile apps/judge-k8s
```

The image installs `kubeconform` with bundled Kubernetes schemas — no network access or cluster required at validation time.

### 3. Run

```bash
# Local dev
cd apps/judge-k8s && pnpm dev

# Production
docker compose -f apps/judge-k8s/docker-compose.yml up -d
```

No socket-proxy sidecar is needed. The K8s judge runs with a read-only filesystem (only `/tmp` needs to be writable).

### Pre-flight check

```bash
kubectl version --client  # only if kubectl-dry-run check type is used
kubeconform -v            # must be available in PATH
```

---

## 6. Environment variables

### C++/CUDA judge (`apps/judge-cuda-cpp/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JUDGE_API_URL` | Yes | — | Base URL of the web app, e.g. `https://leetscuda.com` |
| `JUDGE_API_TOKEN` | Yes | — | Token generated by `judge:token` (starts with `jt_`) |
| `JUDGE_CAPABILITIES` | Yes | — | Comma-separated list, e.g. `cpp` or `cpp,cuda:13.0:sm_120` |
| `JUDGE_MAX_TIMEOUT_MS` | No | `60000` | Hard ceiling on per-test-case execution time |
| `JUDGE_MAX_CODE_BYTES` | No | `16384` | Hard ceiling on code payload size |
| `JUDGE_HEALTH_PORT` | No | `8080` | Port for local health check server |
| `JUDGE_GPU_DEVICE` | No | `0` | GPU device index passed to `--gpus device=<N>` |
| `DOCKER_HOST` | No | (unix socket) | Docker socket proxy address, e.g. `tcp://127.0.0.1:2375` |

### K8s judge (`apps/judge-k8s/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JUDGE_API_URL` | Yes | — | Base URL of the web app, e.g. `https://leetscuda.com` |
| `JUDGE_API_TOKEN` | Yes | — | Token generated by `judge:token` (starts with `jt_`) |
| `JUDGE_CAPABILITIES` | Yes | `k8s` | Must include `k8s` |
| `JUDGE_MAX_TIMEOUT_MS` | No | `30000` | Hard ceiling on kubeconform execution time |
| `JUDGE_MAX_MANIFEST_BYTES` | No | `131072` | Hard ceiling on YAML manifest size before parse |
| `JUDGE_MAX_CHECKS` | No | `64` | Hard ceiling on checks per job |
| `JUDGE_HEALTH_PORT` | No | `8081` | Port for local health check server |

---

## 7. Health checks

Each judge exposes a local health endpoint:

```
GET http://localhost:{JUDGE_HEALTH_PORT}/health
```

Returns `200 { status: "ok", capabilities: [...] }` when the poll loop is running, `503` otherwise.

Default ports: **8080** for `judge-cuda-cpp`, **8081** for `judge-k8s` (to avoid conflicts when both run on the same host).

---

## 8. Revoking a judge node

Immediately disable a judge by setting `isActive = false` on its token:

```sql
UPDATE "JudgeToken" SET "isActive" = false WHERE name = 'gpu-1';
```

Or via Prisma Studio:

```bash
pnpm --filter @leetscuda/web db:studio
```

The judge's next poll attempt returns 401 and the process exits immediately. In-flight jobs finish before the exit (the 401 is only seen during polling, not mid-job).
