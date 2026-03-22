# leetscuda.com — Learning Content

This directory contains all problems, theory articles, and track definitions
for [leetscuda.com](https://www.leetscuda.com) — the interview prep platform
for AI infrastructure engineers.

Everything here is MIT licensed. Contributions are welcome and credited.

## Directory structure

```
learning/
  {track}/
    track.mdx              # Track metadata and roadmap node definitions
    problems/
      {slug}/
        index.mdx          # Problem description, starter code, test cases
    theory/
      {slug}/
        index.mdx          # Theory concept article
    articles/
      {slug}/
        index.mdx          # Long-form article (type: article in frontmatter)
```

## Tracks

| Track | Slug | Description |
|-------|------|-------------|
| CUDA Core | `cuda-core` | Thread hierarchy, memory, warps, profiling |
| CUDA HPC | `cuda-hpc` | Tensor Cores, GEMM, CUTLASS, linear algebra |
| GPU LLM | `gpu-llm` | Attention, KV cache, kernel fusion, Hopper |
| ML Systems | `ml-systems` | Inference, quantization, serving |
| Kubernetes for AI | `kubernetes-ai` | GPU scheduling, operators, inference serving |
| Foundations | `foundations` | Memory model, SIMD, profiling basics |

## Contributing a problem

1. Fork this repository
2. Create `learning/{track}/problems/{slug}/index.mdx`
3. Follow the frontmatter schema below
4. Write description, starter code, test cases, solution, and editorial
5. Open a pull request — CI validates your frontmatter automatically
6. On merge, your problem goes live within minutes

### Problem frontmatter schema

```yaml
---
slug: your-problem-slug        # must match directory name
title: Your Problem Title
track: cuda-core               # cuda-core | cuda-hpc | gpu-llm | ml-systems | kubernetes-ai | foundations
difficulty: easy               # easy | medium | hard
xp: 100
runtime: cpp                   # cpp | cuda | k8s
cpp_standard: "17"             # "14" | "17" | "20" | "23"
cuda_min_version: "11.0"       # minimum CUDA toolkit version required (only for runtime: cuda)
compute_min_cap: "sm_60"       # minimum compute capability required (only for runtime: cuda)
k8s_multi_doc: false           # only for runtime: k8s
tags:
  - tag1
  - tag2
status: published              # draft | published
author: your-github-username
---
```

### CUDA problems — minimum requirements

`cuda_min_version` is the oldest CUDA toolkit that can compile and run the problem. `compute_min_cap` is the oldest GPU SM architecture that can execute it. A judge with a higher version/SM than these minimums can serve the problem. The `-arch=` flag passed to `nvcc` is always the judge's own declared SM, not the problem's minimum.

| `cuda_min_version` | Meaning |
|--------------------|---------|
| `"11.0"` | Basic CUDA — runs on any modern GPU |
| `"12.0"` | Requires Ampere-era features (e.g. WMMA API improvements) |
| `"12.3"` | Requires Hopper TMA / WGMMA |
| `"13.0"` | Requires Blackwell-specific features |

| `compute_min_cap` | SM architecture | Notable features |
|-------------------|-----------------|------------------|
| `"sm_60"` | Pascal | Safe baseline for all basic CUDA |
| `"sm_70"` | Volta | Tensor Cores (WMMA API) |
| `"sm_80"` | Ampere | BF16, async copies, improved tensor cores |
| `"sm_90"` | Hopper | TMA, WGMMA, FP8 |
| `"sm_100"` | Blackwell | NVLink 5, FP4, transformer engine |
| `"sm_120"` | Blackwell B200/B100 | Full Blackwell feature set |

### Problem body sections

```
# Problem title

Problem description in MDX. Supports math, code blocks, diagrams.

---starter-code---
// Starter code shown to the user in the editor
---end---

---test-cases---
- input: "..."
  expected: "..."
---end---

---solution---
// Reference solution — never shown to users
---end---

---editorial---
## Approach
Explain the optimal approach here.

## Complexity
- Time: O(n)
- Space: O(1)
---end---
```

### K8s problems use `---k8s-checks---` instead of `---test-cases---`

```yaml
---k8s-checks---
- id: check-id
  description: "Human readable description"
  type: schema        # schema | assertion | kubectl-dry-run
  assert:
    kind: Deployment
    apiVersion: apps/v1
---end---
```

## Contributing a theory article

1. Create `learning/{track}/theory/{slug}/index.mdx` (or `articles/{slug}/index.mdx` for long-form pieces)
2. The slug must match a CONCEPT (or ARTICLE) node defined in `learning/{track}/track.mdx`
3. Use standard MDX — headings, paragraphs, code blocks, math
4. Open a pull request

### Theory frontmatter schema

```yaml
---
slug: your-theory-slug
title: Your Article Title
track: cuda-core               # must match one of the track slugs above
type: concept                  # concept | article
tags:
  - tag1
status: published              # draft | published
author: your-github-username
---
```

### Theory article content format

The site's post-processor transforms two special sections into rich visual
components. These sections must use the exact formats below or they render
as plain prose.

#### `## Common misconceptions`

Each misconception is a ❌ / ✓ pair separated by a blank line. Pairs are also
separated by a blank line. No H3 headings or horizontal rules inside this section.

```markdown
## Common misconceptions

❌ **Wrong**: "The wrong belief stated here, ideally in quotes"

✓ **Correct**: The correct explanation. Can span multiple sentences.
Can also include a list:
- item one
- item two

❌ **Wrong**: "Second wrong belief"

✓ **Correct**: Second correction.
```

Rules:
- `❌` and `✓` are outside the bold markers: `❌ **Wrong**:` not `**❌ Wrong:**`
- Label words are exactly `Wrong` and `Correct` (capital first letter)
- Colon is outside the bold: `**Wrong**:` not `**Wrong:**`
- One blank line between the `❌` line and the `✓` line
- One blank line between each pair
- No `###` headings or `---` rules inside this section

#### `## Interview patterns`

Each entry is a `**Question**:` / `**Answer**:` pair separated by a blank line.
No H3 headings or numbered lists.

```markdown
## Interview patterns

**Question**: "Question text in quotes"

**Answer**: Answer text on the same line as the label. Multiple sentences are fine.

**Question**: "Question whose answer needs a list or code block"

**Answer**:
1. First step
2. Second step
3. Third step

**Question**: "Another question"

**Answer**: Short inline answer.
```

Rules:
- Label is exactly `**Question**:` — no number (`**Question 1**:` → `**Question**:`)
- Label is exactly `**Answer**:` — not `**Expected answer**:` or `**Answer framework**:`
- If the answer is a single sentence, put it on the same line as `**Answer**:` (renders as a collapsible block)
- If the answer is a list or code block, put `**Answer**:` on its own line and the content below (renders as a visible answer label)
- No `###` headings per question; no numbered markdown lists (`1. **"Question"**`)

## Content standards

- Problems must have real test cases with correct expected outputs
- CUDA problems must compile cleanly with `nvcc -arch=` matching the problem's `compute_min_cap`
- The `dry-run` check validates your manifest against the official Kubernetes
  JSON schemas using `kubeconform` in strict offline mode. No cluster required.
- Theory content must be technically accurate — cite sources
- Write as a practitioner, not a textbook author
- No AI-generated filler

## Attribution

Theory content in the `cuda-core` and `cuda-hpc` tracks is partially adapted
from the [Modal GPU Glossary](https://github.com/modal-labs/gpu-glossary) under
MIT license.

## License

MIT — see [LICENSE](../LICENSE) at the repo root.
