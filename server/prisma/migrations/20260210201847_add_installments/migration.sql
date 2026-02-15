-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "currentInstallment" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "installmentGroupId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "totalInstallments" INTEGER;
