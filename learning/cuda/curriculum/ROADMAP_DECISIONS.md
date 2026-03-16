# CUDA Roadmap Architecture Decisions

Generated: 2026-03-16

---

## Node count rationale

**42 nodes** were chosen (within the 35–45 target).

- 39 curriculum topics across 7 clusters, minus 4 merged topics and 1 dropped topic, equals 34 topic-level nodes.
- 8 additional PROBLEM nodes were added for exercises significant enough to stand alone as roadmap waypoints: `grid-stride-saxpy`, `streams-overlap`, `cublas-integration`, `tensor-core-gemm`, `profile-and-optimize`, `layer-norm-kernel`, `quantization-exercise`, `flash-attention-impl`.
- The `flash-attention-impl` node alone justifies multiple supporting PROBLEM nodes (fused-softmax, gemm-optimization) that are otherwise standalone learning goals.
- Fewer than 35 nodes would have left profiling and distributed-systems topics without any representation. More than 45 would have required giving thin sub-topics their own nodes.

---

## Cluster ordering rationale

Clusters are ordered to minimize forward-dependency violations in the learner's path:

1. **Foundations** — hardware model and execution model; prerequisite to everything
2. **Memory** — coalescing and shared memory; prerequisite to all algorithms and linear algebra
3. **Execution** — divergence, occupancy, streams; requires memory knowledge to reason about occupancy
4. **Algorithms** — reduction, scan, histogram; requires shared memory (cluster 2) and divergence (cluster 3)
5. **Linear Algebra** — GEMM optimization; requires algorithmic thinking (cluster 4) and shared memory (cluster 2)
6. **Profiling** — roofline and Nsight; most useful after seeing concrete kernels from clusters 2–5
7. **LLM Kernels** — synthesis cluster; requires all prior clusters per its JSON prerequisites

---

## Dropped topics and why

| Topic ID | Cluster | Reason |
|----------|---------|--------|
| `dynamic-parallelism` | execution | `roadmapNodeSlug: null` in source JSON; no exercise planned; ~500-cycle launch overhead per child kernel makes it a niche technique rarely encountered in ML workloads; deferred to Phase E |

---

## Merged topics and why

| Merged Topic | Into Node | Reason |
|-------------|-----------|--------|
| `sm-architecture` | `gpu-architecture` | Both topics mapped to `cuda-intro` in the source JSON; SM internals (CUDA Cores, Tensor Cores, warp scheduler) are part of the same conceptual node as GPU architecture overview; splitting would create a 20-minute theory stub with no exercise |
| `l1-l2-cache` | `global-memory` | `l1-l2-cache` has one concept and zero exercises; cache behavior is best taught in context of global memory access patterns, not as a standalone node; capacity numbers cited inline in `global-memory` content |
| `tiled-gemm` | `gemm-fundamentals` | The tiling hierarchy theory (block → warp → thread tile) is inseparable from GEMM fundamentals; the exercise (custom-sgemm) becomes the `gemm-optimization` PROBLEM node; splitting tiled-gemm theory from gemm-fundamentals would create an artificial CONCEPT node with no clear exercise |
| `nsight-systems-concurrency` | `nsight-compute` | Nsight Systems and Nsight Compute are complementary tools covered in the same profiling workflow; separating them into two CONCEPT nodes would obscure their relationship; both are covered in the `nsight-compute` node content |

---

## Prerequisites philosophy

**Minimal, intentional cross-cluster edges.** A node's prerequisites are restricted to the smallest set that makes the node's content learnable without prior knowledge of unlisted nodes. Specifically:

- Within a cluster, prerequisites reflect strict dependency (e.g., `shared-memory` before `register-pressure` — you need to understand SRAM to reason about occupancy tradeoffs).
- Cross-cluster prerequisites are limited to direct dependencies (e.g., `reduce-sum` requires `warp-divergence` because the optimization journey explicitly fixes divergence in step 2).
- Transitive closure is not encoded: if `prefix-scan` requires `reduce-sum` and `reduce-sum` requires `shared-memory`, `prefix-scan` does NOT also list `shared-memory` as a direct prerequisite. This keeps the graph readable.
- Every PROBLEM node lists at least one CONCEPT node as a direct prerequisite, ensuring learners encounter theory before implementation.

**Cluster entry rule.** The first node of every cluster lists only foundations-cluster nodes as prerequisites. This allows a learner to preview any cluster's entry point after completing only cluster 1. Deeper nodes within a cluster accumulate the proper cross-cluster prerequisites.

---

## Bridge nodes

`attention` (order 33, first llm-kernels node) serves as a bridge from thread-hierarchy (foundations) to the full LLM kernels cluster. It is a CONCEPT node with only a foundations prerequisite, so the cluster is technically enterable after foundations only — the harder implementations (`flash-attention-impl`, `fused-softmax`) carry the proper algorithmic prerequisites.

`roofline-model` (order 29, first profiling node) bridges from thread-hierarchy to profiling. The roofline model can be understood conceptually with only basic GPU knowledge; applying it to real kernels is deferred to `bottleneck-analysis` and `profile-and-optimize` which carry the deeper prerequisites.

`gemm-fundamentals` (order 23, first linear-algebra node) bridges from thread-hierarchy to the full linear algebra cluster. The arithmetic intensity analysis requires only knowing what a thread does; the tiled-GEMM optimization exercise (`gemm-optimization`) carries the memory cluster prerequisites.

---

## Deferred to future phases

| Topic | Reason |
|-------|--------|
| Dynamic parallelism | Niche use case; ~500-cycle device-side launch overhead limits applicability; no exercise planned |
| CUDA Graphs | Reduces kernel launch overhead for fixed-topology workloads; production-relevant but requires completed profiling cluster as foundation; Phase E |
| Thread Block Clusters (Hopper) | Requires cc9.0+; complex distributed shared memory semantics; covered conceptually in `hopper-tma-wgmma` ARTICLE but no exercise; Phase E |
| Async barriers (__mbarrier) | Ampere/Hopper pipelining primitive; foundational for custom Hopper kernels; requires `cooperative-groups` and `cuda-streams` as base; Phase E |
| FP8 layout conformance (FA3 §3.3) | Requires understanding WGMMA k-major constraints and in-kernel LDSM/STSM transpose; covered in `hopper-tma-wgmma` ARTICLE; expert-level exercise deferred |
| ZeRO-Infinity (NVMe offload) | Requires multi-GPU + NVMe hardware setup; beyond single-GPU curriculum scope |
| Pipeline parallelism (GPipe/PipeDream) | Better covered in a multi-GPU systems track; ZeRO paper references it as complementary to tensor parallelism |
| Speculative decoding | Algorithmic; requires understanding KV cache deeply; cuda-mode-lectures lecture_022 is the source; Phase E |
| Mamba / SSM kernels | Growing importance; not in current resource set |
| Inline PTX | `inlinePTX` CUDA sample exists; low ROI for most practitioners; Phase E if requested |
| NVRTC runtime compilation | Niche; useful for JIT kernel generation; no exercise planned |

---

## Type assignments

- **CONCEPT**: Topics whose primary value is understanding a model or mechanism (GPU architecture, divergence, occupancy, attention theory, ZeRO).
- **PROBLEM**: Topics whose primary value is hands-on implementation (vector-add through flash-attention-impl); each has a concrete CUDA exercise.
- **ARTICLE**: Deep reference material best consumed by reading real source code rather than writing an exercise (`cutlass`, `hopper-tma-wgmma`). These are the only two ARTICLE nodes in v1.

---

## interviewRelevance migration note

`interviewRelevance` (and `cluster`, `difficulty`, `estimatedMinutes`) were added to the `RoadmapNode` Prisma model as nullable String/Int fields. Run the following before seeding:

```bash
pnpm --filter @leetscuda/web db:migrate
```

The migration adds four columns to the `RoadmapNode` table with no NOT NULL constraints, so existing rows are unaffected.
