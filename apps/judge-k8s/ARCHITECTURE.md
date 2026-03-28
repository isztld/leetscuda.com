# judge-k8s — Architecture

> Version: 0.1.0 (design, pre-implementation)
> Runtime handled: `k8s` (Kubernetes manifest validation)
> Replaces: `apps/judge` (k8s path only)

---

## Table of Contents

- [1. Purpose and scope](#1-purpose-and-scope)
- [2. Design principles](#2-design-principles)
- [3. Source layout](#3-source-layout)
- [4. REST API contract](#4-rest-api-contract)
- [5. Job lifecycle](#5-job-lifecycle)
- [6. Validation pipeline](#6-validation-pipeline)
  - [6.1 Step 1 — YAML parse](#61-step-1--yaml-parse)
  - [6.2 Step 2 — Schema checks (kind/apiVersion presence)](#62-step-2--schema-checks-kindapiversion-presence)
  - [6.3 Step 3 — Assertion checks (JSONPath + operator)](#63-step-3--assertion-checks-jsonpath--operator)
  - [6.4 Step 4 — kubeconform schema validation](#64-step-4--kubeconform-schema-validation)
  - [6.5 Check execution order and short-circuit](#65-check-execution-order-and-short-circuit)
- [7. JSONPath resolver](#7-jsonpath-resolver)
- [8. Assertion operators](#8-assertion-operators)
- [9. Timeout enforcement](#9-timeout-enforcement)
- [10. No Docker socket required](#10-no-docker-socket-required)
- [11. Startup hardening](#11-startup-hardening)
- [12. Submission limits](#12-submission-limits)
- [13. Environment variables](#13-environment-variables)
- [14. Logging](#14-logging)
- [15. Deployment](#15-deployment)
- [16. Threat model](#16-threat-model)

---

## 1. Purpose and scope

`judge-k8s` is a standalone Node.js worker that validates Kubernetes manifest
YAML submissions against a set of checks defined in MDX problem files. It
polls the web app for jobs, runs validation entirely in process (no Docker, no
external cluster), and posts results back via REST.

It handles **only** the `k8s` runtime. C++ and CUDA execution is handled by
`judge-cuda-cpp` (a completely separate process that requires Docker and
optionally GPU hardware).

A `judge-k8s` node requires no Docker socket, no GPU, and no cluster
connectivity. It can run on the cheapest available compute — a single shared
CPU core with 256 MiB RAM is sufficient.

---

## 2. Design principles

- **Pull-based polling**: identical to `judge-cuda-cpp`. The judge initiates
  all outbound HTTPS requests; no inbound port is required.

- **Stateless worker**: no local database. All state lives in the web app's
  Postgres. Restarts are safe and fast.

- **Offline validation only**: `kubeconform` is invoked with
  `-schema-location default`, which uses its bundled CRD schemas. No network
  request to `api.k8s.io`, no cluster API server, no `kubectl` binary
  required. The judge can run fully air-gapped.

- **Pure in-process logic for most checks**: `schema` and `assertion` checks
  are implemented as pure TypeScript functions against the parsed YAML
  document. They are fast, deterministic, and have no external process
  overhead.

- **Minimal attack surface**: no Docker socket, no compiler, no GPU driver.
  The judge process itself is the execution boundary. The only external process
  it spawns is `kubeconform` (a statically compiled Go binary) for schema
  validation checks.

- **Defense in depth**: bearer token auth → SHA-256 hashed storage →
  timing-safe comparison → YAML parse size limit → kubeconform timeout →
  code payload size cap.

---

## 3. Source layout

```
apps/judge-k8s/
├── ARCHITECTURE.md
├── src/
│   ├── main.ts              entry point — poll loop, startup checks, signal handling
│   ├── env.ts               zod env schema, startup validation
│   ├── types.ts             zod schemas + TypeScript types for jobs and results
│   ├── api-client.ts        pollForJob(), submitResult(), recoverStuckSubmissions()
│   └── validator/
│       ├── index.ts         validateK8sManifest() orchestrator
│       ├── parser.ts        YAML parse (single-doc and multi-doc), size guard
│       ├── schema.ts        runSchemaCheck() — kind/apiVersion presence
│       ├── assertion.ts     runAssertionCheck() — JSONPath + operator
│       ├── jsonpath.ts      resolvePath() — dot and bracket notation resolver
│       ├── kubeconform.ts   runKubeconformCheck() — offline schema validation
│       └── operators.ts     applyOp() — eq, neq, exists, contains, matches, gte, lte, gt, lt
├── Dockerfile               judge worker image (Node.js + kubeconform binary)
├── docker-compose.yml       judge service (no socket-proxy needed)
├── .env.example
└── tsconfig.json
```

---

## 4. REST API contract

Identical to `judge-cuda-cpp`. All requests carry:

```
Authorization: Bearer <JUDGE_API_TOKEN>
X-Judge-Capabilities: k8s
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

Posts a completed result. Body: `JudgeResult`.

Checks are represented in the result as test cases where:
- `input` = `checkId` (the check identifier from the MDX problem)
- `expected` = check description
- `actual` = validator message (pass message or failure detail)
- `runtimeMs` = `0` (k8s validation is essentially instantaneous)

### `POST /api/judge/recover`

Called once on startup. Asks the web app to mark any submissions left in
`RUNNING` state as `RUNTIME_ERROR`.

### `GET /api/judge/health` (local only)

Exposed by the judge on `JUDGE_HEALTH_PORT` (default `8081` to avoid
conflicting with `judge-cuda-cpp` if both run on the same host). Returns
`200 { status: "ok", capabilities: ["k8s"] }`.

---

## 5. Job lifecycle

```
web app                          judge-k8s
─────────────────────────────────────────────────────────────────────
  BLPOP judge:queue:k8s
  ─ returns job payload ──────────────────────────────►  pollForJob()
                                                          zod validate payload
                                                          secondary code-size guard
                                                          validateK8sManifest()
                                                            ├─ parseYaml()
                                                            ├─ for each check:
                                                            │    schema check
                                                            │    assertion check
                                                            │    kubeconform check
                                                            └─ assemble results[]
                                                          assemble JudgeResult
  ◄── POST /api/judge/result ─────────────────────────  submitResult()
  UPDATE Submission, award XP, updateStreak()
```

All checks for a given submission are run in the order they appear in
`k8sChecks`. A failing check does **not** short-circuit remaining checks —
all checks are evaluated so the user sees a complete checklist result
(which checks passed, which failed, and why).

The final `status` is `ACCEPTED` only if every check passes. Any failure
yields `WRONG_ANSWER`.

---

## 6. Validation pipeline

### 6.1 Step 1 — YAML parse

`parser.ts` uses `js-yaml` to parse the submission:

- **Single-doc** (`k8sMultiDoc: false`): `yaml.load()` — returns one document.
- **Multi-doc** (`k8sMultiDoc: true`): `yaml.loadAll()` — returns an array of
  documents. Empty documents (from trailing `---`) are filtered out.

If parsing throws, validation stops immediately and a single failing result is
returned:

```json
{
  "checkId": "yaml-parse",
  "description": "YAML must be valid",
  "passed": false,
  "message": "<yaml error message>"
}
```

**YAML parse size guard**: before calling `yaml.load*`, the raw manifest string
length is checked against `JUDGE_MAX_MANIFEST_BYTES` (default 128 KiB). Payloads
exceeding this limit are rejected before any parsing occurs, preventing YAML
bombs (anchors that expand exponentially).

`js-yaml` is configured with `{ schema: yaml.DEFAULT_SAFE_SCHEMA }` to
disallow YAML tags that instantiate arbitrary JavaScript objects.

### 6.2 Step 2 — Schema checks (kind/apiVersion presence)

Check type `"schema"`. Validates that a document of the expected `kind` and
optionally `apiVersion` exists anywhere in the parsed document array.

```typescript
// Check definition (from MDX k8s-checks frontmatter)
{
  id: "has-deployment",
  description: "Must contain a Deployment resource",
  type: "schema",
  assert: { kind: "Deployment", apiVersion: "apps/v1" }
}
```

Implementation: iterate over `docs`, return true if any document matches
the asserted `kind` (and `apiVersion` if specified). Comparison is strict
string equality.

### 6.3 Step 3 — Assertion checks (JSONPath + operator)

Check type `"assertion"`. Validates a specific field value within the parsed
document using a JSONPath-style path and a comparison operator.

```typescript
// Check definition
{
  id: "replica-count",
  description: "Deployment must have 3 replicas",
  type: "assertion",
  path: "spec.replicas",
  op: "eq",
  value: 3
}
```

The path is resolved against each document in order; the first document that
yields a non-`undefined` value for the path is used. If no document has the
path and the operator is not `exists`, the check fails with a
`"got: undefined"` message.

See §7 (JSONPath resolver) and §8 (assertion operators) for details.

### 6.4 Step 4 — kubeconform schema validation

Check type `"kubectl-dry-run"` (historical name; does not invoke `kubectl`).
Validates the raw YAML string against the Kubernetes JSON schema using
`kubeconform` with bundled schemas.

```typescript
// Check definition
{
  id: "valid-schema",
  description: "Manifest must pass Kubernetes schema validation",
  type: "kubectl-dry-run"
}
```

Execution:

1. Write the raw manifest YAML to a temp file under `os.tmpdir()`.
2. Run:
   ```
   kubeconform -strict -summary -output json -schema-location default <tempFile>
   ```
3. Parse the JSON output. Resources with `status: "invalid"` or `status: "error"`
   are collected; their messages are joined and returned as the failure reason.
4. Delete the temp file in a `finally` block.

The `-schema-location default` flag uses kubeconform's bundled schemas —
no network request is made. The `-strict` flag rejects unknown fields.

If `kubeconform` is not in `PATH`, the judge exits at startup (see §11).

**Temp file hygiene**: the temp file path includes the current `Date.now()`
and `process.pid` to avoid collisions between concurrent jobs. The file is
written with mode `0600` so only the judge process can read it.

### 6.5 Check execution order and short-circuit

Checks are executed **sequentially** in the order they appear in `k8sChecks`.
All checks are always evaluated — no early exit on failure — because the UX
goal is to show the user a full checklist of what passed and what failed, not
just the first failure.

The only exception is a YAML parse failure (§6.1), which returns a single
synthetic result without running any checks, because there is no parsed
document to check against.

---

## 7. JSONPath resolver

`validator/jsonpath.ts` implements a custom tokenizer rather than using a
full JSONPath library, because only a subset of JSONPath is needed and
dependency minimalism is a goal.

Supported syntax:

| Syntax | Example | Meaning |
|--------|---------|---------|
| Dot notation | `spec.replicas` | Nested object key access |
| Array index | `spec.containers[0].image` | Zero-based integer index |
| Bracket key | `resources.limits[nvidia.com/gpu]` | Key containing dots or slashes |
| Mixed | `metadata.labels[app.kubernetes.io/name]` | Dot + bracket mixed |

**Not supported** (not needed by current problem set):

- Wildcard (`*`)
- Recursive descent (`..`)
- Filter expressions (`[?(...)]`)
- Union (`[a,b]`)

If an unsupported path segment is encountered, `resolvePath` returns
`undefined` (treated as not found).

The resolver is pure (no I/O, no mutation) and is separately unit-tested.

---

## 8. Assertion operators

`validator/operators.ts` implements `applyOp(op, actual, expected)`:

| Operator | Passes when |
|----------|------------|
| `exists` | `actual !== null && actual !== undefined` |
| `eq` | `actual == expected` (loose equality — allows `"1" == 1`) |
| `neq` | `actual != expected` |
| `contains` | `typeof actual === "string" && actual.includes(expected)` |
| `matches` | `typeof actual === "string" && new RegExp(expected).test(actual)` |
| `gte` | `Number(actual) >= Number(expected)` |
| `lte` | `Number(actual) <= Number(expected)` |
| `gt` | `Number(actual) > Number(expected)` |
| `lt` | `Number(actual) < Number(expected)` |

Unknown operators always return `false`.

**Security note on `matches`**: the `expected` value comes from the MDX
problem file authored by admins, not from user input. A malicious regex
(ReDoS) can only be introduced by a problem author, not by a user submitting
a solution. Nevertheless, kubeconform checks are preferred over `matches`
checks where possible to avoid regex-complexity issues.

---

## 9. Timeout enforcement

Kubeconform checks are the only async operation with meaningful wall-clock
cost. `execFileAsync('kubeconform', ...)` is called with a `timeout` option
equal to `min(job.timeoutMs, JUDGE_MAX_TIMEOUT_MS)`.

If kubeconform times out, `execFileAsync` throws with an `ETIMEDOUT` error,
which is caught and returned as a failed check with message
`"Schema validation timed out"`.

YAML parse and in-process assertion checks are synchronous and complete in
microseconds regardless of manifest size (up to the size limit in §6.1).

---

## 10. No Docker socket required

`judge-k8s` does **not** mount or access `/var/run/docker.sock`. It does not
spawn Docker containers. The only external process it spawns is `kubeconform`.

This means:
- No `socket-proxy` sidecar is needed in the deployment.
- The judge container can run with a fully `read_only: true` filesystem (only
  `os.tmpdir()` needs to be writable, covered by a `tmpfs` mount).
- The judge process can run as a non-root user with no special Linux
  capabilities.
- The judge is suitable for deployment in environments where Docker is not
  available (e.g. Kubernetes pods, serverless containers, bare VM with just
  Node.js installed).

---

## 11. Startup hardening

Before the poll loop begins, `main.ts` runs:

1. **Env validation** (`env.ts`): zod parses `process.env`. Any missing or
   malformed env var throws immediately with a human-readable error listing
   every failing field.

2. **Root process check**: if `process.getuid() === 0`, a warning is logged.

3. **kubeconform availability check**: `kubeconform -v` is executed. If it
   fails (binary not in PATH), the judge exits with code `1`:
   ```
   [judge-k8s] ERROR: kubeconform not found in PATH — install it before starting
   ```

4. **kubeconform offline validation smoke test**: a minimal valid ConfigMap
   manifest is written to a temp file and validated with
   `-schema-location default`. If this fails (e.g. bundled schemas are
   corrupt), the judge exits with code `1`. This confirms that bundled schemas
   are intact and no network access is attempted.

5. **Stuck submission recovery**: `POST /api/judge/recover` is called once.

---

## 12. Submission limits

| Guard | Default | Env var |
|-------|---------|---------|
| Max manifest size | 128 KiB | `JUDGE_MAX_MANIFEST_BYTES` |
| Max number of checks per job | 64 | `JUDGE_MAX_CHECKS` |
| Max kubeconform timeout | 30 000 ms | `JUDGE_MAX_TIMEOUT_MS` |

The manifest size guard fires before any YAML parsing to prevent YAML bomb
expansion attacks (deeply nested aliases that expand to gigabytes of data
during parse).

The max-checks guard fires after zod validation of the job payload. A job with
more than `JUDGE_MAX_CHECKS` checks is rejected with `RUNTIME_ERROR` and a
descriptive message.

---

## 13. Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JUDGE_API_URL` | Yes | — | Base URL of the web app |
| `JUDGE_API_TOKEN` | Yes | — | Bearer token, must start with `jt_` |
| `JUDGE_CAPABILITIES` | Yes | `k8s` | Must include `k8s`; no other values are meaningful for this judge |
| `JUDGE_MAX_TIMEOUT_MS` | No | `30000` | Hard ceiling on kubeconform execution time |
| `JUDGE_MAX_MANIFEST_BYTES` | No | `131072` | Hard ceiling on YAML manifest size before parse |
| `JUDGE_MAX_CHECKS` | No | `64` | Hard ceiling on the number of checks per job |
| `JUDGE_HEALTH_PORT` | No | `8081` | Port for the local health check HTTP server |

---

## 14. Logging

All log lines are prefixed with `[judge-k8s]` to distinguish from
`judge-cuda-cpp` if both run on the same host.

Key events:

| Event | Level | Meaning |
|-------|-------|---------|
| `startup:ready` | INFO | Poll loop started |
| `startup:recovery` | INFO | N stuck submissions recovered |
| `job:received` | INFO | Job payload accepted |
| `job:oversized` | WARN | Manifest exceeded MAX_MANIFEST_BYTES |
| `job:too-many-checks` | WARN | Checks array exceeded MAX_CHECKS |
| `validate:yaml-error` | WARN | YAML parse failed |
| `validate:check-done` | INFO | Check result (checkId, passed, message) |
| `validate:kubeconform-timeout` | WARN | kubeconform exceeded timeout |
| `result:submitted` | INFO | JudgeResult posted |
| `result:retry` | WARN | Network error, retrying |
| `result:failed` | ERROR | Could not deliver result after retry |
| `poll:backoff` | WARN | Network error during poll, backing off |
| `auth:rejected` | ERROR | 401 received — exiting |

---

## 15. Deployment

### Minimal deployment (no Docker needed)

```yaml
# docker-compose.yml
services:
  judge-k8s:
    image: leetscuda-judge-k8s
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp:size=64m
    env_file: .env
    # No docker socket mount
    # No socket-proxy sidecar
    # No GPU devices
```

`kubeconform` must be present in the image. The `Dockerfile` installs it from
the official GitHub release:

```dockerfile
ARG KUBECONFORM_VERSION=0.6.7
RUN curl -sSL https://github.com/yannh/kubeconform/releases/download/v${KUBECONFORM_VERSION}/kubeconform-linux-amd64.tar.gz \
    | tar -xzf - -C /usr/local/bin kubeconform \
    && chmod +x /usr/local/bin/kubeconform
```

The `kubeconform` binary includes bundled schemas; no additional schema files
need to be mounted.

### Running alongside judge-cuda-cpp on the same host

Both judges can run on the same machine. They use different health ports
(8080 vs 8081 by default) and different queue names (`judge:queue:cpp` /
`judge:queue:cuda` vs `judge:queue:k8s`). They share no state and have no
dependencies on each other.

---

## 16. Threat model

**Assets to protect**: judge API token, host filesystem, other submissions'
manifest content, CPU and memory resources.

**Adversary**: a user submitting a malicious YAML manifest.

| Attack vector | Mitigation |
|--------------|-----------|
| YAML bomb (anchor expansion) | Size guard before parse; `js-yaml` safe schema |
| Malicious YAML tags (JS object injection) | `yaml.DEFAULT_SAFE_SCHEMA` rejects `!!js/*` tags |
| ReDoS via `matches` operator | `matches` values come from admin-authored MDX, not user input |
| Path traversal via JSONPath | Resolver is pure in-process; no filesystem access |
| DoS via large check array | Max-checks guard (`JUDGE_MAX_CHECKS`) |
| DoS via slow kubeconform | Per-check `timeout` on `execFileAsync` |
| Temp file race (kubeconform) | Unique filename (`Date.now() + pid`); `mode=0600`; deleted in `finally` |
| Token theft | SHA-256 hashed storage; timing-safe comparison in web app |

**No Docker socket**: the absence of a Docker socket is itself the strongest
isolation guarantee for this judge. Even if the Node.js process is fully
compromised, the attacker has no path to container escape because there are no
containers to escape from.
