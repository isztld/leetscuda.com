-- AlterTable
ALTER TABLE "RoadmapNode" ADD COLUMN     "cluster" TEXT,
ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "interviewRelevance" TEXT;
