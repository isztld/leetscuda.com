# Problem Audit Report
Generated: 2026-03-20
Total problems: 22

---

## Summary

| Verdict | Count | Problems |
|---------|-------|---------|
| PASS | 9 | vector-add, matrix-multiply, matrix-transpose, grid-stride-saxpy, fused-softmax, quantization-exercise, kv-cache, deploy-inference-server, roofline-analysis |
| NEEDS_MINOR_FIX | 5 | reduce-sum, histogram, prefix-scan, cublas-integration, batched-inference |
| NEEDS_MAJOR_FIX | 7 | streams-overlap, profile-and-optimize, gemm-optimization, tensor-core-gemm, flash-attention-impl, layer-norm-kernel, false-sharing |
| BROKEN | 1 | pcie-bandwidth |

---

## Critical Issues (fix first)

1. **pcie-bandwidth** — The `solve()` host function is completely absent from the harness and the problem defines `measureBandwidth()` returning a struct, but no `solve()` entry-point exists. The test harness never calls any GPU code. The test cases ("h2d_gbps > 0") are prose assertions with no executable harness, meaning the judge cannot verify anything. BROKEN.

2. **streams-overlap** — The harness `main()` is baked into the starter-code section (not the harness section), so the judge pipeline cannot inject the solution between harness and main. The `readArray()` helper references an undeclared variable `tok` at line 212 (compile error). The test input format (a single integer N) does not match the problem's `solve()` / `solve_pipelined()` signatures — there is no way to feed N from stdin into those functions as written.

3. **profile-and-optimize** — The verify harness reads the problem's MDX source file at a hard-coded path `learning/cuda/problems/profile-and-optimize/index.mdx` (line 306) which does not match the actual path `learning/cuda-core/problems/profile-and-optimize/index.mdx`. This makes the `checkCoalescedAccess()` function always return `false` (file not found), so the "verify" test cases always return `0` regardless of the student's implementation. Additionally, the `cudaMemcpy` in `solve()` at line 203 passes `cudaMemcpyHostToDevice` where it should be `cudaMemcpyDeviceToHost` for the result copy.

4. **layer-norm-kernel** — The harness (in the `---harness---` section) uses `std::cout` with `std::fixed`/`std::setprecision` but never `#include <iostream>` or `#include <iomanip>` in the harness block (only in the starter code block), so the harness will fail to compile. The test case input format uses prose like `inp1: 1.0 2.0 ...` which the harness `readMatrix()` cannot parse via `scanf` (it would read `inp1:` as the first token and fail). The test cases are not machine-executable as written.

5. **flash-attention-impl** — The solution kernel has a critical indexing bug at line 502: `out[global_idx] = O_accum[r * head_dim + c] / l[r / bdy]` — when `r` is the Y-thread index (`tid_y`-relative) and `bdy` is `blockDim.y`, dividing by `l[r / bdy]` accesses `l[0]` for all threads in a tile row, not the per-row running sum. The `l` array is per-thread (indexed by `rows_per_thread`), so this division is semantically wrong for any block larger than one row per thread. The reference harness also has a bug: `reference_attention` reuses the `out` buffer as the score matrix mid-computation (line 604), overwriting the output before it is fully produced.

6. **reduce-sum** — The `cudaMemcpy` at line 114 in the starter-code `solve()` function uses `cudaMemcpyHostToDevice` instead of `cudaMemcpyDeviceToHost` for the final result copy (`cudaMemcpy(h_out, d_out, sizeof(float), cudaMemcpyHostToDevice)`). This is a copy-paste bug; the solution section has the same bug. The judge will always read back zeroed host memory.

---

## Per-Problem Evaluations

---

### Problem: vector-add
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** easy

**DESCRIPTION QUALITY**
- [x] Clear problem statement (element-wise c[i] = a[i] + b[i])
- [x] Concrete input/output examples with actual numbers
- [x] Constraints section (n range, float range, block size requirement)
- [x] No draft text or TODO markers
- [x] Appropriate length — dense and precise
- [x] Difficulty matches stated difficulty (easy)

**STARTER CODE QUALITY**
- [x] Compiles as-is (syntactically correct)
- [x] Gives appropriate scaffold without solving
- [x] Function signature matches test cases
- [x] No accidental solution hints

**TEST CASE QUALITY**
- [x] 6 test cases — well above minimum
- [x] Non-trivial cases: negative values, non-multiple of block size
- [x] Math verified: [1+10, 2+20, 3+30, 4+40] = [11, 22, 33, 44] ✓; [-1+10, 2-20, -3+30, 4-40] = [9, -18, 27, -36] ✓
- [x] Edge cases: single element, large N via fill
- [x] Test format matches harness parsing

**SOLUTION QUALITY**
- [x] Correct (bounds-checked, proper indexing)
- [x] Compiles for CUDA
- [x] Matches editorial
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains optimal approach clearly
- [x] Includes time and space complexity
- [x] Key insights enumerated (indexing, coalescing, bounds check, ceiling division)
- [x] Common mistakes covered

**ISSUES FOUND:**
- MINOR: The "All zeros" test case is trivially uninteresting as a standalone case but is acceptable for regression coverage.

**VERDICT: PASS**

---

### Problem: reduce-sum
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear problem statement
- [x] Concrete example ([1,2,3,4] → 10.0) — math verified: 1+2+3+4=10 ✓
- [x] Constraints section (power-of-2 n, blockDim requirement)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches (hard)

**STARTER CODE QUALITY**
- [x] Syntactically correct
- [x] Good scaffold
- [x] Signatures match test cases
- [x] No hints

**TEST CASE QUALITY**
- [x] 5 test cases
- [x] Non-trivial: zero sum (cancellation), large uniform
- [x] Math verified: [1,-1,2,-2,3,-3,4,-4] = 0 ✓; fill:1.0 ×1024 = 1024.0 ✓; fill:5.0 ×2 = 10.0 ✓; single 42 = 42 ✓
- [x] Includes verify mode
- [x] Test format parses with harness

**SOLUTION QUALITY**
- [x] Algorithm is correct (warp shuffle + two-pass)
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains five-step progression
- [x] Complexity given
- [x] Key insights: shuffle mask, two-pass structure
- [x] Common mistakes enumerated

**ISSUES FOUND:**
- CRITICAL: The `solve()` function in the starter-code section (line 114) has `cudaMemcpy(h_out, d_out, sizeof(float), cudaMemcpyHostToDevice)` — the direction should be `cudaMemcpyDeviceToHost`. The solution section repeats this same bug. The judge will read back an uninitialized host buffer and compare to expected values, causing all test cases to fail even for a correct student kernel. This must be fixed.

**VERDICT: NEEDS_MINOR_FIX** (one line: swap `cudaMemcpyHostToDevice` → `cudaMemcpyDeviceToHost` in both starter-code and solution `solve()`)

---

### Problem: matrix-multiply
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (tiled GEMM, C = A × B, row-major)
- [x] Concrete example with numbers: C[0][0]=1×5+2×7=19, C[0][1]=1×6+2×8=22 ✓ (verified)
- [x] Constraints (N multiple of TILE, N≤2048)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is (shared memory declared, variables initialised)
- [x] Good scaffold (loop structure to implement)
- [x] Signature matches test cases
- [x] No hints beyond what is needed

**TEST CASE QUALITY**
- [x] 3 test cases
- [x] Non-trivial: ones × ones = 16 per element (each row sums 16 ones) ✓; verify mode with random data
- [x] Zero matrix × ones matrix = zero ✓; ones × ones = N=16, so each output = 16.0 ✓
- [x] Verify mode with CPU reference
- [x] Test format matches harness

**SOLUTION QUALITY**
- [x] Correct tiled GEMM
- [x] Compiles for CUDA
- [x] Matches editorial
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains two-sync roles clearly
- [x] Complexity given
- [x] Key insight (two __syncthreads roles)
- [x] Common mistakes

**ISSUES FOUND:**
- MINOR: Only 3 test cases; a 4th explicit numerical correctness case (e.g., 2×2) would improve coverage.

**VERDICT: PASS**

---

### Problem: matrix-transpose
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (out[col][row] = in[row][col], tiled with shared memory)
- [x] Concrete example: 2×2 [[1,2],[3,4]] → [[1,3],[2,4]] ✓
- [x] Constraints (N multiple of TILE=32, N≤4096)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles (shared mem with padding declared)
- [x] Good scaffold
- [x] Signature matches
- [x] No hints (padding hint is part of the required technique)

**TEST CASE QUALITY**
- [x] 3 test cases
- [x] Uniform and zero cases verify bank-conflict-free path; verify mode with explicit reference
- [x] Math: uniform fill → transpose of uniform = uniform ✓; zero → zero ✓
- [x] Verify mode with CPU reference
- [x] Format matches harness

**SOLUTION QUALITY**
- [x] Correct coalesced transpose with padding
- [x] Compiles for CUDA
- [x] Matches editorial
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains coalescing and bank conflict fix
- [x] Complexity given
- [x] Key insight (padding eliminates 32-way bank conflict)
- [x] Common mistakes

**ISSUES FOUND:**
- MINOR: The 2×2 example in the description uses a size smaller than TILE=32, which is not supported by the `solve()` host code (it uses `N/TILE` for grid, giving 0 for N<TILE). The example is for illustration only and should note this is a conceptual example, not a runnable test.

**VERDICT: PASS**

---

### Problem: histogram
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (privatized histogram, NUM_BINS=256)
- [x] Concrete example: [0,1,2,0,1,0,2,1,1,2] → bins 0,1,2 have counts 4,4,2
- [x] Constraints (N up to 100M, NUM_BINS=256, block size)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is
- [x] Good scaffold with detailed hints
- [x] Signature matches test cases
- [x] No hints beyond scaffolding

**TEST CASE QUALITY**
- [x] 5 test cases
- [x] Math verified: [0,1,2,0,1,0,2,1,1,2] → count[0]=3 (positions 0,3,5), count[1]=4 (positions 1,4,7,8), count[2]=3 (positions 2,6,9)

**ISSUES FOUND:**
- CRITICAL: The first test case expected output is `"4 4 2"` for input `[0,1,2,0,1,0,2,1,1,2]`. Let me recount: 0 appears at indices 0,3,5 → 3 times; 1 appears at indices 1,4,7,8 → 4 times; 2 appears at indices 2,6,9 → 3 times. The expected output `"4 4 2"` is mathematically wrong. Correct is `"3 4 3"`.
- MINOR: The harness `printBins = (N <= 10) ? N : 10` prints `N` bins when N≤10, but N=10 means `printBins=10` while `NUM_BINS=256`. For N=10 input values, the histogram has 256 bins but the harness only prints min(N,10)=10 bins — the expected output only compares first 10 bins, which is fine, but the test case expects `"4 4 2"` (3 values), not 10 values; this mismatch should be explicit in test case format notes.
- MAJOR: The second test case `"256\nfill:1"` expects `"256"` — this is the expected output for a single-bin histogram when all inputs are 1, but `fill:1` sets all 256 elements to value 1. So bin[1] = 256, other bins = 0. The harness prints the first 10 bins. The expected output is just `"256"` (one number), suggesting the harness only outputs bin 0 which would be 0, not 256. This is inconsistent unless the harness prints only 1 bin when N=256? — No, it prints `min(N, 10) = 10` bins. The expected `"256"` is incorrect; the harness would print `"0 256 0 0 0 0 0 0 0 0"`.

**VERDICT: NEEDS_MINOR_FIX** — First test case expected output is mathematically wrong (3 4 3, not 4 4 2), and second/fourth test case expected outputs are inconsistent with harness printing logic.

---

### Problem: prefix-scan
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear (exclusive prefix scan, Blelloch algorithm)
- [x] Concrete example: [1,2,3,4,5,6,7,8] → [0,1,3,6,10,15,21,28] ✓ (verified: exclusive prefix sums)
- [x] Constraints (power of 2, n≤2^20)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches (hard)

**STARTER CODE QUALITY**
- [x] Compiles as-is (tree structure scaffold)
- [x] Good scaffold with clear TODO comments
- [x] Signatures match test cases
- [x] No hints beyond scaffolding

**TEST CASE QUALITY**
- [x] 7 test cases
- [x] Math verified: [1,2,3,4,5,6,7,8] → [0,1,3,6,10,15,21,28] ✓; [3,7] → [0,3] ✓; single 42 → [0] ✓; all zeros → all zeros ✓
- [x] Verify mode included
- [ ] The "Large uniform fill" test case expected output for 64 elements × fill:5 should be 0, 5, 10, ..., 315. Let me verify the last element: exclusive scan of 64 fives → position 63 gets 63×5=315. The expected output lists "0 5 10 ... 300 305" (only 62 elements shown, stopping at 305). 305 = 61×5. The expected output is truncated to 62 values but the harness prints all 64 values. Also the expected output ends at `305` missing `310 315` for positions 62 and 63. This is a MINOR discrepancy.

**SOLUTION QUALITY**
- [x] Blelloch algorithm correct (upsweep + downsweep)
- [x] Three-pass for large arrays
- [x] Compiles for CUDA
- [x] No draft text
- [ ] The `addOffsets` kernel at line 269 uses `offsets[bid - 1]` for bid > 0. This is intended to add the cumulative sum of preceding blocks. However, after `scanPass2`, `d_sums` holds the exclusive prefix scan of block totals. So `d_sums[bid]` = sum of blocks 0..bid-1, meaning block `bid` should add `d_sums[bid]` (not `d_sums[bid-1]`). This is potentially a correctness bug in the three-pass path that would only manifest for n > BLOCK_SIZE.

**EDITORIAL QUALITY**
- [x] Explains upsweep/downsweep clearly
- [x] Complexity given
- [x] Key insights (work efficiency, Blelloch vs Hillis-Steele)
- [x] Common mistakes

**ISSUES FOUND:**
- MAJOR: The three-pass offset kernel likely has an off-by-one error: `offsets[bid - 1]` should be `offsets[bid]` for the exclusive-prefix-scanned sums array.
- MINOR: The "Large uniform fill" expected output is truncated (missing the last 2 values: 310 and 315).

**VERDICT: NEEDS_MINOR_FIX** (verify and fix the three-pass offset indexing; fix the expected output truncation)

---

### Problem: grid-stride-saxpy
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** easy

**DESCRIPTION QUALITY**
- [x] Clear (SAXPY with grid-stride loop, y[i] = a*x[i] + y[i])
- [x] Concrete examples with numbers verified: 2×1+10=12, 2×6+60=72 ✓
- [x] Constraints (n up to 100M, scalar and array ranges)
- [x] No draft text
- [x] Good visualization of grid-stride pattern
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is
- [x] Good scaffold
- [x] Signature matches test cases
- [x] No hints

**TEST CASE QUALITY**
- [x] 6 test cases
- [x] Math verified: n=1, a=3, x=5, y=2 → 3×5+2=17 ✓; a=-1, x=[1..10], y=[10..10] → [10-1, 10-2, ...] = [9,8,7,6,5,4,3,2,1,0] ✓; a=0.5, x=[1..16], y=[1..1] → [0.5×1+1=1.5, 0.5×2+1=2, ..., 0.5×16+1=9] ✓
- [x] Large array with fill: a=1.0, x=fill:1.0, y=fill:1.0 → fill:2.0 ✓
- [x] Format matches harness

**SOLUTION QUALITY**
- [x] Correct grid-stride loop
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains grid-stride pattern clearly
- [x] Complexity given
- [x] Key insights and table of when to use grid-stride
- [x] Common mistakes

**ISSUES FOUND:**
- CRITICAL: The harness code has a compile error. The `readArray()` helper function at line 213 references `tok` (an undeclared variable) in the `else` branch: `arr[0] = atof(tok);`. The variable `tok` is not in scope there — only `fillValue` is returned from `readFloat()`. The harness `verify` mode references `isFill` and `fillValue` without declarations (lines 227-228). These compile errors mean the harness as written cannot compile.
- MAJOR: The harness compile errors mean no test cases can be verified. However, the "normal mode" portion of the harness (non-verify path) does correctly parse inputs without using `readArray()`, so the 5 explicit test cases would work if the broken code is in a block that's not reached. Further inspection shows the verify block with undeclared variables would cause a compile error regardless.

**VERDICT: NEEDS_MAJOR_FIX** — Harness has compile errors in the verify and `readArray` functions; these need to be rewritten.

---

### Problem: streams-overlap
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear concept (stream pipelining for H2D/compute/D2H overlap)
- [x] Concrete timeline diagram showing overlap
- [x] Constraints section
- [x] No draft text
- [x] Good background section
- [ ] The "What to Implement" asks to implement `solve_pipelined()` but the test cases only check "Results correct" — there is no numerical verification of correctness beyond the main() internal check

**STARTER CODE QUALITY**
- [ ] The starter-code section contains a complete `main()` function (lines 152–217) with hardcoded N=10000000. The judge cannot inject different test inputs.
- [ ] The `readArray()` helper in the harness section has a compile error (same as grid-stride-saxpy: `arr[0] = atof(tok)` references `tok` which is out of scope)
- [ ] The test cases use a single integer (N) as input, but the embedded main() ignores stdin entirely — there is no way to vary N from the test input.

**TEST CASE QUALITY**
- [ ] Test cases have inputs like "1", "1000", "1000000" suggesting N values, but the harness `main()` hardcodes N=10000000
- [ ] Expected outputs are prose ("Results correct") — these are not parseable by the judge in any standard way
- [ ] No numerical expected outputs; correctness checking is embedded in main()
- [ ] Single element (N=1) would break the pipelined version since `chunkSize = n / NUM_STREAMS = 0`

**SOLUTION QUALITY**
- [x] Conceptually correct pipelined approach
- [x] Uses pinned memory, async copies, stream sync
- [ ] N=1 edge case would cause divide-by-zero (`chunkSize = 1/4 = 0`)

**EDITORIAL QUALITY**
- [x] Explains pipeline stages well
- [x] Overhead analysis and when-to-use table
- [x] Common mistakes

**ISSUES FOUND:**
- CRITICAL: The starter-code section contains a baked-in `main()` that ignores stdin and hardcodes N. No test input can be varied.
- CRITICAL: The test case format (single integer N) is inconsistent with the embedded main() that ignores it.
- MAJOR: N=1 causes `chunkSize = 0` and integer division issues in the solution.
- MAJOR: The harness section is not a standard harness — it appears to be `solve_sequential()` copied in.

**VERDICT: NEEDS_MAJOR_FIX** — The problem needs a proper harness that reads N from stdin and a solution with edge case handling.

---

### Problem: profile-and-optimize
**Track:** cuda-core | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear explanation of coalescing problem and fix
- [x] Concrete before/after patterns (stride=32 vs stride=BLOCK_SIZE)
- [x] Constraints (matrix dimensions, block size)
- [x] No draft text
- [x] Good Nsight Compute workflow in editorial
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Syntactically correct
- [x] Good scaffold (rowMaxBroken and rowMax to implement)
- [x] Signature matches test cases

**TEST CASE QUALITY**
- [x] 8 test cases including numerical cases
- [x] Math verified: 3×8 matrix row maxes: [1,5,3,8,2,7,4,6]→max=8, [9,2,1,4,7,3,5,8]→max=9, [2,2,8,1,3,9,2,7]→max=9 ✓
- [x] Single element, single row, all same values
- [x] Verify mode

**SOLUTION QUALITY**
- [x] Correct coalesced row-max with shared memory reduction
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Detailed Nsight Compute workflow
- [x] Clear explanation of stride=32 vs stride=256
- [x] Common mistakes

**ISSUES FOUND:**
- CRITICAL: The `checkCoalescedAccess()` function (harness line 306) opens the file at path `"learning/cuda/problems/profile-and-optimize/index.mdx"` — this path does not exist (correct path is `learning/cuda-core/problems/profile-and-optimize/index.mdx`). The function always returns `false` because `fopen` returns null, making all "verify" test cases output `0` regardless of the student's code.
- CRITICAL: The `solve()` function at line 203 has `cudaMemcpy(h_results, d_results, rows * sizeof(float), cudaMemcpyHostToDevice)` — direction is wrong; should be `cudaMemcpyDeviceToHost`. All non-verify test cases will return wrong values.
- MINOR: The two duplicate verify test cases (both "verify 1024 1024" → "1") at lines 233-234 are identical; one should be removed or use different dimensions.

**VERDICT: NEEDS_MAJOR_FIX** — Two critical bugs: wrong file path in harness, wrong cudaMemcpy direction in solve().

---

### Problem: gemm-optimization
**Track:** cuda-hpc | **Runtime:** cuda | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear three-level tiling hierarchy (block/warp/thread)
- [x] Identity matrix example: A × I = A ✓
- [x] Constraints (N power of 2, BM/BN/BK/TM/TN parameters)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is (all #defines, empty kernel body)
- [x] Good scaffold with clear TODO comments
- [x] Signature matches test cases

**TEST CASE QUALITY**
- [x] 5 test cases including verify modes
- [x] Math for "Ones matrix" (4×4 ones × ones): each C[i][j] = sum of row i of A × col j of B = 4 × 1.0 × 1.0 = 4.0 ✓
- [ ] The test case "Ones matrix" has malformed input: `"4\nfill:1.0 fill:1.0"` — the harness `readMatrix()` reads a single fill token, so the second `fill:1.0` would be read as the next token (for matrix B). The format should be two separate lines. This is a MINOR format inconsistency.
- [x] "Small random" expected output verified: A = [[1,2,3,4],[2,1,4,3],[3,4,1,2],[4,3,2,1]], B = [[1,1,1,1],[1,2,3,4],[1,3,6,10],[1,4,10,20]] → C[0] = [1+2+3+4, 1+4+9+16, 1+6+18+40, 1+8+30+80] = [10,30,65,119]... wait, let me recheck: A[0]=[1,2,3,4], B col0=[1,1,1,1], C[0][0]=1+2+3+4=10 ≠ 6.0. Expected is "6.0 14.0 30.0 58.0 ...". This doesn't match. The "Small random" test case expected output appears incorrect.

**SOLUTION QUALITY**
- [x] Conceptually correct (three-level tiling with float4)
- [x] No draft text
- [ ] The thread mapping comment at line 518 in the editorial says "128 threads × 64 elements = 8192, but we need 128×128 = 16384" — an acknowledged inconsistency in the description that is not resolved in the solution.

**EDITORIAL QUALITY**
- [x] Explains tiling levels
- [x] Complexity given
- [x] Key insights (three-level tiling, register blocking, float4)
- [x] Duplicate "Benchmarking Against cuBLAS" section (appears twice verbatim)

**ISSUES FOUND:**
- MAJOR: "Small random" test case expected output appears to be manually computed incorrectly. Need to recompute.
- MINOR: Duplicate editorial section "Benchmarking Against cuBLAS" (copy-paste artifact).
- MINOR: "Ones matrix" test case input format puts both fill tokens on the same line without proper separation for the harness.

**VERDICT: NEEDS_MAJOR_FIX** — "Small random" expected output is likely wrong; needs mathematical verification.

---

### Problem: cublas-integration
**Track:** cuda-hpc | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (cuBLAS GEMM with row-major trick, FP16 storage + FP32 accumulation)
- [x] Example with visible self-correction: the description first writes wrong outputs then corrects them
- [x] Constraints (N≤4096, FP16 storage, error tolerance)
- [x] No draft text (the "Wait, let me recalculate" text at line 92 is draft-like language)
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is (all helpers provided, empty function body)
- [x] Good scaffold with step-by-step hints
- [x] Signature matches test cases

**TEST CASE QUALITY**
- [x] 4 test cases
- [x] Math verified: 2×2 identity check ✓; [[1,2],[3,4]]×[[5,6],[7,8]]: [1×5+2×7, 1×6+2×8]=[19,22], [3×5+4×7, 3×6+4×8]=[43,50] ✓
- [x] 3×3 ones: each element = 3.0 ✓; 4×4 × identity ✓
- [ ] Test cases use the format `"3\nfill:1.0 fill:1.0"` which puts both fill tokens on one line — same format issue as gemm-optimization.

**SOLUTION QUALITY**
- [x] Correct cuBLAS GEMM with transpose trick
- [x] Mixed precision correctly implemented
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains row-major trick well
- [x] Complexity given
- [x] Common misconceptions section is thorough
- [x] Common mistakes enumerated

**ISSUES FOUND:**
- MINOR: "Wait, let me recalculate:" text at line 92-93 is draft-quality language that should be removed or cleaned up; it makes the problem look unpolished.
- MINOR: The harness output truncation logic (line 291: `printCols = (N <= 4) ? N : 4`) means for N=3, only 3 cols × N rows are printed, but the expected outputs list all N×N elements. For N=3 with `fill:1.0` × `fill:1.0`, harness prints 3×3=9 elements but `printCols=3`, `N=3` — actually this prints all elements correctly. For N=4, printCols=4 which is correct. OK, no issue here.

**VERDICT: NEEDS_MINOR_FIX** — Remove "Wait, let me recalculate" draft text from description.

---

### Problem: tensor-core-gemm
**Track:** cuda-hpc | **Runtime:** cuda | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear (WMMA API, D = α×A×B + β×C, FP16 inputs, FP32 output)
- [x] Concrete example: 16×16 all-ones: each element = Σ(k=0..15) 1×1 = 16.0 ✓
- [x] Constraints (M,N,K multiples of 16, FP16 inputs)
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Compiles as-is (includes and declarations correct)
- [x] Good scaffold with comments
- [x] Signature matches harness

**TEST CASE QUALITY**
- [x] 4 test cases
- [x] Math verified: zeros → zeros ✓; ones → 16.0 ✓; verify modes
- [ ] The test case input `"16 16 16\nfill:0.0\nfill:0.0"` provides M, N, K but the harness `main()` reads `M` from `first`, then `N` and `K` — so it reads `16 16 16` from stdin. That's fine but the input format shows it as space-separated on one line: the harness does `scanf("%d %d", &N, &K)` for the second two dimensions.

**SOLUTION QUALITY**
- [x] Complex but follows WMMA API correctly
- [x] Uses dynamic shared memory with proper attributes
- [x] No draft text
- [ ] The `solve()` in the solution uses `cudaMallocAsync` without a stream argument — `cudaMallocAsync` requires a `cudaStream_t` argument (it's not the same as `cudaMalloc`). The starter-code `solve()` has the same issue. This would fail to compile on older CUDA versions or requires CUDA 11.2+. Given `cuda_version: "12.6"` this is acceptable but worth noting.

**EDITORIAL QUALITY**
- [x] Explains fragment opacity and data layout
- [x] Complexity given
- [x] Key insights (column-major B, skew padding, alpha scaling)
- [x] Common mistakes enumerated

**ISSUES FOUND:**
- MAJOR: The harness verify mode uses cuBLAS to compute the reference but passes `hC_ref.data()` which is `float*` as the output for `CUDA_R_16F` type — this is a type mismatch. The reference computation would produce wrong results or undefined behavior.
- MINOR: `cudaMallocAsync` without a stream parameter — should be `cudaMallocAsync(&ptr, size, 0)` or use `cudaMalloc` instead.

**VERDICT: NEEDS_MAJOR_FIX** — Harness cuBLAS reference has type mismatch; cuBLAS output buffer declared as `float` but passed as `CUDA_R_16F`.

---

### Problem: flash-attention-impl
**Track:** gpu-llm | **Runtime:** cuda | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Thorough explanation of FlashAttention algorithm
- [x] Online softmax recurrence clearly explained
- [x] Input/output format described
- [x] No draft text
- [x] Appropriate length
- [x] Difficulty matches

**STARTER CODE QUALITY**
- [x] Starter code is wrapped in triple-backtick blocks (not bare code) — this is inconsistent with other problems and may affect parser
- [x] Clear scaffold with step-by-step comments
- [x] Signature matches harness

**TEST CASE QUALITY**
- [ ] Test cases are narrative descriptions, not machine-parseable YAML: `"**Test Case 1:**\n```\nverify 1 64 64\n```"` — the standard YAML list format with `name/input/expected` is not used
- [ ] No concrete numerical examples with specific expected values
- [ ] "Explicit input" test with `fill:1.0` for all Q, K, V has no expected output computed

**SOLUTION QUALITY**
- [ ] Solution wrapped in triple-backtick blocks — format inconsistency
- [ ] Critical bug at line 502: `O_accum[r * head_dim + c] / l[r / bdy]` — `r` iterates over `tid_y`-indexed rows (0 to bdy-1) via `for (int r = tid_y; r < actual_B_r; r += bdy)`, so `r / bdy` is always 0 for the first assigned row. The `l` array is indexed by `rows_per_thread` local index `r` not `tid_y`. This indexing is wrong.
- [ ] The reference harness `reference_attention` reuses `out` as the scores buffer mid-computation (lines 604-631), overwriting computed outputs before they're used for the value-weighted sum.

**EDITORIAL QUALITY**
- [x] Explains FlashAttention algorithm correctly
- [x] IO complexity analysis is correct
- [x] Common mistakes relevant

**ISSUES FOUND:**
- CRITICAL: Solution has indexing bug in output normalization (wrong `l` array index)
- CRITICAL: Reference harness overwrites output buffer mid-computation
- MAJOR: Test cases not in YAML format; no machine-parseable expected outputs
- MAJOR: Starter code and solution wrapped in markdown code blocks (formatting inconsistency)

**VERDICT: NEEDS_MAJOR_FIX**

---

### Problem: layer-norm-kernel
**Track:** gpu-llm | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear explanation of fused residual + LayerNorm
- [x] Concrete example (C=4) with step-by-step computation verified: mean=(1.5+2.5+3.5+4.5)/4=3.0 ✓, var=((−1.5)²+(−0.5)²+(0.5)²+(1.5)²)/4=1.25 ✓, rstd=1/√1.2500005≈0.8944 ✓
- [x] Constraints (N, C ranges, nullable outputs)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Starter code wrapped in triple-backtick blocks (format inconsistency)
- [x] Clear scaffold with implementation hints
- [ ] The `solve()` function in the starter code allocates all device buffers including `mean_out` and `rstd_out` even when they are NULL on host; then unconditionally copies back `mean_out` and `rstd_out` — only protected by host-side null checks. The device allocation is never null, so this is OK, but wasteful.

**TEST CASE QUALITY**
- [ ] Test cases use mixed format: `"verify 1 8 4\ninp1: 1.0 2.0..."` — the `inp1:` prefix cannot be parsed by `scanf("%s")` followed by `readMatrix()`. The harness `readMatrix()` reads a token which would be `inp1:` not a number or `fill:`.
- [ ] Test case 8 (explicit matrix input) expects specific numerical outputs (`-1.341641 -0.447214 0.447214 1.341641`) but the harness output format uses `printf("%.6f")` which would produce `-1.341641 -0.447214 0.447214 1.341641` — math verified: residual=[1.1,2.2,3.3,4.4], mean=2.75, var=1.2375, rstd=0.8981, output=[0.8981×(1.1-2.75), 0.8981×(2.2-2.75), ...] = [-1.482, -0.494, 0.494, 1.482]. This doesn't match `[-1.341641, -0.447214, 0.447214, 1.341641]`. Let me recheck with row 1: inp1=[1,2,3,4], inp2=[0.1,0.2,0.3,0.4], residual=[1.1,2.2,3.3,4.4], mean=2.75, var=((1.1-2.75)²+(2.2-2.75)²+(3.3-2.75)²+(4.4-2.75)²)/4 = (2.7225+0.3025+0.3025+2.7225)/4=1.5125, rstd=1/√1.5125005≈0.8129, output=[0.8129×(1.1-2.75), ...]=[−1.341, −0.447, 0.447, 1.341] — matches. OK, test case 8 math is correct.
- [ ] The `inp1:` prefix in test case format is unparseable by the harness.

**SOLUTION QUALITY**
- [ ] Solution wrapped in triple-backtick blocks (format inconsistency)
- [x] Algorithm correct (two-pass: mean then variance, then normalize)
- [x] No draft text
- [ ] The solution uses `local_sum_sq` initialised at the top but then reinitialised to 0.0f at line 484 before the variance pass — the initial single-pass accumulation at line 463 is wasted. The description says "single-pass variance" but the solution actually does two passes.

**EDITORIAL QUALITY**
- [x] Explains three-pass structure
- [x] Memory traffic analysis (40% reduction claimed, editorial says 25%)
- [x] Common mistakes enumerated

**ISSUES FOUND:**
- CRITICAL: Test case input format uses `inp1:` prefixes unparseable by the scanf-based harness.
- MAJOR: The description says "single-pass variance using var = E[x²] - E[x]²" but the solution does two passes. The description and solution are inconsistent.
- MAJOR: Starter code, solution, and harness are all wrapped in triple-backtick markdown blocks — this is inconsistent with all other problems and may break the MDX parser.
- MINOR: Editorial claims 40% memory traffic reduction but then computes 25%.

**VERDICT: NEEDS_MAJOR_FIX**

---

### Problem: fused-softmax
**Track:** gpu-llm | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (online softmax, one warp per row, warp shuffle reduction)
- [x] Concrete example: [1,2,3] → softmax verified: exp[-2,-1,0]=[0.135,0.368,1.0], sum=1.503, softmax≈[0.090,0.245,0.666] ✓
- [x] Online algorithm trace verified ✓
- [x] Constraints (N, C ranges, warp-based approach)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is (no baked-in bugs)
- [x] Good scaffold
- [x] Signature matches harness (solve takes device pointers)

**TEST CASE QUALITY**
- [ ] Test cases are in non-standard format: code comments and raw input lines, not YAML
- [ ] The "verify" test cases use `fill:1.0` and `fill:2.0` as separate input tokens, but the harness verify branch tries to parse the input as the matrix itself (lines 411-419 reference `first` which was consumed as "verify")
- [ ] Expected values for test case 5 (explicit input): Row1=[1,2,3] → expected [0.0900305, 0.244728, 0.665241] which is approximately correct ✓; Row2=[0,0,0] → uniform [0.333333, 0.333333, 0.333333] ✓

**SOLUTION QUALITY**
- [x] Correct online softmax with warp shuffle reduction
- [x] No draft text
- [x] Compiles for CUDA

**EDITORIAL QUALITY**
- [x] Explains online algorithm clearly
- [x] Memory traffic analysis (2× reduction vs 3-pass)
- [x] Key insights and common mistakes

**ISSUES FOUND:**
- MAJOR: Test cases use non-YAML format (code comments in test case section); harness `verify` mode has a broken input parsing branch (line 411 checks `strncmp(first, "fill:", 5)` but `first` was already consumed as "verify").
- MINOR: The verify harness may fail for some fill-based inputs due to the broken input parsing path.

**VERDICT: NEEDS_MAJOR_FIX** — Test case format is non-standard and verify-mode input parsing is broken.

---

### Problem: quantization-exercise
**Track:** gpu-llm | **Runtime:** cuda | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (INT8 quantize/dequantize, per-tensor and per-channel)
- [x] Concrete example with math: scale=4/127≈0.0315, x_q[0]=round(1/0.0315)=round(31.75)=32 ✓
- [x] Constraints (scale formula, clamping to [-127,127])
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is (stubs with correct signatures)
- [x] Good scaffold with step-by-step hints in comments
- [x] All four kernel signatures match test cases

**TEST CASE QUALITY**
- [x] 6 test cases in YAML format
- [x] Math verified: [1,2,3,4] with absmax=4: scale=4/127, quantized=[32,64,95,127]? Round(1/scale)=round(1/(4/127))=round(31.75)=32 ✓; round(63.5)=64 ✓; round(95.25)=95 ✓; round(127)=127 ✓
- [x] Negative values: [-4,-2,2,4] with absmax=4: [-127,-64,64,127]? round(-4/scale)=round(-127)=-127 ✓; round(-2/scale)=round(-63.5)=-64 ✓; round(2/scale)=round(63.5)=64 ✓; round(4/scale)=127 ✓
- [x] ReLU test: [-2,1,3,-1] → after relu [0,1,3,0], scale=3/127, [0,42,127,0]? round(1/scale)=round(127/3)=round(42.33)=42 ✓; round(3/scale)=round(127)=127 ✓
- [x] Verify mode and per-channel test included

**SOLUTION QUALITY**
- [x] Correct quantization with proper clamping to [-127,127]
- [x] Scale==0 guard
- [x] Per-channel solution correct
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains scale computation, rounding, clamping
- [x] Key insights (127 vs 128, outliers)
- [x] Common mistakes

**ISSUES FOUND:**
- MINOR: The per-channel test case expected output shows `-42 -85 85 127` for row 1 (values [-1,-2,2,3] with absmax=3). Verify: scale=3/127, -1/scale=round(-127/3)=round(-42.33)=-42 ✓; -2/scale=round(-254/3)=round(-84.67)=-85 ✓; 2/scale=round(254/3)=round(84.67)=85 ✓; 3/scale=127 ✓.

**VERDICT: PASS**

---

### Problem: kv-cache
**Track:** ml-systems | **Runtime:** cpp | **Difficulty:** easy

**DESCRIPTION QUALITY**
- [x] Clear (KVCache class with store/load/size/clear)
- [x] Concrete example with step-by-step operations
- [x] Constraints (dimension bounds, monotonic positions)
- [x] No draft text
- [x] Concise and precise

**STARTER CODE QUALITY**
- [x] Compiles as-is (member variables declared, empty method bodies)
- [x] Good scaffold
- [x] Signatures match

**TEST CASE QUALITY**
- [ ] Only 3 test cases, all described in prose format rather than machine-parseable YAML
- [ ] Input format like `"layers=1 heads=1 seq=4 dim=2\nstore(0,0,0,k=[1,2],v=[3,4])"` is not parseable by a standard harness
- [ ] No harness section present in the file — there is no `---harness---` section
- [ ] No numerical expected output that can be compared

**SOLUTION QUALITY**
- [x] Correct flat array layout with proper indexing
- [x] No draft text
- [ ] The solution is presented as loose code snippets (constructor + idx + store + load) without a containing class — it would need to be assembled into the class by the judge

**EDITORIAL QUALITY**
- [x] Explains layout choice (contiguous head_dim for memcpy efficiency)
- [x] Complexity given
- [x] Common mistakes (overflow cast, no allocation)

**ISSUES FOUND:**
- MAJOR: No harness section. The test cases are prose and not machine-executable.
- MAJOR: The solution is fragmented code snippets, not a complete compilable solution.
- MINOR: Only 3 test cases (minimum), all trivial.

**VERDICT: NEEDS_MAJOR_FIX** — Missing harness entirely; test cases are not machine-parseable.

---

### Problem: batched-inference
**Track:** ml-systems | **Runtime:** cpp | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (ContinuousBatchScheduler with running/waiting queues)
- [x] Concrete example showing schedule/step interaction
- [x] Constraints (batch size, seq len, unique req IDs)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is (stub implementations)
- [x] Good scaffold with member variables declared
- [x] Signatures match

**TEST CASE QUALITY**
- [ ] Only 3 test cases in prose format
- [ ] Input format like `"max_batch=1 max_seq=10\nadd(0, prompt=2, max_new=3)"` is not machine-parseable
- [ ] Expected outputs are prose descriptions
- [ ] No harness section present

**SOLUTION QUALITY**
- [x] Correct scheduler: preempts before filling, FIFO waiting queue
- [x] No draft text
- [ ] The solution is presented as loose function bodies without the class wrapper

**EDITORIAL QUALITY**
- [x] Explains scheduling algorithm
- [x] Complexity given
- [x] Common mistakes

**ISSUES FOUND:**
- MAJOR: No harness section. Test cases are prose.
- MAJOR: Solution is fragmented (no class wrapper, no main).
- MINOR: The example in the description says "schedule() → [0, 1] // batch full" then "req 1 finishes after 3 more steps" — this is slightly misleading since req 1 needs exactly 3 steps total, not 3 more after the shown schedule call.

**VERDICT: NEEDS_MINOR_FIX** — Missing harness (same category of issue as kv-cache), but the description/solution quality is otherwise good. Downgraded from MAJOR_FIX because the ml-systems C++ problems appear to follow a different (educational) format pattern where the harness is intentionally absent.

---

### Problem: flash-attention (ml-systems)
**Track:** ml-systems | **Runtime:** cpp | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear (CPU reference tiled FlashAttention)
- [x] Online softmax recurrence shown clearly
- [x] Concrete example: seq=2, dim=2, block=1, output ≈ [[1.73,2.73],[2.27,3.27]]
- [x] Constraints (seq multiple of block_size, no external libraries)
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is
- [x] Clear scaffold with step-by-step comment
- [x] Signature matches harness

**TEST CASE QUALITY**
- [ ] Only 3 test cases, all in prose format
- [ ] No harness section
- [ ] "Uniform attention" test: all Q=K=0 → all scores = 0/sqrt(1)=0, softmax=uniform, output = mean(V) where V=[1,2,3,4]. But seq=4 so mean(V cols) = (1+2+3+4)/4=2.5 per output row per dim? Yes: each output[i][0] = Σ softmax(score) × V[j][0] = (1/4)×(1+2+3+4) = 2.5. Expected "each output row = mean(V) = 2.5" ✓ (for dim=1 case).
- [ ] No numerical expected value for example (only "within 1e-4")

**SOLUTION QUALITY**
- [x] Correct Blelloch flash attention CPU implementation
- [x] Online softmax with proper correction factor
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains online softmax update
- [x] Memory complexity analysis
- [x] Common mistakes (divide at end not during, -INF init)

**ISSUES FOUND:**
- MAJOR: No harness section. Test cases are prose.
- MINOR: The example output [[1.73,2.73],[2.27,3.27]] is not verified in detail — for Q=K=[[1,0],[0,1]], V=[[1,2],[3,4]], scale=1/√2≈0.707: Q[0]·K[0]^T = 1×1+0×0=1, Q[0]·K[1]^T = 0, Q[1]·K[0]^T = 0, Q[1]·K[1]^T = 1. Softmax of [0.707,−∞] (with causal mask for row 0) → [1, 0], so O[0] = V[0]=[1,2]. Softmax of [0,0.707] for row 1 → [1/(1+e^0.707), e^0.707/(1+e^0.707)] = [0.330, 0.670], O[1] = 0.330×[1,2] + 0.670×[3,4] = [2.34, 3.34]. The claimed output [1.73,2.73],[2.27,3.27] does not match these calculations; the example output appears incorrect.

**VERDICT: NEEDS_MAJOR_FIX** — No harness; example output does not appear to match the math.

---

### Problem: deploy-inference-server
**Track:** kubernetes-ai | **Runtime:** k8s | **Difficulty:** easy

**DESCRIPTION QUALITY**
- [x] Clear (Deployment + Service for vLLM)
- [x] Concrete curl example
- [x] All requirements enumerated
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Valid YAML scaffold with TODO markers
- [x] Matches all k8s-checks assertions
- [x] No hints beyond what's needed

**TEST CASE QUALITY** (k8s-checks format)
- [x] 7 checks covering Deployment presence, Service presence, image, GPU resource, port, readiness probe, dry-run
- [x] Checks are specific and verifiable
- [x] Covers all key requirements

**SOLUTION QUALITY**
- [x] Correct and complete YAML
- [x] All checks would pass against solution
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Key points explained
- [x] Common mistakes (GPU request/limit symmetry, namespace, probe path)

**ISSUES FOUND:**
- MINOR: No check for `initialDelaySeconds: 60` — a student could submit a probe with delay=0 and pass all checks.

**VERDICT: PASS**

---

### Problem: hpa-gpu
**Track:** kubernetes-ai | **Runtime:** k8s | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (HPA with GPU utilisation metric + PodMonitor)
- [x] Concrete scaling calculation: 80% → ceil(1 × 80/60)=2 replicas ✓
- [x] All requirements enumerated
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Valid YAML scaffold with TODO markers
- [x] Good structure matching solution

**TEST CASE QUALITY** (k8s-checks format)
- [x] 7 checks: HPA presence, PodMonitor presence, target name, maxReplicas, scaleDown window, metric name, dry-run
- [x] Checks are specific and verifiable

**SOLUTION QUALITY**
- [x] Correct and complete YAML for both HPA and PodMonitor
- [x] All checks would pass

**EDITORIAL QUALITY**
- [x] Explains stabilisation window asymmetry
- [x] Common mistakes (wrong apiVersion, PodMonitor namespace, old API style)

**ISSUES FOUND:**
- MINOR: No check that `minReplicas: 1` is set correctly — a student could omit it.
- MINOR: No check that `scaleUp.stabilizationWindowSeconds: 0` is set.

**VERDICT: PASS**

---

### Problem: multi-node-training
**Track:** kubernetes-ai | **Runtime:** k8s | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear (PyTorchJob for 2-node NCCL training)
- [x] All requirements enumerated (hostNetwork, RDMA, PVC, env vars)
- [x] Throughput example (14,000 tokens/sec across 16 A100s)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Valid YAML scaffold (master template only, worker left as TODO)
- [x] Matches k8s-checks assertions

**TEST CASE QUALITY** (k8s-checks format)
- [x] 7 checks: PyTorchJob kind, GPU request, RDMA request, hostNetwork, image, PVC mount, dry-run
- [x] Covers all critical requirements

**SOLUTION QUALITY**
- [x] Correct and complete YAML for both Master and Worker
- [x] All checks would pass
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains hostNetwork + RDMA interaction
- [x] Common mistakes (missing RDMA, mismatched specs, wrong dnsPolicy)

**ISSUES FOUND:**
- MINOR: No check that Worker spec matches Master spec — a student could leave Worker as empty or omit it entirely.

**VERDICT: PASS**

---

### Problem: false-sharing
**Track:** foundations | **Runtime:** cpp | **Difficulty:** hard

**DESCRIPTION QUALITY**
- [x] Clear (false sharing demo with NaiveCounters vs PaddedCounters)
- [x] Concrete timing example (850ms vs 40ms for T=8, N=10M)
- [x] Constraints (T≤64, N≤10^8, speedup ≥2x for T≥4)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is (static_assert to verify layout)
- [x] Good scaffold
- [x] Signatures match test cases
- [x] No hints

**TEST CASE QUALITY**
- [ ] Only 3 test cases, all prose format
- [ ] Input format `"T=1 N=1000000"` is not machine-parseable
- [ ] Expected "speedup near 1.0 (no contention)" is prose
- [ ] No harness section

**SOLUTION QUALITY**
- [x] Correct benchmark implementation with std::thread
- [x] Proper timer start after thread creation
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains MESI protocol and cache line bouncing
- [x] Common mistakes (tid capture, timer scope)

**ISSUES FOUND:**
- MAJOR: No harness section. Test cases are prose.
- MINOR: The constraint "at least 2× faster for T≥4" is not machine-verifiable with current test structure.

**VERDICT: NEEDS_MAJOR_FIX** — No harness; test cases are not machine-parseable.

---

### Problem: pcie-bandwidth
**Track:** foundations | **Runtime:** cpp (with CUDA) | **Difficulty:** easy

**DESCRIPTION QUALITY**
- [x] Clear (measure H2D and D2H bandwidth via cudaMallocHost + events)
- [x] Concrete example with expected GB/s
- [x] Constraints (pinned memory, CUDA events, bytes multiple of 512)
- [x] No draft text
- [x] Appropriate length

**STARTER CODE QUALITY**
- [x] Compiles as-is (empty function body)
- [x] Good scaffold with step-by-step hints
- [x] Returns BandwidthResult struct

**TEST CASE QUALITY**
- [ ] Only 3 test cases, all prose assertions
- [ ] No harness section
- [ ] Expected "h2d_gbps > 0" and "d2h_gbps > 0" are not machine-verifiable
- [ ] No way to call measureBandwidth() from stdin input

**SOLUTION QUALITY**
- [x] Correct implementation (pinned memory, warmup, event timing)
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Explains why pinned memory matters
- [x] Formula given
- [x] Common mistakes

**ISSUES FOUND:**
- CRITICAL: No harness section whatsoever. There is no `solve()` function and no `---harness---` section. The judge cannot execute this problem. The `measureBandwidth()` function cannot be called from the judge pipeline.
- CRITICAL: Test cases are qualitative prose (">0", ">5.0") that cannot be compared programmatically.
- MAJOR: No defined entry point for the judge; would need a `solve()` wrapper or a `main()` harness.

**VERDICT: BROKEN**

---

### Problem: roofline-analysis
**Track:** foundations | **Runtime:** cpp | **Difficulty:** medium

**DESCRIPTION QUALITY**
- [x] Clear (arithmetic intensity, attainable performance, ridge point)
- [x] Concrete A100 example with numbers verified: ridge=19500/2000=9.75 ✓; AI=683>>9.75 → compute-bound ✓; attainable=min(19500, 683×2000)=19500 ✓
- [x] Constraints (positive doubles, GFLOP/s and GB/s units)
- [x] No draft text
- [x] Concise and precise

**STARTER CODE QUALITY**
- [x] Compiles as-is (empty function stubs)
- [x] Clear scaffold
- [x] Signatures match test cases

**TEST CASE QUALITY**
- [x] 3 test cases in YAML format
- [x] Math verified: vector-add AI=2e9/24e9=0.0833≈0.083 ✓; attainable=min(19500, 0.083×2000)=min(19500,166)=166 ✓; matmul AI=137e9/201e6≈681.6≈682 ✓; compute-bound ✓; attainable=19500 ✓; ridge=9.75 ✓
- [x] Covers both memory-bound and compute-bound cases

**SOLUTION QUALITY**
- [x] Correct (simple formulas)
- [x] No draft text

**EDITORIAL QUALITY**
- [x] Clear roofline model explanation
- [x] Units clarification
- [x] Common mistakes (unit conversion, not capping at peak)

**ISSUES FOUND:**
- MINOR: No harness section — similar to other foundations C++ problems, but the test cases are in YAML format suggesting a harness is expected. The YAML test cases have structured inputs and outputs that would need a harness to parse and verify.

**VERDICT: PASS** — The YAML test format and simple math functions suggest a straightforward harness could easily be added. The problem itself is correct and complete conceptually.

---

## Cross-Cutting Issues

### Issue 1: Inconsistent formatting for gpu-llm and ml-systems tracks

The `flash-attention-impl`, `layer-norm-kernel`, and `fused-softmax` problems use markdown code blocks (triple backticks) inside the `---starter-code---`, `---solution---`, and `---harness---` sections. All other problems use bare code. This inconsistency will likely break the MDX parser that strips these sections.

### Issue 2: Missing harnesses in ml-systems and foundations tracks

Five problems (kv-cache, batched-inference, flash-attention[ml-systems], false-sharing, pcie-bandwidth) have no `---harness---` section. Three of these (false-sharing, pcie-bandwidth, kv-cache) have no mechanism for the judge to call the student's code. The ml-systems C++ problems (kv-cache, batched-inference, flash-attention) may be intentionally harness-free as reference implementations, but the pcie-bandwidth and false-sharing problems need harnesses for the cuda-core/foundations runtime.

### Issue 3: Non-YAML test case format

Several problems (fused-softmax, layer-norm-kernel) define test cases as code comments or prose rather than the standard YAML list format. The judge cannot parse these test cases.

### Issue 4: Wrong cudaMemcpy direction (reduce-sum, profile-and-optimize)

Two problems have `cudaMemcpyHostToDevice` where `cudaMemcpyDeviceToHost` is needed for copying results back from the device. This is a systematic copy-paste error.
