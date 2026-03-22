-- Migration: cuda_min_requirements
-- Replace CudaVersion/ComputeCap enum fields with free-form string minimum-requirement fields.
-- Problem: drop cudaVersion + computeCap (enum), add cudaMinVersion + computeMinCap (String?)
-- Submission: drop cudaVersion + computeCap (enum)

ALTER TABLE "Problem" DROP COLUMN IF EXISTS "cudaVersion";
ALTER TABLE "Problem" DROP COLUMN IF EXISTS "computeCap";
ALTER TABLE "Problem" ADD COLUMN "cudaMinVersion" TEXT;
ALTER TABLE "Problem" ADD COLUMN "computeMinCap" TEXT;

ALTER TABLE "Submission" DROP COLUMN IF EXISTS "cudaVersion";
ALTER TABLE "Submission" DROP COLUMN IF EXISTS "computeCap";

DROP TYPE IF EXISTS "CudaVersion";
DROP TYPE IF EXISTS "ComputeCap";
