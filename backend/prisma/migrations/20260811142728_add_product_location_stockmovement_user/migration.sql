-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "reason" TEXT;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
