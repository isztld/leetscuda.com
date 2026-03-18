# CUDA Node Writing Queue

Generated: 2026-03-16
Track: learning/cuda/track.mdx (42 nodes)

## Status legend
- [ ] not started
- [~] in progress
- [x] complete

---

## Cluster 1: Foundations
*Sources: cluster-foundations.json | PMPP Ch1-4 | cuda_by_example Ch1-5 | gpu-glossary/device-hardware/* + device-software/*  | cuda-mode-lectures/lecture_002,003,004*

### Theory nodes
- [x] gpu-architecture | GPU Architecture & SM Model | CONCEPT | easy | ~30min | source: cluster-foundations.json gpu-architecture-overview+sm-architecture topics; gpu-glossary/device-hardware/streaming-multiprocessor.md; gpu-glossary/device-hardware/warp-scheduler.md; cuda-programming-guide ch1; PMPP Ch1-2
- [x] thread-hierarchy | Thread Hierarchy | CONCEPT | easy | ~35min | source: cluster-foundations.json thread-hierarchy topic; gpu-glossary/device-software/thread-block-grid.md; gpu-glossary/device-software/warp.md; cuda-programming-guide ch2; PMPP Ch3-4
- [x] warp-execution | Warp Execution & SIMT Model | CONCEPT | easy | ~25min | source: cluster-foundations.json thread-hierarchy conceptId=simt-model; gpu-glossary/device-software/cuda-programming-model.md; cuda-mode-lectures/lecture_002/; PMPP Ch4 §4.1
- [x] compute-capability | Compute Capability & Architecture Generations | CONCEPT | intermediate | ~30min | source: cluster-foundations.json simt-architecture-progression topic; gpu-glossary/device-software/compute-capability.md; docs.nvidia.com/cuda/hopper-tuning-guide; docs.nvidia.com/cuda/ampere-tuning-guide

### Problem nodes
- [x] vector-add | Vector Addition | PROBLEM | easy | ~30min | source: cluster-foundations.json exerciseId=vector-add; cuda-samples/0_Introduction/vectorAdd/; cuda_by_example Ch3-4
- [x] grid-stride-saxpy | Grid-Stride SAXPY | PROBLEM | easy | ~25min | source: cluster-foundations.json exerciseId=grid-stride-saxpy; cuda-mode-lectures/lecture_003/

---

## Cluster 2: Memory
*Sources: cluster-memory.json | PMPP Ch5-6 | cuda_by_example Ch5-7 | gpu-glossary/perf/memory-coalescing.md; bank-conflict.md; register-pressure.md | cuda-mode-lectures/lecture_004,008/coalesce.cu | cuda-samples/transpose*

### Theory nodes
- [x] global-memory | Global Memory & Coalescing | CONCEPT | intermediate | ~30min | source: cluster-memory.json global-memory-coalescing topic; gpu-glossary/device-software/global-memory.md; gpu-glossary/perf/memory-coalescing.md; gpu-glossary/perf/memory-bandwidth.md; cuda-mode-lectures/lecture_008/coalesce.cu; PMPP Ch6 §6.2
- [x] shared-memory | Shared Memory & Bank Conflicts | CONCEPT | intermediate | ~35min | source: cluster-memory.json shared-memory-bank-conflicts topic; gpu-glossary/device-software/shared-memory.md; gpu-glossary/perf/bank-conflict.md; cuda_by_example Ch5 §5.3; PMPP Ch5 §5.2
- [x] register-pressure | Register Pressure & Occupancy | CONCEPT | intermediate | ~25min | source: cluster-memory.json registers-and-pressure topic; gpu-glossary/device-hardware/register-file.md; gpu-glossary/perf/register-pressure.md; docs.nvidia.com/cuda/cuda-c-best-practices-guide/#occupancy
- [x] unified-memory | Unified Memory | CONCEPT | intermediate | ~20min | source: cluster-memory.json unified-memory topic; gpu-glossary/device-software unified-memory concept; docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/unified-memory.html; cuda-samples/0_Introduction/UnifiedMemoryStreams/

### Problem nodes
- [x] matrix-transpose | Matrix Transpose | PROBLEM | intermediate | ~60min | source: cluster-memory.json exerciseId=matrix-transpose; cuda-samples/6_Performance/transpose/; cuda-samples/2_Concepts_and_Techniques/transpose/
- [x] matrix-multiply | Tiled Matrix Multiplication | PROBLEM | intermediate | ~90min | source: cluster-memory.json exerciseId=tiled-matrix-multiply; cuda-samples/0_Introduction/matrixMul/; llm.c/dev/cuda/matmul_forward.cu; PMPP Ch5 §5.3

---

## Cluster 3: Execution
*Sources: cluster-execution.json | PMPP Ch4,6 | cuda_by_example Ch9-10 | gpu-glossary/perf/warp-divergence.md; occupancy.md; latency-hiding.md | cuda-mode-lectures/lecture_008/divergence.cu,occupancy.cu | cuda-samples/simpleStreams*

### Theory nodes
- [x] warp-divergence | Warp Divergence & Branch Efficiency | CONCEPT | intermediate | ~30min | source: cluster-execution.json warp-execution-divergence topic; gpu-glossary/perf/warp-divergence.md; gpu-glossary/perf/branch-efficiency.md; cuda-mode-lectures/lecture_008/divergence.cu; PMPP Ch6 §6.1
- [x] occupancy | Occupancy & Latency Hiding | CONCEPT | intermediate | ~35min | source: cluster-execution.json occupancy-latency-hiding topic; gpu-glossary/perf/occupancy.md; gpu-glossary/perf/latency-hiding.md; gpu-glossary/perf/littles-law.md; docs.nvidia.com/cuda/cuda-c-best-practices-guide/#occupancy; cuda-mode-lectures/lecture_008/occupancy.cu
- [x] cuda-streams | CUDA Streams & Async Transfers | CONCEPT | intermediate | ~30min | source: cluster-execution.json streams-concurrency+cooperative-groups topics; docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html; docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cooperative-groups.html; cuda-samples/0_Introduction/simpleStreams/; cuda-samples/0_Introduction/simpleCooperativeGroups/; cuda-mode-lectures/lecture_009/
- [x] cooperative-groups | Cooperative Groups | CONCEPT | advanced | ~30min | source: cluster-execution.json cooperative-groups topic; docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cooperative-groups.html; cuda-samples/0_Introduction/simpleCooperativeGroups/; gpu-glossary/device-software/cooperative-thread-array.md; gpu-glossary/device-software/warpgroup.md

### Problem nodes
- [x] streams-overlap | Overlap Transfers with Computation | PROBLEM | intermediate | ~60min | source: cluster-execution.json exerciseId=streams-overlap; cuda-samples/0_Introduction/simpleStreams/; cuda-samples/0_Introduction/asyncAPI/; cuda-mode-lectures/lecture_009/multistream-reduce.cu

---

## Cluster 4: Algorithms
*Sources: cluster-algorithms.json | PMPP Ch10 | cuda_by_example Ch5,9,App A | cuda-samples/reduction,scan,histogram | cuda-mode-lectures/lecture_009*

### Theory nodes
- [x] parallel-patterns | Map, Scatter, Gather | CONCEPT | easy | ~20min | source: cluster-algorithms.json parallel-patterns topic; docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html; cuda_by_example Ch4-5
- [x] radix-sort | Parallel Sorting (Radix Sort) | CONCEPT | advanced | ~30min | source: cluster-algorithms.json sorting topic; cuda-samples/2_Concepts_and_Techniques/radixSortThrust/; CUB DeviceRadixSort documentation

### Problem nodes
- [ ] reduce-sum | Parallel Reduction Sum | PROBLEM | intermediate | ~90min | source: cluster-algorithms.json parallel-reduction topic; cuda-samples/2_Concepts_and_Techniques/reduction/; cuda-mode-lectures/lecture_009/reduce_coarsening.cu; llm.c/dev/cuda/global_norm.cu
- [ ] prefix-scan | Exclusive Prefix Scan | PROBLEM | intermediate | ~120min | source: cluster-algorithms.json prefix-scan topic; cuda-samples/2_Concepts_and_Techniques/scan/; cuda-samples/2_Concepts_and_Techniques/shfl_scan/
- [ ] histogram | Privatized Histogram | PROBLEM | intermediate | ~60min | source: cluster-algorithms.json histogram topic; cuda-samples/2_Concepts_and_Techniques/histogram/; cuda_by_example Ch9 §9.4

---

## Cluster 5: Linear Algebra
*Sources: cluster-linear-algebra.json | PMPP Ch3,5,6 | gpu-glossary/device-hardware/tensor-core.md | gpu-glossary/host-software/cublas.md | docs.nvidia.com/cuda/cublas | cuda-samples/3_CUDA_Features/cudaTensorCoreGemm/ | cutlass/README.md | cuda-mode-lectures/lecture_036,057 | llm.c/dev/cuda/matmul_forward.cu*

### Theory nodes
- [x] gemm-fundamentals | GEMM Fundamentals & Tiling | CONCEPT | intermediate | ~40min | source: cluster-linear-algebra.json gemm-fundamentals+tiled-gemm topics; gpu-glossary/perf/arithmetic-intensity.md; gpu-glossary/perf/arithmetic-bandwidth.md; llm.c/dev/cuda/matmul_forward.cu; PMPP Ch3 §3.3, Ch5 §5.3
- [x] tensor-cores | Tensor Cores & WMMA API | CONCEPT | advanced | ~45min | source: cluster-linear-algebra.json tensor-cores-wmma topic; gpu-glossary/device-hardware/tensor-core.md; cuda-samples/3_CUDA_Features/cudaTensorCoreGemm/; docs.nvidia.com/cuda/ampere-tuning-guide/#improved-tensor-core-operations; gpu-glossary/device-software/warpgroup.md

### Problem nodes (in dependency order)
- [ ] cublas-integration | cuBLAS GEMM Integration | PROBLEM | intermediate | ~45min | source: cluster-linear-algebra.json cublas-usage topic; gpu-glossary/host-software/cublas.md; docs.nvidia.com/cuda/cublas/
- [ ] gemm-optimization | Optimized SGEMM from Scratch | PROBLEM | advanced | ~240min | source: cluster-linear-algebra.json tiled-gemm exerciseId=custom-sgemm; llm.c/dev/cuda/matmul_forward.cu; cuda-samples/0_Introduction/matrixMul/
- [ ] tensor-core-gemm | HGEMM with WMMA Tensor Cores | PROBLEM | advanced | ~180min | source: cluster-linear-algebra.json tensor-cores-wmma exerciseId=wmma-hgemm; cuda-samples/3_CUDA_Features/cudaTensorCoreGemm/

### Article nodes
- [ ] cutlass | CUTLASS Abstractions | ARTICLE | expert | ~60min | source: cluster-linear-algebra.json cutlass-abstractions topic; resources/cutlass/README.md; cuda-mode-lectures/lecture_036/; cuda-mode-lectures/lecture_057/

---

## Cluster 6: Profiling
*Sources: cluster-profiling.json | gpu-glossary/perf/roofline-model.md; arithmetic-intensity.md; memory-bound.md; compute-bound.md | cuda-mode-lectures/lecture_001,008 | docs.nvidia.com/cuda/cuda-c-best-practices-guide/#performance-metrics*

### Theory nodes
- [x] roofline-model | Roofline Model & Performance Analysis | CONCEPT | intermediate | ~30min | source: cluster-profiling.json roofline-model topic; gpu-glossary/perf/roofline-model.md; gpu-glossary/perf/arithmetic-intensity.md; cuda-mode-lectures/lecture_001/
- [x] bottleneck-analysis | Memory-Bound vs Compute-Bound | CONCEPT | intermediate | ~25min | source: cluster-profiling.json memory-bound-vs-compute-bound topic; gpu-glossary/perf/memory-bound.md; gpu-glossary/perf/compute-bound.md; gpu-glossary/perf/performance-bottleneck.md; PMPP Ch6 §6.7
- [ ] nsight-compute | Nsight Compute Profiling Workflow | CONCEPT | intermediate | ~40min | source: cluster-profiling.json nsight-compute-workflow+nsight-systems-concurrency topics; gpu-glossary/host-software/nsight-systems.md; gpu-glossary/perf/issue-efficiency.md; gpu-glossary/perf/pipe-utilization.md; cuda-mode-lectures/lecture_001/; cuda-mode-lectures/lecture_008/

### Problem nodes
- [ ] profile-and-optimize | Profile and Optimize a Kernel | PROBLEM | intermediate | ~90min | source: cluster-profiling.json exerciseId=profile-and-optimize; cuda-mode-lectures/lecture_001/; cuda-mode-lectures/lecture_008/

---

## Cluster 7: LLM Kernels
*Sources: cluster-llm-kernels.json | llm.c/dev/cuda/*.cu | flash-attention/README.md | papers/flash-attention-1.pdf through flash-attention-3.pdf | papers/megatron-lm.pdf | papers/zero.pdf | cuda-mode-lectures/lecture_012,018,036*

### Theory nodes (in dependency order)
- [x] attention | Scaled Dot-Product Attention | CONCEPT | intermediate | ~40min | source: cluster-llm-kernels.json attention-mechanism topic; llm.c/dev/cuda/attention_forward.cu; cuda-mode-lectures/lecture_012/; papers/flash-attention-1.pdf §1
- [x] kernel-fusion | Kernel Fusion | CONCEPT | intermediate | ~30min | source: cluster-llm-kernels.json fused-operations topic; cuda-mode-lectures/lecture_018/; llm.c/dev/cuda/fused_residual_forward.cu; gpu-glossary/perf/arithmetic-intensity.md
- [x] kv-cache-design | KV Cache Design | CONCEPT | advanced | ~25min | source: cluster-llm-kernels.json kv-cache topic; flash-attention/README.md (GQA/MQA sections); flash-attention/hopper/benchmark_mla_decode.py
- [x] tensor-parallelism | Tensor Parallelism | CONCEPT | advanced | ~45min | source: cluster-llm-kernels.json tensor-parallelism topic; papers/megatron-lm.pdf §3; llm.c/dev/cuda/nccl_all_reduce.cu
- [x] zero-memory-opt | ZeRO Distributed Memory Optimization | CONCEPT | advanced | ~45min | source: cluster-llm-kernels.json distributed-memory-optimization topic; papers/zero.pdf §5,7

### Problem nodes (in dependency order)
- [ ] fused-softmax | Fused Online Softmax | PROBLEM | intermediate | ~90min | source: cluster-llm-kernels.json softmax-kernel topic; llm.c/dev/cuda/softmax_forward.cu; cuda-mode-lectures/lecture_012/flash_attention.cu; papers/flash-attention-1.pdf §3 (online softmax)
- [ ] layer-norm-kernel | LayerNorm + Residual Fusion | PROBLEM | intermediate | ~60min | source: cluster-llm-kernels.json layer-norm topic; llm.c/dev/cuda/layernorm_forward.cu; llm.c/dev/cuda/fused_residual_forward.cu
- [ ] quantization-exercise | INT8 Quantize/Dequantize Kernel | PROBLEM | intermediate | ~60min | source: cluster-llm-kernels.json quantization-kernels topic; llm.c/dev/cuda/ (no direct file; see gelu_forward.cu for vectorized pattern); resources/cutlass/README.md (FP8/INT8 types)
- [ ] flash-attention-impl | FlashAttention Forward Pass | PROBLEM | advanced | ~300min | source: cluster-llm-kernels.json flash-attention topic exerciseId=flash-attention-naive; papers/flash-attention-1.pdf §3.1 Algorithm 1; cuda-mode-lectures/lecture_012/flash_attention.cu; flash-attention/csrc/flash_attn/flash_fwd_kernel.h

### Article nodes
- [ ] hopper-tma-wgmma | Hopper TMA & Warpgroup MMA | ARTICLE | expert | ~60min | source: cluster-llm-kernels.json hopper-tma-wgmma topic; papers/flash-attention-3.pdf §3.1-3.3; flash-attention/hopper/flash_fwd_kernel_sm90.h; gpu-glossary/device-hardware/tensor-memory-accelerator.md; gpu-glossary/device-software/warpgroup.md

---

## Writing order for Phase C sessions

Each Phase C session receives exactly ONE node to write. Recommended order follows the dependency graph:

### Session batch 1 (no prereq content required — foundations cluster)
1. `global-memory` — reads cluster-memory.json, writes learning/cuda/theory/global-memory/
2. `shared-memory` — reads cluster-memory.json, writes learning/cuda/theory/shared-memory/
3. `register-pressure` — reads cluster-memory.json, writes learning/cuda/theory/register-pressure/
4. `unified-memory` — reads cluster-memory.json, writes learning/cuda/theory/unified-memory/

### Session batch 2 (memory cluster problems)
5. `matrix-transpose` — already exists; update to new spec; reads cluster-memory.json
6. `matrix-multiply` — already exists; update to new spec; reads cluster-memory.json

### Session batch 3 (execution cluster)
7. `warp-divergence` — reads cluster-execution.json
8. `occupancy` — reads cluster-execution.json
9. `cuda-streams` — already exists; update; reads cluster-execution.json
10. `streams-overlap` — reads cluster-execution.json
11. `cooperative-groups` — reads cluster-execution.json

### Session batch 4 (algorithms cluster)
12. `parallel-patterns` — reads cluster-algorithms.json
13. `reduce-sum` — already exists; update; reads cluster-algorithms.json
14. `prefix-scan` — reads cluster-algorithms.json
15. `histogram` — reads cluster-algorithms.json
16. `radix-sort` — reads cluster-algorithms.json

### Session batch 5 (linear algebra cluster)
17. `gemm-fundamentals` — reads cluster-linear-algebra.json
18. `cublas-integration` — reads cluster-linear-algebra.json
19. `gemm-optimization` — reads cluster-linear-algebra.json (hard, 240min)
20. `tensor-cores` — reads cluster-linear-algebra.json
21. `tensor-core-gemm` — reads cluster-linear-algebra.json (hard, 180min)
22. `cutlass` — reads cluster-linear-algebra.json + cutlass/README.md (ARTICLE)

### Session batch 6 (profiling cluster)
23. `roofline-model` — reads cluster-profiling.json
24. `bottleneck-analysis` — reads cluster-profiling.json
25. `nsight-compute` — reads cluster-profiling.json
26. `profile-and-optimize` — reads cluster-profiling.json

### Session batch 7 (llm-kernels cluster — hardest, save for last)
27. `attention` — reads cluster-llm-kernels.json
28. `fused-softmax` — reads cluster-llm-kernels.json + llm.c softmax_forward.cu
29. `layer-norm-kernel` — reads cluster-llm-kernels.json + llm.c layernorm_forward.cu
30. `kernel-fusion` — reads cluster-llm-kernels.json + cuda-mode-lectures/lecture_018/
31. `quantization-exercise` — reads cluster-llm-kernels.json
32. `kv-cache-design` — reads cluster-llm-kernels.json + flash-attention README
33. `flash-attention-impl` — reads cluster-llm-kernels.json + FA1 paper §3.1 + lecture_012/ (hardest, 300min)
34. `tensor-parallelism` — reads cluster-llm-kernels.json + megatron-lm.pdf §3
35. `zero-memory-opt` — reads cluster-llm-kernels.json + zero.pdf §5,7
36. `hopper-tma-wgmma` — reads cluster-llm-kernels.json + FA3 paper §3 + hopper/ source (ARTICLE)

---

## Already-complete nodes (existed in track.mdx v1)

These nodes existed before Phase B. Their content files are in learning/cuda/theory/ and learning/cuda/problems/. They need to be **updated** (not rewritten from scratch) to match the new node spec format and the richer curriculum details from the cluster JSONs:

| Node | Location | Update scope |
|------|----------|-------------|
| gpu-architecture | learning/cuda/theory/cuda-intro/ | Rename dir; expand SM internals from sm-architecture topic |
| thread-hierarchy | learning/cuda/theory/cuda-threads/ | Rename dir; add SIMT model section |
| warp-execution | (new split from cuda-threads) | New file from thread-hierarchy SIMT content |
| compute-capability | (new) | New theory file |
| vector-add | learning/cuda/problems/vector-add/ | Update spec; add kernel-timing variant |
| matrix-multiply | learning/cuda/problems/matrix-multiply/ | Update to include CGMA analysis from PMPP |
| matrix-transpose | learning/cuda/problems/matrix-transpose/ | Update spec |
| reduce-sum | learning/cuda/problems/reduce-sum/ | Update; add shfl_down_sync step |
| cuda-streams | learning/cuda/theory/cuda-streams/ | Update; expand streams + events content |
