# Theory & Article Audit Report
Generated: 2026-03-20
Total files: 31 theory + 2 articles = 33

## Summary

| Verdict | Count | Files |
|---------|-------|-------|
| PASS | 8 | cooperative-groups, gpu-architecture, occupancy, register-pressure, roofline-model, gemm-fundamentals, kv-cache-design, zero-memory-opt |
| NEEDS_MINOR_FIX | 13 | bottleneck-analysis, compute-capability, cuda-streams, global-memory, shared-memory, thread-hierarchy, unified-memory, warp-divergence, warp-execution, cutlass, attention, tensor-parallelism, radix-sort |
| NEEDS_MAJOR_FIX | 12 | nsight-compute, tensor-cores, kernel-fusion, parallel-patterns, hopper-tma-wgmma, ml-inference-basics, quantization-intro, gpu-operator, k8s-basics, memory-model, profiling-basics, simd-basics |
| BROKEN | 0 | — |

---

## Critical issues (fix first)

1. **tensor-cores** — FP8 E5M2 format description inverted: line 314 says "2-bit exponent, 5-bit mantissa" for E5M2. E5M2 means 5-bit **E**xponent + 2-bit **M**antissa. The description reverses these values.

2. **nsight-compute** — H100 memory bandwidth stated as "1500 GB/s" (line 150). H100 HBM3 peak bandwidth is **3,350 GB/s (3.35 TB/s)**. The figure is 2.23× too low and would mislead users comparing kernel throughput to peak.

3. **kernel-fusion** — Two wrong hardware numbers in the Key Numbers table (line 318-319): H100 shared memory listed as "232 KB" (correct: **228 KB**); H100 L2 cache listed as "20 MB" (correct: **50 MB**). Also line 150 NVLink line lists 232 KB repeated.

4. **parallel-patterns** — SAXPY kernel (line 39-43) references undefined variable `b`: `y[i] = a * x[i] + b;` but the function signature is `saxpy(float a, const float* x, float* y, int n)`. No `b` parameter. This would fail to compile.

5. **hopper-tma-wgmma** — Key numbers table (line 335) states "Max warps per SM | 2048". Max warps per SM on H100 is **64** (2048 is max *threads* per SM, not warps). Correct: 2048 threads / 32 threads per warp = 64 warps.

6. **tensor-cores** — Wrong API for TF32: line 185 says `cudaSetDeviceFlags(cudaDeviceEnablePeerAccess)` to enable TF32. `cudaDeviceEnablePeerAccess` enables peer access between GPUs; it has nothing to do with TF32. The correct approach is `cublasSetMathMode(handle, CUBLAS_TENSOR_OP_MATH)`.

---

## Stale track slugs found

None. All 33 files use correct track slugs (cuda-core, cuda-hpc, gpu-llm, ml-systems, kubernetes-ai, foundations). No stale "cuda" slug references found.

---

## Missing required sections

Files missing **all three** required structural sections (Why this matters for interviews, Common misconceptions, Interview patterns) **and** missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources):

- `ml-systems/theory/ml-inference-basics` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `ml-systems/theory/quantization-intro` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `kubernetes-ai/theory/gpu-operator` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `kubernetes-ai/theory/k8s-basics` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `foundations/theory/memory-model` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `foundations/theory/profiling-basics` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections
- `foundations/theory/simd-basics` — missing cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources; missing all three sections

---

## Per-file evaluations

### cuda-core/theory/bottleneck-analysis

```
FRONTMATTER
- [x] All required fields present
- [x] slug matches directory
- [x] track: cuda-core correct
- [x] No stale track slugs

CONTENT QUALITY
- [x] No draft text or TODO markers
- [x] Code examples syntactically correct
- [x] No marketing language

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" with specific questions (4 questions)
- [x] "Further reading" present
- [x] Sections flow logically

TECHNICAL ACCURACY
- [x] Hardware numbers correct (H100, B200 ridge points match roofline-model.mdx)
- [x] Arithmetic intensity calculations correct
- [x] No contradictions

ATTRIBUTION
- [ ] Attribution footer missing despite using Modal GPU Glossary content in sources

ISSUES FOUND:
- MINOR: Further reading links use internal paths (/learn/roofline-model, /gpu-glossary/perf/...) — verify these resolve in the app

VERDICT: NEEDS_MINOR_FIX — add attribution footer for Modal GPU Glossary content
```

---

### cuda-core/theory/compute-capability

```
FRONTMATTER
- [x] All required fields present
- [x] slug matches directory
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text or TODO markers
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (5 questions)
- [x] "Further reading" present — descriptions only, no real URLs

TECHNICAL ACCURACY
- [x] Architecture progression is correct
- [ ] Feature matrix table (line 166) has malformed separator: `|-----------|----------|-----------|---------|--|` with only 5 cells for a 6-column table — renders incorrectly in markdown

ISSUES FOUND:
- MINOR: Feature matrix table header separator broken (6 columns but 5 separator cells)
- MINOR: Further reading section has descriptions without clickable URLs

VERDICT: NEEDS_MINOR_FIX — fix table separator, add real URLs to further reading
```

---

### cuda-core/theory/cooperative-groups

```
FRONTMATTER
- [x] All required fields present
- [x] slug: cooperative-groups correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct
- [x] No marketing language

STRUCTURE
- [x] "Why Cooperative Groups Matter for Interviews" present
- [x] "Common Misconceptions" with ❌/✓ format (5 items)
- [x] "Interview Patterns" (4 questions with key points)
- [x] "Further Reading" with real NVIDIA documentation links
- [x] Sections flow logically

TECHNICAL ACCURACY
- [x] cooperative_groups API usage is correct
- [x] Grid-level sync requirements accurately described
- [x] Warpgroup/tiled_partition distinction is correct

ATTRIBUTION
- [x] Attribution footer present for Modal GPU Glossary

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-core/theory/cuda-streams

```
FRONTMATTER
- [x] All required fields present
- [x] slug: cuda-streams correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why Streams Matter for Interviews" present
- [x] "Common Misconceptions About Streams" present
- [x] "Common Misconceptions About Cooperative Groups" present (separate section)
- [x] "Interview Patterns" present
- [x] "Further Reading" with real URLs

TECHNICAL ACCURACY
- [x] Stream semantics correct
- [x] HyperQ, concurrent kernel limits correct

ISSUES FOUND:
- MINOR: Large cooperative groups section (lines 177–315) is nearly duplicated content from cooperative-groups.mdx — consider trimming to a brief summary with a link to the cooperative-groups concept node

ATTRIBUTION
- [x] Attribution footer present

VERDICT: NEEDS_MINOR_FIX — trim duplicate cooperative groups section
```

---

### cuda-core/theory/global-memory

```
FRONTMATTER
- [x] All required fields present
- [x] slug: global-memory correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct
- [x] Hardware numbers cited to sources

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common Misconceptions" with ❌/✓ format (6 items)
- [x] "Interview Patterns" (5 patterns)
- [x] "Further Reading" (no real URLs, descriptions only)

TECHNICAL ACCURACY
- [x] Cache line mechanics accurate (128 bytes, 32 floats)
- [x] HBM bandwidth numbers correct (A100, H100, B200)
- [x] Latency numbers correct (~400 cycles DRAM, ~200 L2, ~30 L1)

ATTRIBUTION
- [ ] Uses Modal GPU Glossary extensively in sources but no attribution footer

ISSUES FOUND:
- MINOR: Missing attribution footer for Modal GPU Glossary

VERDICT: NEEDS_MINOR_FIX — add attribution footer
```

---

### cuda-core/theory/gpu-architecture

```
FRONTMATTER
- [x] All required fields present
- [x] slug: gpu-architecture correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Hardware numbers cited to NVIDIA tuning guides
- [x] No marketing language

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (10 items — comprehensive)
- [x] "Interview patterns" (4 questions with detailed answers)
- [x] "Further reading" with real NVIDIA documentation URLs

TECHNICAL ACCURACY
- [x] H100 SM count: 132 ✓
- [x] Register file: 65536 registers / 256 KB per SM ✓
- [x] Shared memory: 228 KB (H100), 164 KB (A100) ✓
- [x] TFLOPS numbers match NVIDIA spec ✓

ATTRIBUTION
- No Modal GPU Glossary content (only listed in sources for reference)

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-core/theory/nsight-compute

```
FRONTMATTER
- [x] All required fields present
- [x] slug: nsight-compute correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [ ] Line 150: H100 bandwidth stated as "1500 GB/s" — WRONG. H100 HBM3 is 3350 GB/s

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (5 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [CRITICAL] Line 150: `l1tex__data_pipe_lsu_wavefronts_mem_global_op_ld.rate` described with example throughput of "1500 GB/s" and compared to "peak HBM bandwidth (e.g., 1500 GB/s for A100)". A100 peak HBM bandwidth is 2000 GB/s; H100 is 3350 GB/s. The 1500 GB/s figure is wrong for both.
- [ ] Line 122: `nsight compute --metrics ...` — the CLI tool is `ncu`, not `nsight compute`

ISSUES FOUND:
- CRITICAL: H100/A100 bandwidth cited as 1500 GB/s; correct values are 3350 GB/s (H100) and 2000 GB/s (A100)
- MAJOR: Invalid CLI command `nsight compute` instead of `ncu`

VERDICT: NEEDS_MAJOR_FIX — correct bandwidth number, fix CLI command
```

---

### cuda-core/theory/occupancy

```
FRONTMATTER
- [x] All required fields present
- [x] slug: occupancy correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (5 items)
- [x] "Interview patterns" (4 questions with detailed answers)
- [x] "Further reading" with real NVIDIA and Modal URLs

TECHNICAL ACCURACY
- [x] H100/A100 register file: 65536 regs / 256 KB ✓
- [x] Shared memory: 228 KB (H100), 164 KB (A100) ✓
- [x] Little's Law application correct

ATTRIBUTION
- [x] Uses Modal GPU Glossary; no attribution footer but content is not adapted verbatim

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-core/theory/parallel-patterns

```
FRONTMATTER
- [x] All required fields present
- [x] slug: parallel-patterns correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [ ] Line 42: SAXPY kernel references undefined variable `b` — compile error

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (4 items)
- [x] "Interview patterns" (3 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [CRITICAL] Line 39-43: SAXPY kernel `saxpy(float a, const float* x, float* y, int n)` computes `y[i] = a * x[i] + b;` but `b` is not in the function signature. Code would not compile.
- [ ] Further reading uses internal paths: `books/Programming Massively Parallel Processors.pdf`, `llm.c/dev/cuda/...`

ISSUES FOUND:
- CRITICAL: SAXPY code example has undefined variable `b` — would not compile
- MINOR: Further reading uses internal file paths instead of URLs

VERDICT: NEEDS_MAJOR_FIX — fix SAXPY code bug
```

---

### cuda-core/theory/radix-sort

```
FRONTMATTER
- [x] All required fields present
- [x] slug: radix-sort correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (4 items)
- [x] "Interview patterns" (3 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [ ] Line 179: "~3.2 GB/s out of 3.35 TB/s theoretical" — units inconsistency. 3.2 GB/s cannot be 95% of 3.35 TB/s. Should be 3.2 TB/s (or stated as 3200 GB/s).
- [ ] Further reading links include `books/cuda_by_example.pdf` and `llm.c/global_norm.cu` which are internal project paths

ISSUES FOUND:
- MINOR: Line 179 units error: "3.2 GB/s out of 3.35 TB/s" — should be "3.2 TB/s"
- MINOR: Further reading uses internal file paths

VERDICT: NEEDS_MINOR_FIX — correct units in throughput claim
```

---

### cuda-core/theory/register-pressure

```
FRONTMATTER
- [x] All required fields present
- [x] slug: register-pressure correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (5 items)
- [x] "Interview patterns" (4 questions)
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [x] Register file size: 65536 regs / 256 KB ✓
- [x] Spill latency: L1 hit ~30 cycles, L1 miss ~400 cycles ✓
- [x] Occupancy calculations correct

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-core/theory/roofline-model

```
FRONTMATTER
- [x] All required fields present
- [x] slug: roofline-model correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] All hardware numbers cited to NVIDIA datasheets

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (3 patterns with framework answers)
- [x] "Further reading" with real URLs including original paper

TECHNICAL ACCURACY
- [x] Ridge point calculations correct for all GPUs in table
- [x] SAXPY / SGEMM / FFT arithmetic intensities correct
- [x] LLM inference analysis accurate

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-core/theory/shared-memory

```
FRONTMATTER
- [x] All required fields present
- [x] slug: shared-memory correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct
- [x] Hardware numbers cited to tuning guides

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (5 items)
- [x] "Interview patterns" (4 questions with detailed answers)
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [x] 32 banks, 4-byte wide bank period 128 bytes ✓
- [x] H100 shared memory 228 KB / 227 KB per block ✓
- [x] A100 shared memory 164 KB / 163 KB per block ✓
- [x] Bank conflict formula correct

ATTRIBUTION
- [ ] Uses Modal GPU Glossary in sources but no attribution footer

ISSUES FOUND:
- MINOR: Missing attribution footer for Modal GPU Glossary content

VERDICT: NEEDS_MINOR_FIX — add attribution footer
```

---

### cuda-core/theory/thread-hierarchy

```
FRONTMATTER
- [x] All required fields present
- [x] slug: thread-hierarchy correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (4 items)
- [x] "Interview patterns" (6 questions)
- [x] "Further reading" present (descriptions only, no URLs)

TECHNICAL ACCURACY
- [ ] Line 194-195: Key constants table says shared memory is "48 KB (Configurable 16-48 KB on most GPUs)". This is outdated — H100 supports up to 228 KB (requires dynamic allocation opt-in; 48 KB is only the static default). The table should note the static/dynamic distinction.
- [x] Warp size = 32 correct
- [x] Max threads per block = 1024 correct

ISSUES FOUND:
- MINOR: Shared memory capacity in key constants table shows outdated 48 KB limit without mentioning that dynamic allocation supports up to 228 KB (H100) or 164 KB (A100)
- MINOR: Further reading lacks real URLs

VERDICT: NEEDS_MINOR_FIX — update shared memory table entry, add URLs
```

---

### cuda-core/theory/unified-memory

```
FRONTMATTER
- [x] All required fields present
- [x] slug: unified-memory correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (5 items)
- [x] "Interview patterns" (4 questions)
- [x] "Further reading" with real NVIDIA URLs

TECHNICAL ACCURACY
- [ ] Line 121: "NVLink provides 160-25 GB/s bandwidth between CPU and GPU" — this range "160-25" reads as descending and is ambiguous/confusing. Likely meant "25–160 GB/s" (ascending). Also, NVLink 3.0 GPU-to-GPU is 600 GB/s bidirectional; CPU-GPU NVLink (Grace Hopper) is different. Context should clarify which NVLink topology is meant.

ISSUES FOUND:
- MINOR: NVLink bandwidth range "160-25 GB/s" is confusingly written and possibly incorrect for the described topology

VERDICT: NEEDS_MINOR_FIX — clarify NVLink bandwidth claim and direction
```

---

### cuda-core/theory/warp-divergence

```
FRONTMATTER
- [x] All required fields present
- [x] slug: warp-divergence correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (5 items)
- [x] "Interview patterns" (4 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [x] Pre-Volta vs Volta+ divergence behavior correct
- [x] Predication description accurate
- [ ] Line 122: `nsight compute --metrics smsp::warps_executed_divergent,yield_ratio` — ncu metric names use double underscores (`smsp__warps_executed_divergent`), not single colon separator
- [ ] Line 226: YouTube URL `https://www.youtube.com/watch?v=lecture_008` is fabricated — `lecture_008` is not a valid YouTube video ID

ISSUES FOUND:
- MINOR: ncu metric separator uses `::` instead of `__`
- MINOR: Fabricated YouTube URL in Further Reading

VERDICT: NEEDS_MINOR_FIX — fix metric separator, replace fabricated URL
```

---

### cuda-core/theory/warp-execution

```
FRONTMATTER
- [x] All required fields present
- [x] slug: warp-execution correct
- [x] track: cuda-core correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (5 questions)
- [x] "Further reading" present (descriptions only, no real URLs)

TECHNICAL ACCURACY
- [x] SIMT vs SIMD description correct
- [x] Re-convergence point explanation accurate
- [x] Hopper warp specialization correctly described as different from divergence

ISSUES FOUND:
- MINOR: Further reading lacks real URLs (CUDA Mode lecture 002 link is not a URL)

VERDICT: NEEDS_MINOR_FIX — add real URLs to further reading
```

---

### cuda-hpc/theory/gemm-fundamentals

```
FRONTMATTER
- [x] All required fields present
- [x] slug: gemm-fundamentals correct
- [x] track: cuda-hpc correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct
- [x] Hardware numbers cited to NVIDIA guides

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" (5 items, different format but includes ❌/✓ equivalents)
- [x] "Interview patterns" (3 patterns with expected answers)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [x] FLOPs count 2N³ for square GEMM correct
- [x] Arithmetic intensity N/6 derivation correct
- [x] Ridge point calculations match roofline-model.mdx ✓
- [x] Tiling hierarchy description accurate

ISSUES FOUND: None

VERDICT: PASS
```

---

### cuda-hpc/theory/tensor-cores

```
FRONTMATTER
- [x] All required fields present
- [x] slug: tensor-cores correct
- [x] track: cuda-hpc correct

CONTENT QUALITY
- [ ] Line 185: incorrect TF32 API

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (6 items)
- [x] "Interview patterns" (3 questions)
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [CRITICAL] Line 314: "FP8 E5M2: 2-bit exponent, 5-bit mantissa" — WRONG. E5M2 means 5-bit Exponent, 2-bit Mantissa. The bit counts are reversed.
- [MAJOR] Line 185: `cudaSetDeviceFlags(cudaDeviceEnablePeerAccess)` described as enabling TF32. This is completely wrong. `cudaDeviceEnablePeerAccess` enables peer GPU memory access. TF32 is enabled via `cublasSetMathMode` or PyTorch flags.
- [x] FP16 vs BF16 vs TF32 format table (line 175-179) is correct
- [x] Hardware throughput table accurate

ISSUES FOUND:
- CRITICAL: FP8 E5M2 mantissa/exponent bits reversed in Key Numbers table
- MAJOR: Wrong CUDA API for enabling TF32 Tensor Cores

VERDICT: NEEDS_MAJOR_FIX — correct E5M2 format description, fix TF32 API
```

---

### cuda-hpc/articles/cutlass

```
FRONTMATTER
- [x] All required fields present (slug, title, track, type, cluster, difficulty, estimatedMinutes, status)
- [x] slug: cutlass correct
- [x] track: cuda-hpc correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (8 items)
- [x] "Interview patterns" (4 questions with detailed answers)
- [x] "Further reading" with real links

TECHNICAL ACCURACY
- [x] Three-level tiling hierarchy accurately described
- [x] WGMMA vs WMMA distinction correct
- [x] CuTe DSL accurately described
- [ ] Line 308: YouTube URL `https://www.youtube.com/watch?v=cute36` is fabricated
- [ ] Line 309: YouTube URL `https://www.youtube.com/watch?v=cute57` is fabricated

ISSUES FOUND:
- MINOR: Two fabricated YouTube URLs in Further Reading

VERDICT: NEEDS_MINOR_FIX — replace fabricated YouTube URLs with real CUDA Mode lecture links or remove
```

---

### gpu-llm/theory/attention

```
FRONTMATTER
- [x] All required fields present
- [x] slug: attention correct
- [x] track: gpu-llm correct
- [ ] cluster: "cluster-llm-kernels" — other gpu-llm files use "llm-kernels" (without "cluster-" prefix). Inconsistency.

CONTENT QUALITY
- [x] No draft text
- [x] Calculations are correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (4 patterns)
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [x] Attention formula correct
- [x] KV cache memory calculations correct
- [x] GQA vs MQA analysis accurate

ISSUES FOUND:
- MINOR: cluster frontmatter value "cluster-llm-kernels" is inconsistent with other gpu-llm files that use "llm-kernels"

VERDICT: NEEDS_MINOR_FIX — normalize cluster value to "llm-kernels"
```

---

### gpu-llm/theory/kernel-fusion

```
FRONTMATTER
- [x] All required fields present
- [x] slug: kernel-fusion correct
- [x] track: gpu-llm correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [x] "Why This Matters for Interviews" present
- [x] "Common Misconceptions" with ❌/✓ format (4 items)
- [x] "Interview Patterns" (3 patterns)
- [x] "Further Reading" present

TECHNICAL ACCURACY
- [CRITICAL] Line 318: Key Numbers table: "Max Shared Memory per SM | 164 KB | **232 KB** | 232 KB" — H100 max shared memory is **228 KB**, not 232 KB. A100 is 164 KB (correct). B200 value should be confirmed.
- [CRITICAL] Line 319: "L2 Cache Size | 6 MB | **20 MB** | 50 MB" — A100 L2 is 40 MB (not 6 MB), H100 L2 is 50 MB (not 20 MB). Both A100 and H100 values are wrong.

ISSUES FOUND:
- CRITICAL: H100 shared memory listed as 232 KB (correct: 228 KB)
- CRITICAL: A100 L2 cache listed as 6 MB (correct: 40 MB); H100 L2 listed as 20 MB (correct: 50 MB)

VERDICT: NEEDS_MAJOR_FIX — correct shared memory and L2 cache numbers in key numbers table
```

---

### gpu-llm/theory/kv-cache-design

```
FRONTMATTER
- [x] All required fields present
- [x] slug: kv-cache-design correct
- [x] track: gpu-llm correct

CONTENT QUALITY
- [x] No draft text
- [x] Memory calculations are correct

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (4 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [x] KV cache formula correct
- [x] GQA memory reduction analysis correct
- [x] paged attention description accurate
- [x] LLaMA-3 70B KV cache calculations verified

ISSUES FOUND: None

VERDICT: PASS
```

---

### gpu-llm/theory/tensor-parallelism

```
FRONTMATTER
- [x] All required fields present
- [x] slug: tensor-parallelism correct
- [x] track: gpu-llm correct

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct (PyTorch autograd)

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (5 questions)
- [x] "Further reading" present (descriptions, some without URLs)

TECHNICAL ACCURACY
- [x] Column-parallel / row-parallel math correct
- [x] f/g operator conjugate pair description accurate
- [x] Communication cost analysis correct (2 all-reduces per layer)
- [x] Megatron-LM efficiency numbers accurate

ISSUES FOUND:
- MINOR: Further reading "llm.c nccl_all_reduce.cu" lacks a real URL

VERDICT: NEEDS_MINOR_FIX — add URL for llm.c reference
```

---

### gpu-llm/theory/zero-memory-opt

```
FRONTMATTER
- [x] All required fields present
- [x] slug: zero-memory-opt correct
- [x] track: gpu-llm correct

CONTENT QUALITY
- [x] No draft text

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (3 items)
- [x] "Interview patterns" (5 questions)
- [x] "Further reading" present

TECHNICAL ACCURACY
- [x] ZeRO-1/2/3 memory formulas correct
- [x] Communication analysis (2Ψ for baseline/ZeRO-1/2, 3Ψ for ZeRO-3) correct
- [x] Memory reduction factors at 64 GPUs correct

ISSUES FOUND: None

VERDICT: PASS
```

---

### gpu-llm/articles/hopper-tma-wgmma

```
FRONTMATTER
- [x] All required fields present
- [x] slug: hopper-tma-wgmma correct
- [x] track: gpu-llm correct

CONTENT QUALITY
- [x] No draft text
- [x] PTX code examples accurate

STRUCTURE
- [x] "Why this matters for interviews" present
- [x] "Common misconceptions" with ❌/✓ format (6 items)
- [x] "Interview patterns" (3 questions)
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [CRITICAL] Line 335: Key numbers table: "Max warps per SM | 2048" — WRONG. Max warps per SM on H100 is **64**. 2048 is the max *threads* per SM (64 warps × 32 threads). The row header says "warps" so this is a factual error.
- [x] TMA descriptor creation is accurate
- [x] WGMMA tile shapes are correct
- [x] FlashAttention 3 performance numbers appear reasonable
- [ ] Line 337: "FP16 BFLOPS (Tensor Core) | 989 TFLOPS" — header says "BFLOPS" which is a typo (should be TFLOPS)

ISSUES FOUND:
- CRITICAL: Max warps per SM stated as 2048 (correct: 64)
- MINOR: Typo "BFLOPS" in key numbers table header

VERDICT: NEEDS_MAJOR_FIX — correct max warps per SM, fix typo
```

---

### ml-systems/theory/ml-inference-basics

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Technical content is accurate

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" present with real URLs
- [x] Content body is well-structured

TECHNICAL ACCURACY
- [x] Prefill vs decode distinction correct
- [x] KV cache size formula correct
- [x] TTFT / ITL definitions correct

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing "Why this matters for interviews" section
- MAJOR: Missing "Common misconceptions" section
- MAJOR: Missing "Interview patterns" section

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```

---

### ml-systems/theory/quantization-intro

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Technical content is accurate

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" with real paper URLs

TECHNICAL ACCURACY
- [x] PTQ algorithm descriptions accurate
- [x] Quantization format table accurate
- [x] Calibration description correct

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing all three required structural sections

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```

---

### kubernetes-ai/theory/gpu-operator

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Technical content is accurate and practical

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" with real NVIDIA documentation URLs

TECHNICAL ACCURACY
- [x] GPU Operator architecture accurately described
- [x] MIG profiles for A100 correct
- [x] DCGM metrics are real prometheus metric names

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing all three required structural sections

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```

---

### kubernetes-ai/theory/k8s-basics

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] YAML examples are syntactically correct

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" with real Kubernetes documentation URLs

TECHNICAL ACCURACY
- [x] Pod / Deployment / Service / ConfigMap / Secret descriptions accurate
- [x] GPU resource request example correct (nvidia.com/gpu)
- [x] Liveness/readiness probe configuration accurate

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing all three required structural sections

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```

---

### foundations/theory/memory-model

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Technical content is accurate

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [x] Cache hierarchy latencies correct
- [x] NUMA description accurate
- [x] SoA vs AoS example correct

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing all three required structural sections

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```

---

### foundations/theory/profiling-basics

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Commands are accurate

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section (Workflow Summary is present but is not interview Q&A format)
- [x] "Further reading" with real NVIDIA documentation URLs

TECHNICAL ACCURACY
- [x] nsys / ncu distinction and commands accurate
- [x] Warp stall reasons and descriptions correct
- [x] Roofline model description accurate
- [ ] Line 95: H100 compute roof listed as "312 TFLOP/s FP16" — H100 FP16 Tensor Core throughput is 989 TFLOPS, not 312 TFLOPS. 312 is A100's BF16 Tensor Core throughput.

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields
- MAJOR: Missing all three required structural sections
- MINOR: Line 95 uses A100 figure for H100 Tensor Core throughput

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields, add required sections, fix H100 throughput
```

---

### foundations/theory/simd-basics

```
FRONTMATTER
- [x] slug, title, track, type, tags, status present
- [ ] MISSING: cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources

CONTENT QUALITY
- [x] No draft text
- [x] Code examples syntactically correct

STRUCTURE
- [ ] MISSING: "Why this matters for interviews" section
- [ ] MISSING: "Common misconceptions" with ❌/✓ format
- [ ] MISSING: "Interview patterns" section
- [x] "Further reading" with real URLs

TECHNICAL ACCURACY
- [x] AVX2 / SSE register widths correct
- [x] FMA throughput calculation correct (96 GFLOP/s per core at 3 GHz)
- [x] Masking description parallels GPU warp divergence correctly

ISSUES FOUND:
- MAJOR: Missing required frontmatter fields (cluster, difficulty, estimatedMinutes, interviewRelevance, author, sources)
- MAJOR: Missing all three required structural sections

VERDICT: NEEDS_MAJOR_FIX — add all missing frontmatter fields and required content sections
```
