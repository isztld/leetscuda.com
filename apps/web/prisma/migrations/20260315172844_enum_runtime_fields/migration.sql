/*
  Warnings:

  - You are about to drop the column `executionMode` on the `Problem` table. All the data in the column will be lost.
  - The `computeCap` column on the `Problem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `cppStandard` column on the `Problem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `cudaVersion` column on the `Problem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `executionRuntime` column on the `Problem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `computeCap` column on the `Submission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `cppStandard` column on the `Submission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `cudaVersion` column on the `Submission` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ExecutionRuntime" AS ENUM ('CPP', 'CUDA');

-- CreateEnum
CREATE TYPE "CppStandard" AS ENUM ('CPP14', 'CPP17', 'CPP20', 'CPP23');

-- CreateEnum
CREATE TYPE "CudaVersion" AS ENUM ('CUDA_12_6');

-- CreateEnum
CREATE TYPE "ComputeCap" AS ENUM ('SM_86', 'SM_120');

-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "executionMode",
DROP COLUMN "computeCap",
ADD COLUMN     "computeCap" "ComputeCap",
DROP COLUMN "cppStandard",
ADD COLUMN     "cppStandard" "CppStandard" NOT NULL DEFAULT 'CPP17',
DROP COLUMN "cudaVersion",
ADD COLUMN     "cudaVersion" "CudaVersion",
DROP COLUMN "executionRuntime",
ADD COLUMN     "executionRuntime" "ExecutionRuntime" NOT NULL DEFAULT 'CPP';

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "computeCap",
ADD COLUMN     "computeCap" "ComputeCap",
DROP COLUMN "cppStandard",
ADD COLUMN     "cppStandard" "CppStandard",
DROP COLUMN "cudaVersion",
ADD COLUMN     "cudaVersion" "CudaVersion";

-- DropEnum
DROP TYPE "ExecutionMode";
