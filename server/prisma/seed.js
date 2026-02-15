const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning categories...');
    await prisma.transaction.deleteMany({});
    await prisma.category.deleteMany({});

    console.log('Seeding categories...');

    // Income categories
    await prisma.category.createMany({
        data: [
            { name: 'משכורת', type: 'income' },
            { name: 'אחר', type: 'income' },
        ]
    });

    // Flat expense categories
    await prisma.category.createMany({
        data: [
            { name: 'דלק', type: 'expense' },
            { name: 'מזון', type: 'expense' },
            { name: 'בילויים', type: 'expense' },
            { name: 'ביגוד', type: 'expense' },
            { name: 'הלוואות', type: 'expense' },
            { name: 'לימודים', type: 'expense' },
        ]
    });

    // Categories with sub-categories
    const insurance = await prisma.category.create({
        data: { name: 'ביטוחים', type: 'expense' }
    });

    await prisma.category.createMany({
        data: [
            { name: 'חיים', type: 'expense', parentId: insurance.id },
            { name: 'בריאות', type: 'expense', parentId: insurance.id },
            { name: 'רכב', type: 'expense', parentId: insurance.id },
        ]
    });

    const car = await prisma.category.create({
        data: { name: 'רכב', type: 'expense' }
    });

    await prisma.category.createMany({
        data: [
            { name: 'טיפולים', type: 'expense', parentId: car.id },
            { name: 'תיקונים', type: 'expense', parentId: car.id },
        ]
    });

    console.log('Seeding complete!');
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
