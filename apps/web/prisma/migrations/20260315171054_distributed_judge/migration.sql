-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "computeCap" TEXT,
ADD COLUMN     "cppStandard" TEXT NOT NULL DEFAULT '17',
ADD COLUMN     "cudaVersion" TEXT,
ADD COLUMN     "executionRuntime" TEXT NOT NULL DEFAULT 'cpp';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "computeCap" TEXT,
ADD COLUMN     "cppStandard" TEXT,
ADD COLUMN     "cudaVersion" TEXT;

-- CreateTable
CREATE TABLE "JudgeToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "capabilities" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JudgeToken_token_key" ON "JudgeToken"("token");
