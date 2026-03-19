-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "prerequisites" TEXT[],
ADD COLUMN     "previewNodes" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "shortTitle" TEXT;
