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
        index.mdx          # Theory article content
```

## Tracks

| Track | Slug | Description |
|-------|------|-------------|
| CUDA & GPU Programming | `cuda` | Memory model, kernels, optimization |
| ML Systems & Inference | `ml-systems` | KV cache, attention, quantization |
| Kubernetes for AI | `kubernetes-ai` | GPU scheduling, inference serving |
| Foundations | `foundations` | C++, DSA, systems fundamentals |

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
track: cuda                    # cuda | ml-systems | kubernetes-ai | foundations
difficulty: easy               # easy | medium | hard
xp: 100
runtime: cpp                   # cpp | cuda | k8s
cpp_standard: "17"             # "14" | "17" | "20" | "23"
cuda_version: "12.6"           # only for runtime: cuda
compute_cap: "sm_120"          # only for runtime: cuda
k8s_multi_doc: false           # only for runtime: k8s
tags:
  - tag1
  - tag2
status: published              # draft | published
author: your-github-username
---
```

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

1. Create `learning/{track}/theory/{slug}/index.mdx`
2. The slug must match a CONCEPT node defined in `learning/{track}/track.mdx`
3. Use standard MDX — headings, paragraphs, code blocks, math
4. Open a pull request

### Theory frontmatter schema

```yaml
---
slug: your-theory-slug
title: Your Article Title
track: cuda
type: concept
tags:
  - tag1
status: published
author: your-github-username
---
```

## Contributing a track node

To add a new node to the roadmap, edit `learning/{track}/track.mdx` and add
your node to the nodes list. Then create the corresponding content file.

## Content standards

- Problems must have real test cases with correct expected outputs
- CUDA problems must compile cleanly with `nvcc -arch=sm_86`
- The `dry-run` check validates your manifest against the official Kubernetes
  JSON schemas using `kubeconform` in strict offline mode. No cluster required.
- Theory content must be technically accurate — cite sources
- Write as a practitioner, not a textbook author
- No AI-generated filler

## Attribution

Theory content in the `cuda/` track is partially adapted from the
[Modal GPU Glossary](https://github.com/modal-labs/gpu-glossary) under MIT license.

## License

MIT — see [LICENSE](../LICENSE) at the repo root.
