const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// State management
// Key: chatId, Value: { step: 'TYPE' | 'CATEGORY' | 'NOTE', amount, type, categoryId, addedBy }
const sessions = new Map();

function initBot(token, options = { polling: true }) {
    if (!token) {
        console.log('TELEGRAM_BOT_TOKEN not set, skipping bot init.');
        return null;
    }

    const bot = new TelegramBot(token, options);
    console.log(`Telegram Bot started... (polling: ${options.polling})`);

    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, "שלום! אני בוט הניהול הפיננסי שלך.\nכדי להתחיל, פשוט שלח לי את הסכום של התנועה (למשל: 100).");
    });

    // Handle text messages
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const session = sessions.get(chatId);

        // Step 1: Detect Amount
        if (!session) {
            const amount = parseFloat(text);
            if (isNaN(amount)) {
                bot.sendMessage(chatId, "לא הבנתי... שלח לי מספר (סכום) כדי להתחיל.");
                return;
            }

            sessions.set(chatId, {
                step: 'TYPE',
                amount: amount,
                addedBy: msg.from.first_name || "משתמש טלגרם"
            });

            bot.sendMessage(chatId, `קיבלתי: ${amount.toLocaleString()} ₪.\nהאם זו הוצאה או הכנסה?`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔴 הוצאה", callback_data: "type_expense" },
                            { text: "🟢 הכנסה", callback_data: "type_income" }
                        ]
                    ]
                }
            });
            return;
        }

        // Step: Handle New Parent Category Name
        if (session.step === 'NEW_PARENT_NAME') {
            try {
                const newCat = await prisma.category.create({
                    data: { name: text, type: session.type }
                });
                session.categoryId = newCat.id;
                session.step = 'CONFIRM_NOTE';
                bot.sendMessage(chatId, `סידרתי! הקטגוריה "${text}" נוספה.\nתרצה להוסיף הערה לתנועה?`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✍️ הוסף הערה", callback_data: "note_add" },
                                { text: "⏩ דלג ושמור", callback_data: "note_skip" }
                            ]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, "שגיאה ביצירת הקטגוריה.");
            }
            return;
        }

        // Step: Handle New Sub Category Name
        if (session.step === 'NEW_SUB_NAME') {
            try {
                const newCat = await prisma.category.create({
                    data: { name: text, type: session.type, parentId: session.parentId }
                });
                session.categoryId = newCat.id;
                session.step = 'CONFIRM_NOTE';
                bot.sendMessage(chatId, `מעולה! תת-הקטגוריה "${text}" נוספה.\nתרצה להוסיף הערה לתנועה?`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✍️ הוסף הערה", callback_data: "note_add" },
                                { text: "⏩ דלג ושמור", callback_data: "note_skip" }
                            ]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, "שגיאה ביצירת תת-הקטגוריה.");
            }
            return;
        }

        // Step: Handle Note Text
        if (session.step === 'WAIT_FOR_NOTE') {
            try {
                await prisma.transaction.create({
                    data: {
                        amount: session.amount,
                        description: text,
                        categoryId: session.categoryId,
                        addedBy: session.addedBy
                    }
                });

                const category = await prisma.category.findUnique({ where: { id: session.categoryId } });
                bot.sendMessage(chatId, `נשמר בהצלחה! ✅\n${session.amount.toLocaleString()} ₪ (*${category.name}*)\nהערה: ${text}`, { parse_mode: 'Markdown' });
                sessions.delete(chatId);
            } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, "אופס, קרתה שגיאה בשמירה.");
            }
            return;
        }
    });

    // Handle button clicks
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const session = sessions.get(chatId);

        if (!session) {
            bot.answerCallbackQuery(query.id, { text: "הסשן פג תוקף" });
            return;
        }

        // Handle Type Selection
        if (data.startsWith('type_')) {
            const type = data.split('_')[1];
            session.type = type;
            session.step = 'PARENT_CATEGORY';

            const categories = await prisma.category.findMany({
                where: { type: type, parentId: null }
            });

            const keyboard = categories.map(c => ([{ text: c.name, callback_data: `parent_${c.id}` }]));
            keyboard.push([{ text: "➕ הוסף קטגוריה חדשה", callback_data: "new_parent" }]);

            bot.editMessageText(`בחר קטגוריה ראשית:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: keyboard }
            });
            return;
        }

        // Handle Parent Selection
        if (data.startsWith('parent_')) {
            const parentId = parseInt(data.split('_')[1]);
            session.parentId = parentId;

            const subCats = await prisma.category.findMany({
                where: { parentId: parentId }
            });

            // If no subcategories exist, skip directly to Note (matching Dashboard behavior)
            if (subCats.length === 0) {
                session.categoryId = parentId;
                session.step = 'NOTE';

                const parentCat = await prisma.category.findUnique({ where: { id: parentId } });
                session.step = 'CONFIRM_NOTE';

                bot.editMessageText(`נבחר: *${parentCat.name}*.\nתרצה להוסיף הערה לתנועה?`, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✍️ הוסף הערה", callback_data: "note_add" },
                                { text: "⏩ דלג ושמור", callback_data: "note_skip" }
                            ]
                        ]
                    }
                });
                return;
            }

            // If subcategories exist, offer them (plus "Finish here" and "Add new")
            session.step = 'SUB_CATEGORY';
            const parentCat = await prisma.category.findUnique({ where: { id: parentId } });

            const keyboard = subCats.map(c => ([{ text: `↳ ${c.name}`, callback_data: `sub_${c.id}` }]));
            keyboard.push([{ text: "✅ סיים כאן (בלי תת-קטגוריה)", callback_data: `sub_${parentId}` }]);
            keyboard.push([{ text: "➕ הוסף תת-קטגוריה חדשה", callback_data: "new_sub" }]);

            bot.editMessageText(`בחר תת-קטגוריה תחת *${parentCat.name}*:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: keyboard },
                parse_mode: 'Markdown'
            });
            return;
        }

        // Handle Sub Selection
        if (data.startsWith('sub_')) {
            const catId = parseInt(data.split('_')[1]);
            session.categoryId = catId;
            session.step = 'CONFIRM_NOTE';

            const category = await prisma.category.findUnique({ where: { id: catId } });
            bot.editMessageText(`נבחר: *${category.name}*.\nתרצה להוסיף הערה לתנועה?`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✍️ הוסף הערה", callback_data: "note_add" },
                            { text: "⏩ דלג ושמור", callback_data: "note_skip" }
                        ]
                    ]
                }
            });
            return;
        }

        // Handle Note Decision
        if (data === 'note_add') {
            session.step = 'WAIT_FOR_NOTE';
            bot.editMessageText("רשום לי עכשיו את ההערה שלך:", {
                chat_id: chatId,
                message_id: query.message.message_id
            });
            return;
        }

        if (data === 'note_skip') {
            try {
                await prisma.transaction.create({
                    data: {
                        amount: session.amount,
                        categoryId: session.categoryId,
                        addedBy: session.addedBy
                    }
                });

                const category = await prisma.category.findUnique({ where: { id: session.categoryId } });
                bot.editMessageText(`נשמר בהצלחה! ✅\n${session.amount.toLocaleString()} ₪ (*${category.name}*)`, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                });
                sessions.delete(chatId);
            } catch (error) {
                console.error(error);
                bot.sendMessage(chatId, "אופס, קרתה שגיאה בשמירה.");
            }
            return;
        }

        // Handle "Add New" button clicks
        if (data === 'new_parent') {
            session.step = 'NEW_PARENT_NAME';
            bot.editMessageText("רשום לי עכשיו את השם של הקטגוריה החדשה שאתה רוצה ליצור:", {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        }

        if (data === 'new_sub') {
            session.step = 'NEW_SUB_NAME';
            bot.editMessageText("רשום לי עכשיו את השם של תת-הקטגוריה החדשה:", {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        }

        bot.answerCallbackQuery(query.id);
    });
    return bot;
}

module.exports = { initBot };
