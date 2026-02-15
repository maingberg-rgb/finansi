import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getTransactions, createTransaction, deleteTransaction, createCategory, forceDeleteCategory } from '../lib/api';
import { useState, useMemo } from 'react';
import { Plus, Wallet, TrendingDown, TrendingUp, Trash2, ChevronLeft, ChevronRight, Edit3, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import clsx from 'clsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard() {
    const queryClient = useQueryClient();

    // Data fetching
    const { data: categories, isLoading: catsLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: getCategories
    });
    const { data: transactions, isLoading: transLoading } = useQuery({
        queryKey: ['transactions'],
        queryFn: getTransactions
    });

    // Form state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [addedBy, setAddedBy] = useState('');
    const [date, setDate] = useState('');

    // Hierarchical category selection (3-step)
    const [selectedType, setSelectedType] = useState('');
    const [selectedParent, setSelectedParent] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // UI state
    const [period, setPeriod] = useState('monthly');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isEditMode, setIsEditMode] = useState(false);

    // Category management state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState('expense');
    const [newCategoryParentId, setNewCategoryParentId] = useState('');

    // Period navigation functions
    const navigatePeriod = (direction) => {
        const newDate = new Date(currentDate);
        if (period === 'weekly') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (period === 'monthly') {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    // Reset to current period when changing filter type
    const changePeriod = (newPeriod) => {
        setPeriod(newPeriod);
        setCurrentDate(new Date());
    };

    // Create transaction mutation
    const createMutation = useMutation({
        mutationFn: createTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setAmount('');
            setSelectedType('');
            setSelectedParent('');
            setSelectedCategory('');
            setDescription('');
            setAddedBy('');
            setDate('');
        }
    });

    // Delete transaction mutation
    const deleteMutation = useMutation({
        mutationFn: deleteTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
    });

    // Create category mutation
    const createCategoryMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setNewCategoryName('');
            setNewCategoryType('expense');
            setNewCategoryParentId('');
        },
        onError: (err) => {
            alert(`שגיאה ביצירת קטגוריה: ${err.response?.data?.error || err.message}`);
        }
    });

    // Delete category mutation
    const deleteCategoryMutation = useMutation({
        mutationFn: forceDeleteCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (err) => {
            alert(`שגיאה במחיקת קטגוריה: ${err.response?.data?.error || err.message}`);
        }
    });

    // Handle form submit
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || !selectedCategory) {
            alert("נא למלא סכום ולבחור קטגוריה");
            return;
        }
        const payload = {
            amount: parseFloat(amount),
            categoryId: parseInt(selectedCategory),
            description: description || '',
            addedBy: addedBy || 'מערכת'
        };

        // Add date only if specified
        if (date) {
            payload.date = new Date(date).toISOString();
        }

        createMutation.mutate(payload);
    };

    // Category filtering helpers
    const rootCategories = useMemo(() => {
        return (categories || []).filter(c => !c.parentId);
    }, [categories]);

    const parentCategories = useMemo(() => {
        if (!selectedType) return [];
        return rootCategories.filter(c => c.type === selectedType);
    }, [selectedType, rootCategories]);

    const subCategories = useMemo(() => {
        if (!selectedParent) return [];
        return (categories || []).filter(c => c.parentId === parseInt(selectedParent));
    }, [selectedParent, categories]);

    // Filtered transactions by period
    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            if (period === 'weekly') {
                // Get start of viewing week (Sunday)
                const currentDay = currentDate.getDay();
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDay);
                startOfWeek.setHours(0, 0, 0, 0);

                // Get end of viewing week (Saturday)
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                return tDate >= startOfWeek && tDate <= endOfWeek;
            }
            if (period === 'monthly') {
                return tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
            }
            return true; // 'all'
        });
    }, [transactions, period, currentDate]);

    // Calculate statistics
    const totalIncome = (filteredTransactions || [])
        .filter(t => t.category?.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = (filteredTransactions || [])
        .filter(t => t.category?.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    // Pie chart data - expenses by category
    const expenseByCategory = useMemo(() => {
        const result = {};
        (filteredTransactions || [])
            .filter(t => t.category?.type === 'expense')
            .forEach(t => {
                const catName = t.category?.name || 'אחר';
                result[catName] = (result[catName] || 0) + t.amount;
            });
        return Object.entries(result).map(([name, value]) => ({ name, value }));
    }, [filteredTransactions]);

    // Color map for consistent colors
    const colorMap = useMemo(() => {
        const map = {};
        (categories || []).forEach((c, i) => {
            map[c.name] = COLORS[i % COLORS.length];
        });
        return map;
    }, [categories]);

    // Loading state
    if (catsLoading || transLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-stone-50">
                <div className="text-center">
                    <div className="text-xl font-bold text-stone-600">טוען...</div>
                </div>
            </div>
        );
    }

    const today = new Date().toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    });

    return (
        <div className="min-h-screen bg-stone-50 p-4 md:p-8" dir="rtl">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black text-stone-800">ניהול תקציב ביתי</h1>
                    <p className="text-stone-500 font-bold mt-1">{today}</p>
                </div>
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={clsx(
                        "px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 shadow-md",
                        isEditMode
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-white text-stone-600 hover:bg-stone-100 border-2 border-stone-200"
                    )}
                >
                    <Edit3 size={20} strokeWidth={2.5} />
                    {isEditMode ? 'סיום עריכה' : 'מצב עריכה'}
                </button>
            </div>

            {/* Category Management Panel (Only in Edit Mode) */}
            {isEditMode && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border-2 border-amber-200 p-6 mb-8 shadow-lg">
                    <h2 className="text-xl font-black text-amber-900 mb-6 flex items-center gap-2">
                        <Edit3 size={24} />
                        ניהול קטגוריות
                    </h2>

                    {/* Add Category Form */}
                    <div className="bg-white rounded-2xl p-4 mb-6">
                        <h3 className="text-sm font-black text-stone-700 mb-4">הוספת קטגוריה חדשה</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="שם הקטגוריה..."
                                    className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                />
                                <select
                                    value={newCategoryType}
                                    onChange={e => {
                                        setNewCategoryType(e.target.value);
                                        setNewCategoryParentId('');
                                    }}
                                    className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="expense">🔴 הוצאה</option>
                                    <option value="income">🟢 הכנסה</option>
                                </select>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select
                                    value={newCategoryParentId}
                                    onChange={e => setNewCategoryParentId(e.target.value)}
                                    className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="">קטגוריה ראשית (ללא הורה)</option>
                                    {rootCategories
                                        .filter(c => c.type === newCategoryType)
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                תחת: {cat.name}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    onClick={() => {
                                        if (!newCategoryName.trim()) {
                                            alert('נא להזין שם קטגוריה');
                                            return;
                                        }
                                        const payload = {
                                            name: newCategoryName,
                                            type: newCategoryType
                                        };
                                        if (newCategoryParentId) {
                                            payload.parentId = parseInt(newCategoryParentId);
                                        }
                                        createCategoryMutation.mutate(payload);
                                    }}
                                    disabled={createCategoryMutation.isPending}
                                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-black rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Plus size={20} strokeWidth={3} />
                                    הוסף
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Categories List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Expense Categories */}
                        <div className="bg-white rounded-2xl p-4">
                            <h3 className="text-sm font-black text-rose-700 mb-3">🔴 קטגוריות הוצאה</h3>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {(categories || [])
                                    .filter(c => c.type === 'expense')
                                    .map(cat => (
                                        <div key={cat.id}>
                                            {/* Parent Category */}
                                            {!cat.parentId && (
                                                <div className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg group">
                                                    <span className="font-black text-stone-800">{cat.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(`למחוק את הקטגוריה "${cat.name}"?\n\nשים לב: כל התת-קטגוריות, התנועות וההוצאות הקבועות המשויכות יימחקו!`)) {
                                                                deleteCategoryMutation.mutate(cat.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            {/* Sub-categories */}
                                            {(categories || [])
                                                .filter(sub => sub.parentId === cat.id)
                                                .map(subCat => (
                                                    <div key={subCat.id} className="flex items-center justify-between p-2 pr-6 hover:bg-stone-50 rounded-lg group">
                                                        <span className="font-bold text-stone-600 text-sm">↳ {subCat.name}</span>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`למחוק את התת-קטגוריה "${subCat.name}"?\n\nשים לב: כל התנועות וההוצאות הקבועות המשויכות יימחקו!`)) {
                                                                    deleteCategoryMutation.mutate(subCat.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    ))}
                                {(categories || []).filter(c => c.type === 'expense').length === 0 && (
                                    <p className="text-xs text-stone-400 text-center py-4">אין קטגוריות הוצאה</p>
                                )}
                            </div>
                        </div>

                        {/* Income Categories */}
                        <div className="bg-white rounded-2xl p-4">
                            <h3 className="text-sm font-black text-green-700 mb-3">🟢 קטגוריות הכנסה</h3>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {(categories || [])
                                    .filter(c => c.type === 'income')
                                    .map(cat => (
                                        <div key={cat.id}>
                                            {/* Parent Category */}
                                            {!cat.parentId && (
                                                <div className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg group">
                                                    <span className="font-black text-stone-800">{cat.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(`למחוק את הקטגוריה "${cat.name}"?\n\nשים לב: כל התת-קטגוריות והתנועות המשויכות יימחקו!`)) {
                                                                deleteCategoryMutation.mutate(cat.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            {/* Sub-categories */}
                                            {(categories || [])
                                                .filter(sub => sub.parentId === cat.id)
                                                .map(subCat => (
                                                    <div key={subCat.id} className="flex items-center justify-between p-2 pr-6 hover:bg-stone-50 rounded-lg group">
                                                        <span className="font-bold text-stone-600 text-sm">↳ {subCat.name}</span>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`למחוק את התת-קטגוריה "${subCat.name}"?\n\nשים לב: כל התנועות המשויכות יימחקו!`)) {
                                                                    deleteCategoryMutation.mutate(subCat.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    ))}
                                {(categories || []).filter(c => c.type === 'income').length === 0 && (
                                    <p className="text-xs text-stone-400 text-center py-4">אין קטגוריות הכנסה</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title="יתרה"
                    value={balance}
                    icon={Wallet}
                    color="blue"
                />
                <StatCard
                    title="הכנסות"
                    value={totalIncome}
                    icon={TrendingUp}
                    color="green"
                />
                <StatCard
                    title="הוצאות"
                    value={totalExpense}
                    icon={TrendingDown}
                    color="red"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Add Transaction Form */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                    <h2 className="text-xl font-black text-stone-800 mb-6">הוספת תנועה חדשה</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">סכום</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">בחירת קטגוריה (שלב 1/3: סוג)</label>
                                <select
                                    value={selectedType}
                                    onChange={e => {
                                        setSelectedType(e.target.value);
                                        setSelectedParent('');
                                        setSelectedCategory('');
                                    }}
                                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                >
                                    <option value="">בחר סוג...</option>
                                    <option value="expense">🔴 הוצאה</option>
                                    <option value="income">🟢 הכנסה</option>
                                </select>
                            </div>
                        </div>

                        {/* Step 2: Parent Category (shown only if type is selected) */}
                        {selectedType && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-600 mb-2">
                                        שלב 2: קטגוריה ראשית
                                    </label>
                                    <select
                                        value={selectedParent}
                                        onChange={e => {
                                            const newParent = e.target.value;
                                            setSelectedParent(newParent);
                                            // Auto-select parent if no sub-categories exist
                                            const hasSubs = (categories || []).some(c => c.parentId === parseInt(newParent));
                                            if (!hasSubs && newParent) {
                                                setSelectedCategory(newParent);
                                            } else {
                                                setSelectedCategory('');
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    >
                                        <option value="">בחר קטגוריה...</option>
                                        {parentCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Sub Category (shown only if parent has children) */}
                        {selectedParent && subCategories.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-600 mb-2">
                                        שלב 3 (אופציונלי): תת-קטגוריה
                                    </label>
                                    <select
                                        value={selectedCategory === selectedParent ? '' : selectedCategory}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setSelectedCategory(val || selectedParent);
                                        }}
                                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    >
                                        <option value="">השתמש בקטגוריה הראשית</option>
                                        {subCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-stone-500 mt-1">
                                        💡 ניתן להשאיר ריק לשימוש בקטגוריה הראשית
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">תיאור</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="מה קנינו?"
                                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">מי רשם?</label>
                                <input
                                    type="text"
                                    value={addedBy}
                                    onChange={e => setAddedBy(e.target.value)}
                                    placeholder="שם..."
                                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-stone-600 mb-2">תאריך (אופציונלי)</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                                <p className="text-xs text-stone-500 mt-1 font-bold">
                                    💡 השאר ריק לתאריך היום
                                </p>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Plus size={24} strokeWidth={3} />
                            הוסף תנועה
                        </button>
                    </form>
                </div>

                {/* Pie Chart */}
                <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 flex flex-col">
                    <h2 className="text-xl font-black text-stone-800 mb-4">פיזור הוצאות</h2>
                    <div className="flex-1 flex items-center justify-center">
                        {expenseByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={expenseByCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseByCategory.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={colorMap[entry.name] || COLORS[index % COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-stone-400 font-bold">
                                אין הוצאות להצגה
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {expenseByCategory.slice(0, 6).map((entry, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: colorMap[entry.name] || COLORS[i % COLORS.length] }}
                                />
                                <span className="text-xs font-bold text-stone-600 truncate">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h2 className="text-xl font-black text-stone-800">היסטוריית תנועות</h2>

                    {/* Period Filter with Navigation */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        {/* Filter Buttons */}
                        <div className="flex gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-100">
                            {[
                                { value: 'weekly', label: 'שבועי' },
                                { value: 'monthly', label: 'חודשי' },
                                { value: 'all', label: 'הכל' }
                            ].map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => changePeriod(p.value)}
                                    className={clsx(
                                        "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                        period === p.value
                                            ? "bg-white text-blue-600 shadow-sm"
                                            : "text-stone-400 hover:text-stone-600"
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Navigation Arrows (only for weekly/monthly) */}
                        {period !== 'all' && (
                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                <button
                                    onClick={() => navigatePeriod(-1)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                    title={period === 'weekly' ? 'שבוע קודם' : 'חודש קודם'}
                                >
                                    <ChevronRight size={18} strokeWidth={3} />
                                </button>
                                <span className="text-xs font-black text-blue-700 min-w-[100px] text-center">
                                    {period === 'weekly'
                                        ? `שבוע ${(() => {
                                            const day = currentDate.getDay();
                                            const start = new Date(currentDate);
                                            start.setDate(currentDate.getDate() - day);
                                            const end = new Date(start);
                                            end.setDate(start.getDate() + 6);
                                            return `${start.getDate()}/${start.getMonth() + 1}-${end.getDate()}/${end.getMonth() + 1}`;
                                        })()}`
                                        : `${currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`
                                    }
                                </span>
                                <button
                                    onClick={() => navigatePeriod(1)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                    title={period === 'weekly' ? 'שבוע הבא' : 'חודש הבא'}
                                >
                                    <ChevronLeft size={18} strokeWidth={3} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-stone-100">
                                <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">תאריך</th>
                                <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">מי רשם</th>
                                <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">תיאור</th>
                                <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">קטגוריה</th>
                                <th className="text-left py-3 px-4 text-xs font-black text-stone-400 uppercase">סכום</th>
                                <th className="text-center py-3 px-4 text-xs font-black text-stone-400 uppercase">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {(filteredTransactions || []).map(transaction => (
                                <tr key={transaction.id} className="group hover:bg-stone-50 transition-colors">
                                    <td className="py-4 px-4 text-sm font-bold text-stone-500">
                                        {new Date(transaction.date).toLocaleDateString('he-IL', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit'
                                        })}
                                    </td>
                                    <td className="py-4 px-4 text-sm font-black text-blue-600">
                                        {transaction.addedBy}
                                    </td>
                                    <td className="py-4 px-4 text-sm font-medium text-stone-600">
                                        {transaction.description || '-'}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${transaction.category?.type === 'income'
                                            ? 'bg-emerald-50 text-emerald-600'
                                            : 'bg-rose-50 text-rose-600'
                                            }`}>
                                            {transaction.category?.name || 'לא ידוע'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-left text-lg font-black text-stone-800">
                                        {transaction.amount.toLocaleString()} ₪
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <button
                                            onClick={() => {
                                                if (window.confirm('למחוק תנועה זו?')) {
                                                    deleteMutation.mutate(transaction.id);
                                                }
                                            }}
                                            className="p-2 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {(!filteredTransactions || filteredTransactions.length === 0) && (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-stone-400 font-bold">
                                        אין תנועות בתקופה זו
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-emerald-50 border-emerald-100 text-emerald-600',
        red: 'bg-rose-50 border-rose-100 text-rose-600'
    };

    return (
        <div className={`${colorClasses[color]} rounded-3xl border-2 p-6 flex items-center gap-4 transition-transform hover:scale-105`}>
            <div className="p-4 bg-white rounded-2xl shadow-sm">
                <Icon size={32} strokeWidth={2.5} />
            </div>
            <div>
                <div className="text-xs font-bold opacity-70 mb-1">{title}</div>
                <div className="text-3xl font-black tracking-tight">
                    {value.toLocaleString()} ₪
                </div>
            </div>
        </div>
    );
}
