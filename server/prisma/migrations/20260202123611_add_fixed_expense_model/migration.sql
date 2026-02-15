-- CreateTable
CREATE TABLE "FixedExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "FixedExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
