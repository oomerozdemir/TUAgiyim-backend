-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cargoCompany" TEXT,
ADD COLUMN     "cargoTrackingNumber" TEXT;
