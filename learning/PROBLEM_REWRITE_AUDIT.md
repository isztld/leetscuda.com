# Problem Rewrite Audit — Phase 22

## vector-add
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: KEEP
Reason: Clean description, correct test cases, empty kernel body — already excellent.

## grid-stride-saxpy
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~650 words with extensive theory; must be cut to <200 words and constraint must force grid-stride pattern.

## matrix-transpose
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~340 words; trim to <200, add explicit bank-conflict padding constraint, replace trivial test cases with concrete small-matrix examples.

## matrix-multiply
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~500 words with step-by-step algorithm hints; trim to <200 words, constraint must require shared memory tiling.

## reduce-sum
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~550 words; trim to <200, add verification notes to test cases.

## prefix-scan
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~900 words of algorithm explanation; trim to <200, reduce to 3 test cases with verification notes.

## histogram
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description too long; constraint must require shared memory privatization and atomics; add verified test cases.

## streams-overlap
Q1 (judge-executable): yes — harness compares correctness of pipelined vs sequential output, not timing
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description is ~700 words with API tutorial; trim to <200 words; correctness-based test cases are already reliable.

## profile-and-optimize
Q1 (judge-executable): no — framed around running ncu, re-profiling, and observing metrics; the kernel inside is valid but the stated task is profiling
Q2 (interview-relevant): no — profiling workflow belongs in theory articles
Q3 (testable with 3 cases): no — test cases are based on reporting metrics, not deterministic stdout
Verdict: DELETE
Reason: Core task is ncu profiling which cannot produce consistent stdout; the underlying row-max kernel is a better problem redesigned from scratch.

## cublas-integration
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~650 words with cuBLAS API tutorial; trim to <200, verify test case expected outputs.

## gemm-optimization
Q1 (judge-executable): yes — verifies correctness only, not performance
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~900 words; trim to <200, constraint must require shared memory tiling and register blocking.

## tensor-core-gemm
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~850 words; constraint must require WMMA API with wmma::load_matrix_sync / mma_sync / store_matrix_sync; verify FP16→FP32 test outputs.

## fused-softmax
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~700 words; constraint must require single-pass online softmax; add numpy-verified test cases.

## layer-norm-kernel
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~650 words; constraint must require fused residual + LayerNorm in a single kernel; verify expected outputs numerically.

## quantization-exercise
Q1 (judge-executable): yes
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes
Verdict: REWRITE
Reason: Description ~700 words; verify that expected outputs account for saturating cast and rounding correctly.

## flash-attention-impl
Q1 (judge-executable): yes — harness compares output against reference attention for small sequences
Q2 (interview-relevant): yes
Q3 (testable with 3 cases): yes — small sequences allow numpy verification
Verdict: REWRITE
Reason: Description is 1400+ words; trim to <200, constrain to FA1 tiling algorithm; verify test outputs with numpy.

## false-sharing
Q1 (judge-executable): no — test "speedup >= 2x" is timing-dependent and unreliable across hardware configurations
Q2 (interview-relevant): medium — CPU cache concept, less central to GPU AI infrastructure interviews
Q3 (testable with 3 cases): no — speedup ratio varies by machine; no deterministic stdout
Verdict: DELETE
Reason: Timing-based test (speedup >= 2x) produces different stdout on different hardware; no correct expected output exists.

## pcie-bandwidth
Q1 (judge-executable): no — test checks bandwidth in range (0.5–1000 GB/s); correct implementation prints different values on PCIe 3.0 vs 5.0 systems
Q2 (interview-relevant): medium
Q3 (testable with 3 cases): no — expected output is hardware-dependent; "1" passes any working implementation
Verdict: DELETE
Reason: Output is hardware-specific; a correct implementation on a fast machine prints "1" on a slow machine equally, making test cases meaningless.

## roofline-analysis
Q1 (judge-executable): yes — pure C++ math with deterministic output
Q2 (interview-relevant): no — implementing flops/bytes_moved is trivial arithmetic, not a real engineering task
Q3 (testable with 3 cases): yes
Verdict: DELETE
Reason: Implementing arithmetic_intensity = flops/bytes tests trivial math, not GPU engineering; roofline analysis belongs in theory articles.
