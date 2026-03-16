# CUDA Curriculum Baseline

Generated: 2026-03-16

## Existing Track Nodes (from learning/cuda/track.mdx)

| Slug | Title | Type | Order | Prerequisites |
|------|-------|------|-------|---------------|
| cuda-intro | Introduction to CUDA | CONCEPT | 1 | [] |
| cuda-threads | Threads, Blocks & Grids | CONCEPT | 2 | [cuda-intro] |
| cuda-memory | Memory Hierarchy | CONCEPT | 3 | [cuda-threads] |
| vector-add | Vector Addition | PROBLEM | 4 | [cuda-threads] |
| matrix-multiply | Tiled Matrix Multiplication | PROBLEM | 5 | [cuda-memory] |
| matrix-transpose | Matrix Transpose | PROBLEM | 6 | [cuda-memory] |
| reduce-sum | Parallel Reduction Sum | PROBLEM | 7 | [cuda-memory] |
| cuda-streams | CUDA Streams & Async Transfers | CONCEPT | 8 | [cuda-memory] |

**Total: 8 nodes (4 CONCEPT, 4 PROBLEM)**

## Theory Files (learning/cuda/theory/)

- cuda-intro/
- cuda-memory/
- cuda-streams/
- cuda-threads/

## Problem Files (learning/cuda/problems/)

- matrix-multiply/
- matrix-transpose/
- reduce-sum/
- vector-add/

---

## Resource Inventory (Phase A Ingestion)

### gpu-glossary
- **device-hardware/**: 16 entries — core, cuda-core, cuda-device-architecture, gpu-ram, graphics-processing-cluster, l1-data-cache, load-store-unit, register-file, special-function-unit, streaming-multiprocessor-architecture, streaming-multiprocessor, tensor-core, tensor-memory-accelerator, tensor-memory, texture-processing-cluster, warp-scheduler
- **device-software/**: 16 entries — compute-capability, cooperative-thread-array, cuda-programming-model, global-memory, kernel, memory-hierarchy, parallel-thread-execution, registers, shared-memory, streaming-assembler, thread-block-grid, thread-block, thread-hierarchy, thread, warp, warpgroup
- **host-software/**: 18 entries — cublas, cuda-binary-utilities, cuda-c, cuda-driver-api, cuda-runtime-api, cuda-software-platform, cudnn, cupti, libcuda, libcudart, libnvml, nsight-systems, nvcc, nvidia-gpu-drivers, nvidia-ko, nvidia-smi, nvml, nvrtc
- **perf/**: 23 entries — active-cycle, arithmetic-bandwidth, arithmetic-intensity, bank-conflict, branch-efficiency, compute-bound, issue-efficiency, latency-hiding, littles-law, memory-bandwidth, memory-bound, memory-coalescing, occupancy, overhead, peak-rate, performance-bottleneck, pipe-utilization, register-pressure, roofline-model, scoreboard-stall, streaming-multiprocessor-utilization, warp-divergence, warp-execution-state

### docs.nvidia.com
- **cuda-programming-guide/**: Full chapter structure (5 parts, 20 chapters) — intro, thread model, async execution, unified memory, nvcc, advanced APIs, driver API, multi-GPU, CUDA features, graphs, cooperative groups, barriers, pipelines, async copies, L2 cache, dynamic parallelism, compute capabilities
- **cuda-c-best-practices-guide/**: 21 chapters — profiling, heterogeneous computing, memory optimizations, execution config, instruction optimizations, deployment, compatibility
- **hopper-tuning-guide/**: Hopper-specific — TMA, Thread Block Clusters, HBM3, L2 cache, NVLink4
- **ampere-tuning-guide/**: Ampere-specific — async copy, arrive/wait barrier, improved tensor cores, HBM2e
- **cublas/**: Full API reference — GEMM, batched GEMM, tensor core usage, mixed precision, streaming
- **cuda-math-api/**: Math functions API
- **parallel-thread-execution/**: PTX ISA reference (llms.txt link only, HTML not present)
- **nsight-compute/**: Not present as local HTML

### cuda-samples
- **0_Introduction/**: 47 samples — vectorAdd, matrixMul, simpleStreams, simpleCooperativeGroups, simpleOccupancy, asyncAPI, clock, fp16ScalarProduct, UnifiedMemoryStreams, simpleAtomicIntrinsics, simpleHyperQ, simpleP2P
- **1_Utilities/**: 3 samples — deviceQuery, deviceQueryDrv, topologyQuery
- **2_Concepts_and_Techniques/**: 34 samples — reduction, scan, histogram, shfl_scan, transpose, sortingNetworks, convolutionSeparable, radixSortThrust, eigenvalues, inlinePTX, threadFenceReduction, reductionMultiBlockCG
- **3_CUDA_Features/**: 24 samples — cudaTensorCoreGemm, bf16TensorCoreGemm, tf32TensorCoreGemm, immaTensorCoreGemm, dmmaTensorCoreGemm, globalToShmemAsyncCopy, simpleCudaGraphs, warpAggregatedAtomicsCG, cdpSimplePrint
- **6_Performance/**: 7 samples — transpose, alignedTypes, UnifiedMemoryPerf, cudaGraphsPerfScaling, LargeKernelParameter

### cuda-mode-lectures
79 lectures documented in README. Key for curriculum:
- Lecture 1: Profiling + PyTorch integration
- Lecture 2: PMPP Ch.1-3 recap
- Lecture 3: Getting Started with CUDA
- Lecture 4: Compute and Memory Architecture
- Lecture 8: CUDA Performance Checklist (coalesce.cu, occupancy.cu, divergence.cu)
- Lecture 9: Reductions (reduce_coarsening.cu, multistream-reduce.cu)
- Lecture 12: Flash Attention (flash_attention.cu, flash_attention_fwd.png)
- Lecture 18: Fused Kernels
- Lecture 29: Triton Internals
- Lecture 36: CUTLASS and Flash Attention 3
- Lecture 37: SASS & GPU Microarchitecture
- Lecture 57: CuTE
- Lecture 75: GPU Programming Fundamentals + ThunderKittens

### cutlass
- CUTLASS 4.4.1 (Feb 2026) — CuTe DSL, C++ templates for GEMM, mixed precision (FP64/FP32/TF32/FP16/BF16/FP8/INT8/INT4/FP4), block-scaled types (NVFP4/MXFP4/MXFP6/MXFP8), Volta→Blackwell support
- Docs: HTML-rendered Doxygen (docs/); key concepts: layouts, tensors, hardware atoms, thread hierarchy

### llm.c
- GPT-2 pretraining in pure C/CUDA; dev/cuda/ contains 25 kernel files
- Key kernels: attention_forward.cu, attention_backward.cu, matmul_forward.cu, softmax_forward.cu, layernorm_forward.cu, fused_residual_forward.cu, crossentropy_forward.cu, gelu_forward.cu, adamw.cu, nccl_all_reduce.cu, global_norm.cu

### flash-attention
- FA1 (csrc/): cuDNN-based, Ampere backward sm80 kernel, forward fwd_kernel
- FA3 (hopper/): SM90-specific — warpgroup GEMM, TMA, split-K, FP8 forward
- FA4 (flash_attn/cute/): CuTeDSL, SM90+SM100, online softmax, TMA pipelining, 2CTA, GQA pack, paged KV

### papers
- flash-attention-1.pdf, flash-attention-2.pdf, flash-attention-3.pdf: **PDF UNREADABLE** (pdftoppm not installed)
- megatron-lm.pdf: **PDF UNREADABLE**
- zero.pdf: **PDF UNREADABLE**

### books
- Programming Massively Parallel Processors.pdf: **PDF UNREADABLE** (pdftoppm not installed)
- cuda_by_example.pdf: **PDF UNREADABLE** (pdftoppm not installed)

---

## Ingestion Summary (Phase A)

| Source | Status | Items Extracted |
|--------|--------|----------------|
| gpu-glossary (73 entries) | COMPLETE | 73 concept definitions |
| docs.nvidia.com (8 guides) | PARTIAL (6/8 HTML present) | Chapter structures |
| cuda-samples (115 samples) | COMPLETE | Sample catalog |
| cuda-mode-lectures (79 lectures) | COMPLETE (README) | Topics + key code |
| cutlass | COMPLETE | Core abstractions |
| llm.c | COMPLETE | 25 CUDA kernel files |
| flash-attention | COMPLETE | FA1/FA3/FA4 architecture |
| papers (5 PDFs) | SKIPPED | pdftoppm missing |
| books (2 PDFs) | SKIPPED | pdftoppm missing |

**Total sources read: 7/9 categories fully read; 2 categories blocked by missing pdftoppm**

---

## Curriculum Files Written

| File | Topics | Concepts | Exercises |
|------|--------|----------|-----------|
| `curriculum/cluster-foundations.json` | 4 | 7 | 2 |
| `curriculum/cluster-memory.json` | 6 | 7 | 4 |
| `curriculum/cluster-execution.json` | 5 | 6 | 1 |
| `curriculum/cluster-algorithms.json` | 5 | 7 | 4 |
| `curriculum/cluster-linear-algebra.json` | 5 | 7 | 3 |
| `curriculum/cluster-profiling.json` | 4 | 5 | 1 |
| `curriculum/cluster-llm-kernels.json` | 8 | 12 | 4 |
| `curriculum/meta.json` | — | — | — |
| `curriculum/GAPS.md` | — | — | — |
| **Totals** | **37** | **51** | **19** |

## Counts

- Total clusters: 7
- Total topics: 37
- Total concepts: 51
- Total exercises: 19
- Existing roadmap nodes covered: 8/8 (100%)
- New roadmap nodes recommended: 21
