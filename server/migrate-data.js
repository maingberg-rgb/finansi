const { PrismaClient: SqliteClient } = require('./prisma/client-sqlite');
const { PrismaClient: PgClient } = require('@prisma/client');

const sqlite = new SqliteClient();
const pg = new PgClient();

async function main() {
    console.log('🔄 התחלת הגירת נתונים...');

    // 1. Read from SQLite
    console.log('📖 קורא נתונים מהקובץ המקומי...');
    const categories = await sqlite.category.findMany();
    const transactions = await sqlite.transaction.findMany();
    const fixedExpenses = await sqlite.fixedExpense.findMany();

    console.log(`📊 נמצאו:
  - ${categories.length} קטגוריות
  - ${transactions.length} תנועות
  - ${fixedExpenses.length} הוצאות קבועות`);

    // 2. Write to Postgres (Supabase)
    console.log('🚀 כותב ל-Supabase...');

    // --- Categories ---
    // Sort categories to ensure parents exist before children
    // Simple approach: Insert roots first, then children. 
    // We'll try to insert. If fails (FK constraint), push to end of queue.
    const catsToInsert = [...categories];
    const insertedCatIds = new Set();
    let attempts = 0;

    while (catsToInsert.length > 0 && attempts < 100) {
        const cat = catsToInsert.shift();

        // If it has a parent, check if parent is inserted
        if (cat.parentId && !insertedCatIds.has(cat.parentId)) {
            catsToInsert.push(cat); // Move to end
            continue;
        }

        try {
            // We want to keep the same ID to preserve relations
            await pg.category.create({
                data: {
                    id: cat.id,
                    name: cat.name,
                    type: cat.type,
                    parentId: cat.parentId,
                    weeklyBudget: cat.weeklyBudget
                }
            });
            insertedCatIds.add(cat.id);
            process.stdout.write('.');
        } catch (e) {
            if (e.code === 'P2002') { // Unique constraint (ID already exists)
                insertedCatIds.add(cat.id); // Assume it's there
            } else {
                console.error(`❌ Error inserting category ${cat.name}:`, e.message);
            }
        }
        attempts++;
    }
    console.log('\n✅ קטגוריות הועתקו.');

    // --- Transactions ---
    for (const t of transactions) {
        try {
            await pg.transaction.create({
                data: {
                    id: t.id,
                    amount: t.amount,
                    description: t.description,
                    date: t.date,
                    addedBy: t.addedBy,
                    categoryId: t.categoryId,
                    totalInstallments: t.totalInstallments,
                    currentInstallment: t.currentInstallment,
                    installmentGroupId: t.installmentGroupId
                }
            });
            process.stdout.write('.');
        } catch (e) {
            if (e.code !== 'P2002') console.error(`❌ Error transaction ${t.id}:`, e.message);
        }
    }
    console.log('\n✅ תנועות הועתקו.');

    // --- Fixed Expenses ---
    for (const f of fixedExpenses) {
        try {
            await pg.fixedExpense.create({
                data: {
                    id: f.id,
                    name: f.name,
                    amount: f.amount,
                    categoryId: f.categoryId
                }
            });
            process.stdout.write('.');
        } catch (e) {
            if (e.code !== 'P2002') console.error(`❌ Error fixed expense ${f.id}:`, e.message);
        }
    }
    console.log('\n✅ הוצאות קבועות הועתקו.');

    console.log('🎉 סיימנו! כל הנתונים עברו לענן.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await sqlite.$disconnect();
        await pg.$disconnect();
    });
