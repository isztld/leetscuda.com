# CUDA Curriculum Gap Analysis

Generated: 2026-03-16
Comparing planned curriculum roadmap nodes vs. existing `learning/cuda/track.mdx` nodes.

---

## 1. Nodes to Keep (exist in track.mdx AND covered by curriculum)

| Existing Slug | Existing Title | Covered By Cluster | Coverage Assessment |
|---------------|----------------|-------------------|---------------------|
| `cuda-intro` | Introduction to CUDA | foundations | Full coverage — GPU architecture, SM internals, compute capability, CUDA programming model |
| `cuda-threads` | Threads, Blocks & Grids | foundations | Full coverage — grid/block/thread hierarchy, warp concept, SIMT model |
| `cuda-memory` | Memory Hierarchy | memory | Full coverage — global, shared, L1/L2, registers, unified memory |
| `vector-add` | Vector Addition | foundations | Full coverage — exercises `hello-cuda` and `vector-add` directly target this |
| `matrix-multiply` | Tiled Matrix Multiplication | memory + linear-algebra | Full coverage — `tiled-matrix-multiply` exercise in memory cluster; `custom-sgemm` and `wmma-hgemm` in linear-algebra |
| `matrix-transpose` | Matrix Transpose | memory | Full coverage — `matrix-transpose` exercise explicitly planned in cluster-memory |
| `reduce-sum` | Parallel Reduction Sum | algorithms | Full coverage — `reduce-sum` exercise in algorithms cluster with 6-step optimization journey |
| `cuda-streams` | CUDA Streams & Async Transfers | execution | Full coverage — streams-concurrency topic + `streams-overlap` exercise |

**All 8 existing nodes are retained and have strong curriculum coverage.**

---

## 2. Nodes to Update (exist but curriculum suggests improved content)

| Slug | Current State | Suggested Improvement | Priority |
|------|---------------|----------------------|----------|
| `cuda-intro` | Generic GPU intro | Add explicit coverage of warp scheduler, SIMT model, compute capability progression (Volta→Blackwell). Current description mentions "SM architecture" but doesn't cover warp-level execution which is critical for understanding performance. | High |
| `cuda-memory` | "global, shared, constant, and register memory" | Expand to include: bank conflict analysis, Ampere async copy (cp.async), L2 residency controls, register pressure / occupancy tradeoffs, and unified memory prefetch patterns. Constant memory is listed but rarely used in modern ML; re-prioritize. | Medium |
| `cuda-threads` | "1-D and 2-D layouts" | Add grid-stride loop pattern as canonical scalable kernel pattern; add warp-synchronous programming concepts; add explicit thread → warp → SM mapping. | Medium |
| `cuda-streams` | "overlap kernel execution with H2D/D2H" | Expand to include: CUDA Events for timing, multi-stream pipelines, stream ordering guarantees vs. default stream. Add explicit mention of HyperQ and practical overlap patterns. | Low |

---

## 3. Nodes to Add (new nodes introduced by curriculum)

These nodes are planned in the curriculum but do not exist in `track.mdx`. They represent Phase C/D new content.

### Cluster: Foundations (2 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `sm-architecture` | SM Internal Architecture | CONCEPT | High | CUDA Cores vs Tensor Cores, warp scheduler, register file — foundational for all performance reasoning |
| `compute-capability` | Compute Capability & Architecture Generations | CONCEPT | Medium | Volta→Blackwell progression; essential context for feature targeting |

### Cluster: Memory (3 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `memory-coalescing` | Memory Coalescing | CONCEPT | High | Core performance concept; standalone theory node needed before matrix exercises |
| `register-pressure` | Register Pressure & Occupancy | CONCEPT | High | Critical for understanding SM resource limits; frequently misunderstood |
| `unified-memory-exercise` | Unified Memory with Prefetching | PROBLEM | Medium | Practical UM workflow; cudaMemPrefetchAsync pattern |

### Cluster: Execution (2 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `warp-divergence` | Warp Divergence & Branch Efficiency | CONCEPT | High | Fundamental execution model concept; required before profiling |
| `occupancy-exercise` | Occupancy Optimization | PROBLEM | Medium | Hands-on: vary block size / shared memory to maximize occupancy |

### Cluster: Algorithms (3 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `parallel-scan` | Exclusive Prefix Scan | PROBLEM | High | Classic GPU algorithm; Blelloch scan is a canonical parallel programming exercise |
| `histogram-exercise` | Privatized Histogram | PROBLEM | Medium | Atomic operations, privatization pattern |
| `parallel-patterns` | Map, Scatter, Gather | CONCEPT | Low | Foundational vocabulary for algorithm design |

### Cluster: Linear Algebra (3 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `gemm-optimization` | Custom SGEMM Optimization | PROBLEM | High | Full GEMM optimization journey from naïve to register-blocked |
| `tensor-core-gemm` | WMMA Tensor Core GEMM | PROBLEM | High | Essential for understanding LLM kernel performance |
| `cublas-integration` | cuBLAS GEMM Integration | PROBLEM | Medium | Practical library usage; row-major trick, handle lifecycle |

### Cluster: Profiling (2 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `roofline-model` | Roofline Model | CONCEPT | High | Most important framework for GPU performance analysis |
| `nsight-profiling` | Nsight Compute Profiling Workflow | PROBLEM | High | Guided profiling exercise: identify bottleneck, fix, re-profile |

### Cluster: LLM Kernels (6 new nodes)
| Proposed Slug | Title | Type | Priority | Justification |
|--------------|-------|------|----------|---------------|
| `fused-softmax` | Fused Online Softmax | PROBLEM | High | Critical for understanding FlashAttention prerequisites |
| `layer-norm-kernel` | LayerNorm + Residual Fusion | PROBLEM | High | Canonical fusion exercise; Welford's algorithm |
| `flash-attention-impl` | FlashAttention Forward (From Scratch) | PROBLEM | High | The hardest and most important exercise in the curriculum |
| `kv-cache-design` | KV Cache Design | CONCEPT | High | Production LLM inference concept; GQA/MQA tradeoffs |
| `quantization-exercise` | INT8 Quantize/Dequantize Kernel | PROBLEM | Medium | Quantization mechanics; per-channel scales |
| `kernel-fusion` | Kernel Fusion | CONCEPT | High | Highest-ROI optimization technique in LLM inference |

**Total new nodes: 21**

---

## 4. Nodes to Deprecate (exist but curriculum finds redundant or misplaced)

None of the current 8 nodes are deprecated. All are foundational and curriculum expands on them.

However, **re-ordering** is suggested:

- `vector-add` (order 4) should remain at order 4 but add `grid-stride-saxpy` as a follow-up problem at order 4.5
- `reduce-sum` (order 7) should be expanded into a progression: `reduce-sum-naive` → `reduce-sum-shfl` → `reduce-sum-coarsened`

---

## 5. Topics Without Exercises (Theory Only)

The following curriculum topics have concepts but no exercises planned. These represent theory-only content:

| Cluster | Topic | Reason No Exercise |
|---------|-------|-------------------|
| foundations | GPU vs CPU comparison | Conceptual; no coding exercise appropriate |
| foundations | SM Internal Architecture | Too low-level for standalone exercise; embedded in other exercises |
| foundations | Architecture Progression (Volta→Blackwell) | Knowledge-check questions sufficient |
| memory | L1/L2 Cache | Behavior observable in profiler; no standalone exercise |
| execution | Warp Execution States | Observable via Nsight Compute; no standalone CUDA exercise |
| execution | Dynamic Parallelism | Niche use case; exercise would be complex for limited return |
| algorithms | Parallel Sorting (Radix Sort) | Use CUB/Thrust in practice; understanding algorithm more important than implementation |
| algorithms | Map/Scatter/Gather | Embedded in other exercises |
| linear-algebra | CUTLASS Abstractions | Too complex for standalone exercise; understanding from reading |
| profiling | Nsight Systems Concurrency | Observational; no coding exercise — use streams exercise with Nsight Systems |
| profiling | Memory-Bound vs Compute-Bound | Embedded in profiling exercise |
| llm-kernels | Attention Mechanism | Building block for FlashAttention exercise |
| llm-kernels | FlashAttention Backward Pass | Advanced; follow-up to forward exercise |
| llm-kernels | Hopper TMA & WGMMA | Expert-level; reading FA3 source code is the "exercise" |

---

## 6. Coverage Gaps (topics in resources but not yet planned)

### High Priority Gaps (should be added in Phase C)

| Gap | Evidence in Resources | Suggested Node |
|-----|----------------------|----------------|
| **CUDA Graphs** | cuda-samples/3_CUDA_Features/simpleCudaGraphs/, programming guide ch4.2 | `cuda-graphs` CONCEPT + exercise |
| **Async Barriers (__mbarrier)** | Ampere/Hopper docs, async-barriers chapter in CUDA guide | Extend cuda-streams topic |
| **Thread Block Clusters** | Hopper tuning guide section 1.4.1.3; FA3 source uses cluster dimensions | `thread-block-clusters` CONCEPT |
| **Warp-Level Primitives Beyond Shuffle** | __reduce_add_sync, __reduce_max_sync (Ampere+) | Extend parallel-reduction topic |
| **Kernel Timing with CUDA Events** | Referenced in best practices guide; essential for all profiling exercises | Add to vector-add exercise |

### Medium Priority Gaps

| Gap | Evidence in Resources | Suggested Node |
|-----|----------------------|----------------|
| **Cooperative Launch (grid-level sync)** | cuda-samples/simpleCooperativeGroups/; programming guide | Extend cooperative-groups topic |
| **Atomic Operations Deep Dive** | cuda-samples/simpleAtomicIntrinsics/; warpAggregatedAtomicsCG | `atomic-operations` CONCEPT |
| **Multi-GPU Programming** | cuda-samples/simpleP2P/, simpleMultiGPU/; programming guide ch3.4 | `multi-gpu` CONCEPT (out of scope for single-GPU curriculum) |
| **Pinned Memory** | Best practices guide sec 10.1.1; required for async transfers | Extend unified-memory topic |
| **Stream Compaction** | Prefix scan enables; needed for sparse computation | `stream-compaction` PROBLEM |
| **Convolution as GEMM** | CUDA samples convolutionSeparable; llm.c has no convolution | Future curriculum expansion |

### Low Priority Gaps (advanced/niche)

| Gap | Evidence in Resources | Suggested Node |
|-----|----------------------|----------------|
| **PTX Inline Assembly** | cuda-samples/inlinePTX/; gpu-glossary streaming-assembler | `inline-ptx` CONCEPT |
| **NVRTC Runtime Compilation** | gpu-glossary/host-software/nvrtc.md; clock_nvrtc sample | `nvrtc` CONCEPT |
| **Distributed Shared Memory (Hopper clusters)** | Hopper tuning guide; FA3 TMA multicast | Extend thread-block-clusters topic |
| **Speculative Decoding** | cuda-mode-lectures lecture_022 | Advanced LLM systems; beyond kernel curriculum |
| **Tensor Parallelism (Megatron)** | papers/megatron-lm.pdf (unreadable); nccl_all_reduce.cu | Multi-GPU systems; Phase E |
| **ZeRO Memory Optimization** | papers/zero.pdf (unreadable); llm.c multi-GPU | Multi-GPU systems; Phase E |

---

## 7. Exercises Difficulty Distribution

| Cluster | Easy | Medium | Hard | Total |
|---------|------|--------|------|-------|
| foundations | 2 | 0 | 0 | 2 |
| memory | 2 | 2 | 0 | 4 |
| execution | 0 | 1 | 0 | 1 |
| algorithms | 1 | 2 | 1 | 4 |
| linear-algebra | 1 | 1 | 1 | 3 |
| profiling | 0 | 1 | 0 | 1 |
| llm-kernels | 1 | 2 | 1 | 4 |
| **Total** | **7** | **9** | **3** | **19** |

Target ratio: Easy 30-40%, Medium 45-55%, Hard 15-20%. Current distribution is well-balanced.

---

## 8. Roadmap Node Coverage Summary

| Track.mdx Node | Curriculum Coverage | Status |
|---------------|---------------------|--------|
| cuda-intro | foundations cluster (4 topics, 7 concepts) | COVERED |
| cuda-threads | foundations/thread-hierarchy (3 concepts, 2 exercises) | COVERED |
| cuda-memory | memory cluster (6 topics, 7 concepts, 4 exercises) | COVERED + EXPANDED |
| vector-add | foundations exercise + grid-stride-saxpy | COVERED |
| matrix-multiply | memory tiled-matrix-multiply + LA custom-sgemm + wmma-hgemm | COVERED + EXPANDED |
| matrix-transpose | memory matrix-transpose exercise | COVERED |
| reduce-sum | algorithms parallel-reduction (6-step optimization) | COVERED + EXPANDED |
| cuda-streams | execution streams-concurrency topic + overlap exercise | COVERED |

**Existing coverage: 8/8 nodes (100%). 21 new nodes recommended for Phase C.**
