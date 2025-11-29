-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "complementaryId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_complementaryId_fkey" FOREIGN KEY ("complementaryId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
