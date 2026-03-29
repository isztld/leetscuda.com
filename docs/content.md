# Content Contribution Guide

> Last updated: 2026-03-29

Problems and theory pages are the single source of truth for all platform content. The database is a derived cache populated by the `db:sync` script — MDX files are what you edit.

## Table of Contents

- [1. Directory layout](#1-directory-layout)
- [2. Problem MDX format](#2-problem-mdx-format)
  - [2.1 Frontmatter](#21-frontmatter)
  - [2.2 Sections](#22-sections)
  - [2.3 Test case format](#23-test-case-format)
  - [2.4 K8s problems](#24-k8s-problems)
- [3. Theory page format](#3-theory-page-format)
- [4. Track definitions](#4-track-definitions)
- [5. Adding a problem](#5-adding-a-problem)
- [6. Adding a theory page](#6-adding-a-theory-page)

---

## 1. Directory layout

```
learning/
├── cuda-core/                  CUDA & GPU Programming track
│   ├── track.mdx               Track metadata + roadmap node definitions
│   ├── problems/
│   │   ├── vector-add/index.mdx
│   │   ├── matrix-multiply/index.mdx
│   │   ├── matrix-transpose/index.mdx
│   │   └── reduce-sum/index.mdx
│   └── theory/
│       ├── cuda-intro/index.mdx
│       ├── cuda-threads/index.mdx
│       ├── cuda-memory/index.mdx
│       └── cuda-streams/index.mdx
├── ml-systems/                 ML Systems & Inference track
│   ├── track.mdx
│   ├── problems/               kv-cache, batched-inference, flash-attention
│   └── theory/                 ml-inference-basics, quantization-intro
├── kubernetes-ai/              Kubernetes for AI track
│   ├── track.mdx
│   ├── problems/               deploy-inference-server, hpa-gpu, multi-node-training
│   └── theory/                 k8s-basics, gpu-operator
└── foundations/                Foundations track
    ├── track.mdx
    ├── problems/               pcie-bandwidth, roofline-model, false-sharing
    └── theory/                 memory-model, simd-basics, profiling-basics
```

---

## 2. Problem MDX format

Every problem lives at `learning/{track}/problems/{slug}/index.mdx`.

### 2.1 Frontmatter

Frontmatter is the **single source of truth** for all problem metadata. The database is populated from it by `db:sync`.

```yaml
---
slug: vector-add              # lowercase alphanumeric + hyphens; must match directory name
title: Vector Addition
difficulty: easy              # easy | medium | hard
track: cuda-core              # cuda-core | ml-systems | kubernetes-ai | foundations
tags:
  - memory
  - threads
status: published             # published | draft
xp: 100
author: community

# Execution runtime — determines which judge queue receives this problem
runtime: cuda                 # cpp | cuda | k8s
cpp_standard: "17"            # "14" | "17" | "20" | "23"

# CUDA-only fields (omit for cpp and k8s problems)
cuda_min_version: "13.0"
compute_min_cap: "sm_120"
---
```

For C++ problems omit `cuda_min_version` and `compute_min_cap`.
For K8s problems omit `cuda_min_version`, `compute_min_cap`, and `cpp_standard`.

### 2.2 Sections

A problem file has five sections separated by delimiter lines:

```
---
[YAML frontmatter]
---

[Markdown description — rendered to HTML with syntax highlighting]

---starter-code---
[C++ / CUDA / YAML starter code shown in Monaco editor]

---test-cases---
[YAML array of test case objects]

---solution---
[Reference solution — never sent to the client]

---harness---
[C++ main() that parses stdin, calls solve(), prints result to stdout]
```

**For K8s problems**, replace `---test-cases---` with `---k8s-checks---` and omit `---harness---`. See [§2.4](#24-k8s-problems).

### 2.3 Test case format

Test cases are a YAML array in the `---test-cases---` section:

```yaml
- name: basic
  input: |
    4
    1.0 2.0 3.0 4.0
    1.0 2.0 3.0 4.0
  expected: |
    2.0 4.0 6.0 8.0
```

**`input`** is fed verbatim to the compiled binary via stdin.

**`expected`** is compared against stdout using float-tolerant line-by-line matching (tolerance ±0.001).

#### Fill shorthand

For large arrays, avoid repeating values inline:

- `input`: use `fill:N:value` (e.g. `fill:256:1.0` → N copies of 1.0 on one line, each space-separated)
- `expected`: use `fill:N:value` (e.g. `fill:256:16.0` expands to 256 space-separated `16.0` values before comparison)

#### Self-verifying test cases

Harnesses that compute the CPU reference internally output `1` (pass) or `0` (fail) to stdout. Expected value is simply `1`.

```yaml
- name: correctness
  input: |
    256
  expected: "1"
```

### 2.4 K8s problems

K8s problems use `---k8s-checks---` instead of test cases:

```yaml
---k8s-checks---
multiDoc: false   # true if the submission may contain multiple YAML documents (---)
checks:
  - id: has-deployment
    description: "Must contain a Deployment resource"
    type: schema
    assert:
      kind: Deployment
      apiVersion: apps/v1

  - id: replica-count
    description: "Deployment must have 3 replicas"
    type: assertion
    path: spec.replicas
    op: eq
    value: 3

  - id: valid-schema
    description: "Manifest must pass Kubernetes schema validation"
    type: kubectl-dry-run
```

#### Check types

| Type | Description |
|---|---|
| `schema` | Verifies a resource of the specified `kind` (and optionally `apiVersion`) exists in the document |
| `assertion` | Evaluates a JSONPath-style `path` with an operator against a value |
| `kubectl-dry-run` | Runs `kubeconform -strict` with bundled schemas; no cluster required |

#### Assertion operators

| Operator | Passes when |
|---|---|
| `exists` | Path resolves to a non-null value |
| `eq` | `actual == expected` (loose equality) |
| `neq` | `actual != expected` |
| `contains` | `actual` string includes `expected` |
| `matches` | `actual` string matches regex `expected` |
| `gte` / `lte` / `gt` / `lt` | Numeric comparison |

All checks run regardless of earlier failures — the user sees a full checklist result.

---

## 3. Theory page format

Theory pages live at `learning/{track}/theory/{slug}/index.mdx` and are rendered at `/learn/{slug}`.

```yaml
---
slug: cuda-intro
title: Introduction to CUDA
track: cuda-core
type: concept             # must be "concept"
tags:
  - gpu
  - programming-model
status: published         # published | draft
author: team
---

[Markdown content with syntax highlighting]
```

Required fields: `slug`, `title`, `track`, `type` (`concept`), `status`.

The `slug` must match an existing `CONCEPT` node defined in `learning/{track}/track.mdx`.

---

## 4. Track definitions

`learning/{track}/track.mdx` defines the track metadata and every roadmap node:

```yaml
---
slug: cuda-core
title: "CUDA & GPU Programming"
description: "Master parallel GPU programming from first principles to optimized kernels."
icon: "⚡"
color: "#7C3AED"
order: 1
nodes:
  - slug: cuda-intro
    title: "Introduction to CUDA"
    type: CONCEPT              # CONCEPT | PROBLEM
    cluster: foundations
    order: 1
    difficulty: easy
    estimatedMinutes: 30
    interviewRelevance: high   # high | medium | low
    prerequisites: []

  - slug: vector-add
    title: "Vector Addition"
    type: PROBLEM
    cluster: foundations
    order: 2
    difficulty: easy
    estimatedMinutes: 20
    interviewRelevance: medium
    prerequisites: [cuda-intro]
---
```

Nodes are synced to the database by `pnpm --filter @leetscuda/web db:seed`.

---

## 5. Adding a problem

1. Create `learning/{track}/problems/{slug}/index.mdx` following the frontmatter schema
2. Write the description, starter code, test cases (or k8s-checks), solution, and harness sections
3. Run `db:sync` to validate and load into the local DB:

   ```bash
   pnpm --filter @leetscuda/web db:sync
   ```

4. Open the problem locally at `http://localhost:3000/problems/{slug}` and test it end-to-end with a running judge
5. Open a PR — CI validates frontmatter on merge
6. On merge to main, GitHub Actions automatically syncs the problem to the production DB

---

## 6. Adding a theory page

1. Ensure the `slug` has a matching `CONCEPT` node in `learning/{track}/track.mdx` (add it if not)
2. Create `learning/{track}/theory/{slug}/index.mdx` with the correct frontmatter
3. Validate:

   ```bash
   pnpm --filter @leetscuda/web theory:sync
   ```

4. On merge to main, the page is immediately available at `/learn/{slug}`
