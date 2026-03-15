---
name: phase14_submission_experience
description: Phase 14 complete — submission experience overhaul, rich result panel, editorials, history, stats
type: project
---

Phase 14 delivered a major submission experience overhaul:

## Schema
- Added `testResults Json?` to Submission model (migration `20260315222309_add_submission_test_results`)

## Judge Worker
- `apps/judge/src/types.ts`: Added `SubmissionTestResult` type and `testResults` to `JudgeResult`
- `apps/judge/src/worker.ts`: Collects per-test-case {index, passed, input, expected, actual, runtimeMs} and includes in result

## Result Endpoint (`/api/judge/result`)
- Accepts `testResults` array in payload, writes to DB
- Returns `{ received: true, firstSolve: boolean }` instead of `{ ok: true }`

## Submissions Router
- `getStatus`: returns testResults (Json cast) and firstSolve bool
- `getLatestForProblem`: returns isSolved derived from UserProgress existence
- `getHistoryForProblem`: new — last 20 submissions with sequential number
- `cancel`: decrements Redis `submission:daily:${userId}:${YYYY-MM-DD}` key on successful cancel
- `create`: increments Redis daily key after successful DB insert
- `getDailyCount`: reads from Redis daily key (falls back to DB)
- Daily key format: `submission:daily:${userId}:${YYYY-MM-DD}` (UTC)

## Problems Router
- `getStats`: returns { totalAccepted, totalSubmissions, acceptanceRate } for a problem

## problems-content.ts
- Added `editorial: string | null` to ProblemContent
- Searches for `---editorial---` marker anywhere in content (not harness-dependent)
- Content terminated by `---end---`

## MDX Files (all 13)
- Added real editorial sections with Approach, Complexity, Key Insight, Common Mistakes
- Files: vector-add, matrix-multiply, matrix-transpose, reduce-sum, flash-attention, batched-inference, kv-cache, deploy-inference-server, hpa-gpu, multi-node-training, pcie-bandwidth, roofline-model, false-sharing

## ProblemDetail.tsx (major overhaul)
- `Tab` type extended with 'submissions'
- `isSolved` state initialized from `getLatestForProblem.isSolved`
- `firstSolve` detection from `getStatus.firstSolve`
- Confetti via canvas-confetti on first solve
- Green solved banner (5s auto-dismiss)
- Auto-switch to editorial tab 2s after first solve
- Submit button becomes "Resubmit" when `isSolved`
- Rich result panel: StatusBar with icon/color + test case tabs + Input/Expected/Output grid
- DiffOutput component for character-level diff highlighting
- TestResultPanel with per-test-case tabs (green/red pills)
- RUNTIME_ERROR shows stderr in red code block
- Pending state shows animated skeleton + cancel button
- Submissions tab: history table with #, status, runtime, date, </> code viewer
- CodeViewerModal: read-only pre block with submission code
- Problem stats row (Accepted / Submissions / Acceptance rate)
- Editorial tab: blurred overlay when locked, prose render when unlocked

## Dependencies
- Added canvas-confetti + @types/canvas-confetti

## Why
- The submission result panel was too basic — no per-test-case data, no diff, no history
- Editorial was locked even after solving
- Cancelled submissions incorrectly counted toward daily limit

**How to apply**: All these features are live in production code. The judge must include testResults in its result payload for the rich panel to work.
