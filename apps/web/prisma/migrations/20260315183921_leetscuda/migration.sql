-- CreateTable
CREATE TABLE "ConceptRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeSlug" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptRead_userId_nodeSlug_key" ON "ConceptRead"("userId", "nodeSlug");

-- AddForeignKey
ALTER TABLE "ConceptRead" ADD CONSTRAINT "ConceptRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
