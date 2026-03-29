# Contributing to LeetsCUDA

Content is the core of this platform and community contributions are very welcome. Problems, theory articles, and track definitions all live in the `learning/` directory as MDX files — no backend changes needed to add content.

The full technical reference for the MDX format is in [`docs/content.md`](docs/content.md). This guide covers the contribution workflow.

## Table of Contents

- [What you can contribute](#what-you-can-contribute)
- [Getting started](#getting-started)
- [Adding a problem](#adding-a-problem)
- [Adding a theory page](#adding-a-theory-page)
- [PR checklist](#pr-checklist)
- [Content guidelines](#content-guidelines)

---

## What you can contribute

| Contribution | Where | Difficulty |
|---|---|---|
| New coding problem (C++ or CUDA) | `learning/{track}/problems/{slug}/` | Medium — needs harness + test cases |
| New Kubernetes manifest problem | `learning/kubernetes-ai/problems/{slug}/` | Easy — no harness needed |
| New theory / concept page | `learning/{track}/theory/{slug}/` | Easy — pure Markdown |
| Fix an existing problem (typos, better test cases, clearer description) | Same MDX file | Easy |
| New track or cluster | `learning/{track}/track.mdx` | Discuss in an issue first |

---

## Getting started

1. Fork the repo and clone it locally
2. Follow the [Quick start](README.md#quick-start) to get the web app running
3. Pick or create an issue for the content you want to add
4. Create a branch: `git checkout -b content/vector-dot-product`

---

## Adding a problem

### 1. Create the file

Problems live at `learning/{track}/problems/{slug}/index.mdx`. The `{slug}` must be lowercase alphanumeric with hyphens and must match the frontmatter `slug` field.

```bash
mkdir -p learning/cuda-core/problems/vector-dot-product
touch learning/cuda-core/problems/vector-dot-product/index.mdx
```

### 2. Write the frontmatter

```yaml
---
slug: vector-dot-product
title: Vector Dot Product
difficulty: easy              # easy | medium | hard
track: cuda-core              # cuda-core | ml-systems | kubernetes-ai | foundations
tags:
  - reduction
  - memory
status: draft                 # keep as draft until ready for review
xp: 100
author: your-github-username

runtime: cuda                 # cpp | cuda | k8s
cpp_standard: "17"            # "14" | "17" | "20" | "23"
cuda_min_version: "13.0"      # cuda only
compute_min_cap: "sm_120"     # cuda only
---
```

See [`docs/content.md`](docs/content.md#21-frontmatter) for all field definitions.

### 3. Write the sections

A problem file has five sections:

```
[Markdown description]

---starter-code---
// The code shown in the Monaco editor when the user opens the problem

---test-cases---
- name: basic
  input: |
    4
    1.0 2.0 3.0 4.0
    1.0 2.0 3.0 4.0
  expected: "20.0"

---solution---
// Reference solution — never sent to the client

---harness---
// C++ main() that reads stdin, calls solve(), prints result to stdout
```

The harness is appended to the user's submitted code before compilation. Users only write the kernel(s) and `solve()` — the harness handles I/O.

### 4. Sync and test locally

```bash
pnpm --filter @leetscuda/web db:sync
```

Open `http://localhost:3000/problems/vector-dot-product` and submit your own solution against a running judge to confirm test cases pass.

### 5. Set `status: published` when ready

Only do this when the problem is fully tested and ready for review.

---

## Adding a theory page

### 1. Check the track definition

The slug must appear as a `CONCEPT` node in `learning/{track}/track.mdx`. If it's not there, add it before creating the page:

```yaml
nodes:
  - slug: cuda-occupancy
    title: "Occupancy and Warp Efficiency"
    type: CONCEPT
    cluster: optimization
    order: 7
    difficulty: medium
    estimatedMinutes: 20
    interviewRelevance: high
    prerequisites: [cuda-threads]
```

Then re-seed the database:

```bash
pnpm --filter @leetscuda/web db:seed
```

### 2. Create the file

```bash
mkdir -p learning/cuda-core/theory/cuda-occupancy
touch learning/cuda-core/theory/cuda-occupancy/index.mdx
```

### 3. Write the frontmatter and content

```yaml
---
slug: cuda-occupancy
title: "Occupancy and Warp Efficiency"
track: cuda-core
type: concept
tags:
  - performance
  - warps
status: draft
author: your-github-username
---

[Markdown content here]
```

### 4. Validate

```bash
pnpm --filter @leetscuda/web theory:sync
```

This checks frontmatter and verifies every `CONCEPT` node in `track.mdx` has a corresponding theory file.

---

## PR checklist

Before submitting a PR, confirm:

- [ ] `slug` in frontmatter matches the directory name exactly
- [ ] `status: published` only if fully tested
- [ ] For problems: at least 3 test cases covering basic, edge, and large-input scenarios
- [ ] For CUDA problems: test cases use `fill:N:value` shorthand for large arrays
- [ ] `pnpm --filter @leetscuda/web db:sync` runs without errors
- [ ] For theory pages: `pnpm --filter @leetscuda/web theory:sync` runs without errors
- [ ] Submitted your own solution locally and confirmed it passes

---

## Content guidelines

**Problem descriptions** should explain the context (why this matters for AI infra), the exact function signature to implement, input/output format, and any constraints. Use code blocks for examples.

**Difficulty** — a rough guide:
- `easy` — can be solved by anyone who has read the relevant theory page; straightforward mapping of concepts to code
- `medium` — requires understanding of at least one non-obvious optimization or technique
- `hard` — requires deep knowledge, multi-step reasoning, or significant CUDA optimization

**Test cases** — should include:
1. A minimal/trivial case (n=1 or n=4)
2. A typical case
3. A stress case (large n, or an edge case specific to the algorithm)

**Theory pages** — aim for depth over breadth. Prefer concrete numbers, diagrams in ASCII or code, and worked examples over abstract descriptions. Link to problems that exercise the concept.

**Tags** — use existing tags where possible. Tags help users filter problems. Common ones: `memory`, `threads`, `reduction`, `tiling`, `atomics`, `streams`, `warp`, `shared-memory`, `coalescing`.
