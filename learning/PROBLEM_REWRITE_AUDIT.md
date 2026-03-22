# Problem Rewrite Audit
Generated: 2026-03-22

## Summary

| Verdict | Count | Slugs |
|---------|-------|-------|
| PASS    | 11    | matrix-transpose, matrix-multiply, reduce-sum, cublas-integration, tensor-core-gemm, quantization-exercise, pcie-bandwidth, false-sharing, multi-node-training, hpa-gpu, deploy-inference-server |
| MINOR   | 5     | vector-add, histogram, layer-norm-kernel, flash-attention-impl, streams-overlap |
| MAJOR   | 4     | grid-stride-saxpy, fused-softmax, prefix-scan, gemm-optimization |
| BROKEN  | 5     | profile-and-optimize, kv-cache, flash-attention (ml-systems), batched-inference, roofline-analysis |

---

## Per-Problem Findings

### cuda-core/problems/vector-add — MINOR

**R4 violation**: Two test cases are trivially passed by a broken (no-op) implementation.
- "All zeros" test: inputs are all 0, so an empty kernel leaves output buffer zeroed → correct by coincidence.
- "Single element edge case": same issue, N=1, value=0.

**Fix**: Replace with non-zero, non-trivially-summable test cases.

---

### cuda-core/problems/matrix-transpose — PASS

Harness correctly compiles and runs user code. Inputs are read from stdin (N, matrix values). Expected output is pre-computed and compared. Test cases are non-trivial. No fake harness.

---

### cuda-core/problems/matrix-multiply — PASS

Harness correctly compiles and runs user code. Tests cover small/medium/non-square matrices and identity/zero edge cases. Expected outputs are correct. No issues.

---

### cuda-core/problems/reduce-sum — PASS

Harness correctly compiles. Tests cover powers-of-two and non-power-of-two sizes. Expected outputs verified. No issues.

---

### cuda-core/problems/histogram — MINOR

**R3 violation (description/example mismatch)**: The description states:
> Input: `10 3 0 1 2 0 1 0 2 1 1 2` → Output: `4 4 2`

Manual count of `[0,1,2,0,1,0,2,1,1,2]` gives bin0=3, bin1=4, bin2=3, so the correct output is `3 4 3`, not `4 4 2`. The test case expected value is correct (`3 4 3`), but the inline description example is wrong and misleading.

**Fix**: Correct the description example to match the actual expected output.

---

### cuda-core/problems/prefix-scan — MAJOR

**R3 violation (off-by-one bug in provided solution)**: The `addOffsets` kernel uses:
```cpp
local[i] += offsets[bid - 1];
```
After `scanPass2`, `d_sums[k]` holds the exclusive prefix sum of block sums up to block k. Block 1 should add `d_sums[1]` (the sum of block 0). Block 2 should add `d_sums[2]` (the sum of blocks 0+1). The code subtracts 1 from `bid`, so block 1 adds `d_sums[0]`=0 (wrong) and block 2 adds `d_sums[1]` (wrong). The correct index is `d_sums[bid]`.

**R4 violation**: No test case exercises the multi-block path. All test cases use N ≤ 256 = BLOCK_SIZE, so `addOffsets` is never called. The bug is untested.

**R1 violation**: The "seq:1" input format string in test cases is unsupported by `readUInts()`, which only handles `fill:` prefix. This test case will silently produce garbage data.

**Fix**: Correct the `addOffsets` offset index. Add a test case with N > 256 to exercise multi-block path. Fix or remove the `seq:1` input format, or add support for it in the harness.

---

### cuda-core/problems/grid-stride-saxpy — MAJOR

**R1 violation (harness compile error in verify mode)**: In the verify branch of the harness, the variables `isFill` and `fillValue` (declared in the fill branch) are used but not in scope, causing a compilation error. The variable `tok` referenced inside `readArray()` is also out of scope. The harness will fail to compile, making the problem unjudgeable.

**Fix**: Rewrite the input-reading logic so variable scopes are correct throughout both fill and verify branches.

---

### cuda-core/problems/profile-and-optimize — BROKEN

**R8 violation (fake harness — canonical example)**: The `checkCoalescedAccess()` function in the harness does not measure performance or verify output correctness. It literally opens the MDX source file:
```cpp
FILE* f = fopen("learning/cuda-core/problems/profile-and-optimize/index.mdx", "r");
while (fgets(line, sizeof(line), f)) {
    if (strstr(line, "col += 32")) hasBrokenPattern = true;
    if (strstr(line, "col += BLOCK_SIZE") || strstr(line, "col += blockDim.x"))
        hasCoalescedPattern = true;
}
return hasCoalescedPattern && !hasBrokenPattern;
```
This awards points for writing specific string literals, not for producing correct or fast CUDA code.

**Fix (Option A)**: Reframe as a measurable correctness + performance problem. The new problem asks the user to implement a coalesced matrix transpose. The harness measures wall-clock bandwidth (GB/s) using CUDA events and checks it exceeds a threshold (e.g., ≥ 60% of peak). Correctness is verified by comparing output against a reference CPU transpose on known inputs.

---

### cuda-hpc/problems/gemm-optimization — MAJOR

**R4 violation (test cases violate stated constraint)**: The problem states `64 ≤ N ≤ 4096`, but three test cases use N=4:
- "Identity matrix": N=4
- "Ones matrix": N=4
- "Small random": N=4

With tile size BM=128 > N=4, shared memory indexing goes out of bounds and the kernel produces undefined output. The expected values in these test cases cannot be correct.

**Fix**: Replace N=4 test cases with N ≥ 64 test cases, or lower the stated minimum constraint and ensure the kernel handles N < BM correctly.

---

### cuda-hpc/problems/tensor-core-gemm — PASS

Harness uses WMMA API correctly. Test inputs and expected outputs are verified. Non-trivial test cases included. No issues.

---

### cuda-hpc/problems/pcie-bandwidth — PASS

Harness measures H2D/D2H bandwidth with pinned memory and CUDA events. Correctness verified by round-trip copy. Threshold checks are realistic. No fake harness.

---

### cuda-hpc/problems/false-sharing — PASS

Harness verifies histogram correctness and measures speedup of padded vs. unpadded implementation. Threshold is reasonable. No issues.

---

### cuda-hpc/problems/streams-overlap — MINOR

**R4 note (no performance assertion)**: The harness verifies correctness (output values match) but does not assert that the kernel actually used concurrent streams (i.e., overlapping execution). A sequential implementation would pass. This is acceptable as a correctness gate, but the problem description promises a performance test; the harness does not deliver one.

**Fix**: Add a timing assertion that the multi-stream version completes in less than, e.g., 80% of the sequential wall time, or annotate the problem to clarify it is a correctness-only check.

---

### gpu-llm/problems/fused-softmax — MAJOR

**R1 violation (test cases are unparseable)**: The `---test-cases---` section uses C++ comment syntax:
```
// Test case 1: Small matrix
// Input: ...
// Expected: ...
```
These are C++ comments, not YAML or the supported structured format. The judge cannot parse them.

**R1 violation (verify-mode input parsing bug)**: In the harness verify branch, after scanning N and C, the code checks:
```cpp
if (strncmp(first, "fill:", 5) == 0)
```
where `first = "verify"`. The `strncmp` returns non-zero, so the fill branch is never taken. Input data is never read into `h_input`, and the kernel operates on uninitialized memory.

**Fix**: Convert test cases to valid YAML format. Fix the verify-mode parsing to correctly read input data after the mode identifier.

---

### gpu-llm/problems/flash-attention-impl — MINOR

**R1 violation (harness drops nheads parameter)**: The test case "Multiple heads" provides input `"verify 1 64 64 2"` (batch=1, seqlen=64, head_dim=64, nheads=2). The harness verify mode reads:
```cpp
scanf("%d %d %d", &batch_size, &seqlen, &head_dim);
```
Only 3 integers are consumed. `nheads=2` is silently dropped, and the test always runs with `nheads=1`, making the "Multiple heads" test case a no-op.

**Fix**: Add `nheads` to the scanf call in verify mode and use it when allocating/iterating heads.

---

### gpu-llm/problems/layer-norm-kernel — MINOR

**R1 violation (dynamic shared memory launch bug in solution)**: The `fused_layer_norm_forward_kernel` uses:
```cpp
extern __shared__ float shared_mem[];
```
But `solve()` launches it without dynamic shared memory:
```cpp
fused_layer_norm_forward_kernel<<<num_blocks, THREADS_PER_BLOCK>>>(...)
```
The third launch argument (bytes of dynamic shared memory) is missing, so it defaults to 0. When the kernel accesses `shared_mem`, behavior is undefined. The problem compiles but produces wrong results or crashes at runtime.

**Fix**: Change the launch to pass the required shared memory size:
```cpp
fused_layer_norm_forward_kernel<<<num_blocks, THREADS_PER_BLOCK, hidden_dim * sizeof(float)>>>(...)
```

---

### gpu-llm/problems/quantization-exercise — PASS

Harness correctly tests INT8 quantization/dequantization with per-tensor and per-channel scaling. Test cases are non-trivial. Expected outputs are verified. No issues.

---

### ml-systems/problems/kv-cache — BROKEN

**R1 violation (no harness)**: No `---harness---` section exists. The problem cannot be compiled or executed.

**R2 violation (unparseable test cases)**: Test cases use pseudo-code format:
```
store(0,0,0,k=[1,2],v=[3,4])
load(0,0,0) → k=[1,2] v=[3,4]
```
These are not valid stdin inputs.

**Fix**: Write a complete harness that accepts a sequence of `store`/`load` commands on stdin, executes them against the user's KV cache implementation, and compares outputs to expected values.

---

### ml-systems/problems/flash-attention — BROKEN

**R1 violation (no harness)**: No `---harness---` section exists. The problem cannot be judged.

**R2 violation (unparseable test cases)**: Test cases use prose descriptions:
```
seq=2 dim=2 block=1
Q=K=I, V=[[1,2],[3,4]]
expected: "standard attention output within 1e-4"
```
These are human-readable descriptions, not structured stdin.

**Fix (Option B — split)**: Split into (1) a standard attention correctness problem with numeric Q/K/V matrices on stdin and numeric expected output, and (2) a FlashAttention implementation problem that verifies the same correctness with a real reference implementation. Write full harnesses for both.

---

### ml-systems/problems/batched-inference — BROKEN

**R1 violation (no harness)**: No `---harness---` section exists. The problem cannot be compiled or executed.

**R2 violation (unparseable test cases)**: Test cases use descriptive scheduler event notation:
```
max_batch=1 max_seq=10
add(0, prompt=2, max_new=3)
expected: "3 schedule/step cycles to finish req 0"
```
These describe a scheduler simulation but provide no parseable stdin format.

**Fix**: Write a harness that encodes the scheduler state machine as stdin commands (`ADD <id> <prompt_len> <max_new>`, `STEP`) and checks that the scheduler emits the correct batch assignments and termination events on stdout.

---

### foundations/problems/roofline-analysis — BROKEN

**R1 violation (no harness)**: No `---harness---` section exists.

**R2 violation (human-readable expected outputs)**: Expected outputs are text descriptions:
```
ai=0.083 compute_bound=false attainable≈166 GFLOP/s
```
These cannot be machine-compared.

**Fix (Option A — reframe)**: Reframe as a CUDA kernel implementation problem. The user implements a kernel; the harness measures FLOP/s and memory bandwidth using CUDA events, then checks the measured arithmetic intensity and throughput against the roofline bound. Expected output is a numeric pass/fail based on measured throughput ≥ threshold.

---

### kubernetes-ai/problems/multi-node-training — PASS

K8s manifest validation problem. Evaluated via `kubectl --dry-run=client`. Checklist-based result panel. No stdin/stdout binary execution needed; manifest validation is the correct evaluation model for this problem class.

---

### kubernetes-ai/problems/hpa-gpu — PASS

K8s manifest validation problem. HPA and Deployment manifests validated via dry-run. No issues.

---

### kubernetes-ai/problems/deploy-inference-server — PASS

K8s manifest validation problem. Evaluated via dry-run against expected resource types and configuration. No issues.

---

## Rule Reference

| Rule | Name | Description |
|------|------|-------------|
| R1 | Executability | Harness must compile and run without errors |
| R2 | Testability | Test cases must be machine-parseable stdin inputs |
| R3 | Verified outputs | Expected outputs must be correct |
| R4 | Non-trivial tests | Tests must not be trivially passed by broken implementations |
| R5 | No solution leakage | Starter code must not contain the answer |
| R6 | Difficulty calibration | Problem difficulty must match stated level |
| R7 | Editorial alignment | Editorial solution must solve the stated problem |
| R8 | No fake harnesses | Harness must run code, not scan source text |
