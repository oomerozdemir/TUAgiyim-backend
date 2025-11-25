-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerNote" TEXT,
ADD COLUMN     "shippingAddressId" TEXT,
ADD COLUMN     "shippingAddressLine" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingDistrict" TEXT,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "shippingNeighborhood" TEXT,
ADD COLUMN     "shippingPhone" TEXT,
ADD COLUMN     "shippingPostalCode" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
