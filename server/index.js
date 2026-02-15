const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// --- Telegram Bot Setup ---
const { initBot } = require('./bot');
initBot(process.env.TELEGRAM_BOT_TOKEN);

// --- API Routes ---

// Get all categories
app.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { subCategories: true }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
app.post('/categories', async (req, res) => {
  try {
    const { name, type, parentId } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        type,
        parentId: parentId ? parseInt(parentId) : null
      },
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category (Standard)
app.delete('/categories/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const hasSubcats = await prisma.category.findFirst({ where: { parentId: id } });
    if (hasSubcats) return res.status(400).json({ error: "נחסם: יש תת-קטגוריות." });
    const hasTrans = await prisma.transaction.findFirst({ where: { categoryId: id } });
    if (hasTrans) return res.status(400).json({ error: "נחסם: יש תנועות משויכות." });
    const hasFixed = await prisma.fixedExpense.findFirst({ where: { categoryId: id } });
    if (hasFixed) return res.status(400).json({ error: "נחסם: יש הוצאות קבועות." });

    await prisma.category.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force Delete Category (Cascading)
app.delete('/categories/:id/force', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    // 1. Delete all subcategories and their dependencies recursively (simplified here)
    const subs = await prisma.category.findMany({ where: { parentId: id } });
    for (const sub of subs) {
      await prisma.transaction.deleteMany({ where: { categoryId: sub.id } });
      await prisma.fixedExpense.deleteMany({ where: { categoryId: sub.id } });
      await prisma.category.delete({ where: { id: sub.id } });
    }

    // 2. Delete dependencies of the category itself
    await prisma.transaction.deleteMany({ where: { categoryId: id } });
    await prisma.fixedExpense.deleteMany({ where: { categoryId: id } });

    // 3. Delete the category
    await prisma.category.delete({ where: { id } });

    res.json({ success: true, message: "הקטגוריה וכל מה שקשור אליה נמחקו." });
  } catch (error) {
    res.status(500).json({ error: `שגיאה במחיקת 'כוח': ${error.message}` });
  }
});

// Update Category Budget
app.put('/categories/:id/budget', async (req, res) => {
  const id = parseInt(req.params.id);
  const { weeklyBudget } = req.body;
  try {
    const category = await prisma.category.update({
      where: { id },
      data: { weeklyBudget: parseFloat(weeklyBudget) || null }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transactions
app.get('/transactions', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { category: true },
      orderBy: { date: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create transaction (supports installments)
app.post('/transactions', async (req, res) => {
  try {
    const { amount, description, categoryId, date, addedBy, installments } = req.body;
    const numInstallments = parseInt(installments) || 1;
    const baseDate = date ? new Date(date) : new Date();
    const perInstallment = parseFloat(amount) / numInstallments;
    const groupId = numInstallments > 1 ? `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;

    const transactions = [];
    for (let i = 0; i < numInstallments; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(installmentDate.getMonth() + i);

      const desc = numInstallments > 1
        ? `${description || ''} (תשלום ${i + 1}/${numInstallments})`.trim()
        : description;

      const tx = await prisma.transaction.create({
        data: {
          amount: Math.round(perInstallment * 100) / 100,
          description: desc,
          categoryId: parseInt(categoryId),
          date: installmentDate,
          addedBy: addedBy || "מערכת",
          totalInstallments: numInstallments > 1 ? numInstallments : null,
          currentInstallment: numInstallments > 1 ? i + 1 : null,
          installmentGroupId: groupId
        },
        include: { category: true }
      });
      transactions.push(tx);
    }

    res.json(numInstallments > 1 ? transactions : transactions[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update transaction
app.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, categoryId, date, addedBy } = req.body;
    const transaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: {
        amount: parseFloat(amount),
        description,
        categoryId: parseInt(categoryId),
        date: date ? new Date(date) : undefined,
        addedBy
      },
      include: { category: true }
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.transaction.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fixed Expenses
app.get('/fixed-expenses', async (req, res) => {
  try {
    const fixed = await prisma.fixedExpense.findMany({ include: { category: true } });
    res.json(fixed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/fixed-expenses', async (req, res) => {
  try {
    const { name, amount, categoryId } = req.body;
    const fixed = await prisma.fixedExpense.create({
      data: { name, amount: parseFloat(amount), categoryId: parseInt(categoryId) },
      include: { category: true }
    });
    res.json(fixed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/fixed-expenses/:id', async (req, res) => {
  try {
    await prisma.fixedExpense.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route to log 404s
app.use((req, res) => {
  console.log(`${new Date().toISOString()} - 404 NOT FOUND: ${req.method} ${req.url}`);
  res.status(404).json({ error: `נתיב לא נמצא בשרת: ${req.method} ${req.url}` });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
