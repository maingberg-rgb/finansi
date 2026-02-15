import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getTransactions, createTransaction, updateTransaction, deleteTransaction, createCategory, forceDeleteCategory, getFixedExpenses, createFixedExpense, deleteFixedExpense, updateCategoryBudget } from '../lib/api';
import { useState, useMemo } from 'react';
import { Plus, Wallet, TrendingDown, TrendingUp, Trash2, ChevronLeft, ChevronRight, Edit3, X, Check, Save, RefreshCw, CalendarRange, PieChart as PieChartIcon, LayoutDashboard, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from 'recharts';
import clsx from 'clsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard() {
    const queryClient = useQueryClient();

    // Data fetching
    const { data: categories, isLoading: catsLoading, isFetching: isCatsFetching } = useQuery({
        queryKey: ['categories'],
        queryFn: getCategories
    });
    const { data: transactions, isLoading: transLoading, isFetching: isTransFetching } = useQuery({
        queryKey: ['transactions'],
        queryFn: getTransactions
    });
    const { data: fixedExpenses, isLoading: fixedLoading, isFetching: isFixedFetching } = useQuery({
        queryKey: ['fixed-expenses'],
        queryFn: getFixedExpenses
    });

    const isRefreshing = isCatsFetching || isTransFetching || isFixedFetching;

    const handleRefresh = () => {
        queryClient.invalidateQueries();
    };

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
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'budget'

    // Budget Analysis State
    const [analysisRange, setAnalysisRange] = useState({
        from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    // Category management state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState('expense');
    const [newCategoryParentId, setNewCategoryParentId] = useState('');

    // Fixed expense state
    const [newFixedName, setNewFixedName] = useState('');
    const [newFixedAmount, setNewFixedAmount] = useState('');
    const [newFixedCategoryId, setNewFixedCategoryId] = useState('');

    // Inline editing state
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        amount: '',
        description: '',
        date: '',
        categoryId: ''
    });

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

    // Update transaction mutation
    const updateMutation = useMutation({
        mutationFn: updateTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setEditingId(null);
        },
        onError: (err) => {
            alert(`שגיאה בעדכון תנועה: ${err.response?.data?.error || err.message}`);
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

    // Fixed expense mutations
    const createFixedMutation = useMutation({
        mutationFn: createFixedExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            setNewFixedName('');
            setNewFixedAmount('');
            setNewFixedCategoryId('');
        }
    });

    const deleteFixedMutation = useMutation({
        mutationFn: deleteFixedExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
        }
    });

    // Budget mutation
    const updateBudgetMutation = useMutation({
        mutationFn: updateCategoryBudget,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
    });

    const [analysisResults, setAnalysisResults] = useState(null);

    const performAnalysis = () => {
        if (!transactions || !analysisRange.from || !analysisRange.to) return;

        const from = new Date(analysisRange.from);
        const to = new Date(analysisRange.to);
        to.setHours(23, 59, 59, 999);

        const filtered = transactions.filter(t => {
            const d = new Date(t.date);
            return d >= from && d <= to;
        });

        const aggregation = {};
        filtered.forEach(t => {
            const name = t.category?.name || 'אחר';
            if (!aggregation[name]) {
                aggregation[name] = { amount: 0, type: t.category?.type || 'expense', count: 0 };
            }
            aggregation[name].amount += t.amount;
            aggregation[name].count += 1;
        });

        setAnalysisResults(Object.entries(aggregation).map(([name, data]) => ({ name, ...data })));
    };

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

    // Handle Edit start
    const startEdit = (tx) => {
        setEditingId(tx.id);
        setEditForm({
            amount: tx.amount.toString(),
            description: tx.description || '',
            date: new Date(tx.date).toISOString().split('T')[0],
            categoryId: tx.categoryId.toString()
        });
    };

    // Handle Edit save
    const saveEdit = () => {
        if (!editForm.amount || !editForm.categoryId) {
            alert("נא למלא סכום וקטגוריה");
            return;
        }

        updateMutation.mutate({
            id: editingId,
            amount: parseFloat(editForm.amount),
            description: editForm.description,
            date: new Date(editForm.date).toISOString(),
            categoryId: parseInt(editForm.categoryId)
        });
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
    const totalIncome = useMemo(() => {
        return filteredTransactions
            .filter(t => t.category?.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
    }, [filteredTransactions]);

    const totalFixed = useMemo(() => {
        return (fixedExpenses || []).reduce((sum, f) => sum + f.amount, 0);
    }, [fixedExpenses]);

    const totalExpenses = useMemo(() => {
        const variable = filteredTransactions
            .filter(t => t.category?.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        return variable + totalFixed;
    }, [filteredTransactions, totalFixed]);

    const balance = totalIncome - totalExpenses;

    // Budget Progress Data (Weekly)
    const budgetProgress = useMemo(() => {
        if (!categories || !transactions) return [];

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const weekTrans = transactions.filter(t => new Date(t.date) >= startOfWeek);

        return categories
            .filter(c => c.type === 'expense' && c.weeklyBudget)
            .map(c => {
                const spent = weekTrans
                    .filter(t => t.categoryId === c.id || (t.category?.parentId === c.id))
                    .reduce((sum, t) => sum + t.amount, 0);

                // Add proportional fixed expenses (weekly part)
                const catFixed = (fixedExpenses || [])
                    .filter(f => f.categoryId === c.id)
                    .reduce((sum, f) => sum + f.amount, 0) / 4;

                const totalSpent = spent + catFixed;
                const percent = Math.min((totalSpent / c.weeklyBudget) * 100, 100);

                return { ...c, spent: totalSpent, percent };
            });
    }, [categories, transactions, fixedExpenses]);

    // MoM Analysis logic
    const momAnalysis = useMemo(() => {
        if (!transactions) return [];

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        const getMonthStats = (m, y) => {
            const stats = {};
            transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === m && d.getFullYear() === y;
            }).forEach(t => {
                const name = t.category?.name || 'אחר';
                stats[name] = (stats[name] || 0) + t.amount;
            });
            return stats;
        };

        const currentStats = getMonthStats(thisMonth, thisYear);
        const prevStats = getMonthStats(lastMonth, lastMonthYear);

        return Object.keys({ ...currentStats, ...prevStats }).map(name => {
            const cur = currentStats[name] || 0;
            const prev = prevStats[name] || 0;
            const diff = cur - prev;
            const pct = prev === 0 ? 100 : ((cur - prev) / prev) * 100;
            return { name, cur, prev, diff, pct };
        }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    }, [transactions]);

    // Pie chart data - expenses by category (Variable + Fixed)
    const expenseByCategory = useMemo(() => {
        const counts = {};

        // Add variable transactions
        filteredTransactions
            .filter(t => t.category?.type === 'expense')
            .forEach(t => {
                const name = t.category?.name || 'אחר';
                counts[name] = (counts[name] || 0) + t.amount;
            });

        // Add fixed expenses
        (fixedExpenses || []).forEach(f => {
            const name = f.category?.name || 'הוצאה קבועה';
            counts[name] = (counts[name] || 0) + f.amount;
        });

        return Object.entries(counts).map(([name, amount]) => ({ name, amount }));
    }, [filteredTransactions, fixedExpenses]);

    // Comparison Chart Data
    const comparisonData = useMemo(() => ([
        { name: 'הכנסות', amount: totalIncome, fill: '#10b981' },
        { name: 'הוצאות', amount: totalExpenses, fill: '#ef4444' }
    ]), [totalIncome, totalExpenses]);

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
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className={clsx(
                            "p-3 rounded-xl bg-white text-stone-600 hover:bg-stone-50 border-2 border-stone-100 transition-all shadow-sm flex items-center gap-2 font-bold",
                            isRefreshing && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isRefreshing}
                        title="רענן נתונים"
                    >
                        <RefreshCw size={20} className={clsx(isRefreshing && "animate-spin")} />
                        <span className="hidden sm:inline">רענן</span>
                    </button>
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
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 mb-8 border-b-2 border-stone-100">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={clsx(
                        "pb-4 px-4 text-sm font-black transition-all flex items-center gap-2 relative",
                        activeTab === 'dashboard' ? "text-blue-600" : "text-stone-400 hover:text-stone-600"
                    )}
                >
                    <LayoutDashboard size={20} />
                    פאנל
                    {activeTab === 'dashboard' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('budget')}
                    className={clsx(
                        "pb-4 px-4 text-sm font-black transition-all flex items-center gap-2 relative",
                        activeTab === 'budget' ? "text-blue-600" : "text-stone-400 hover:text-stone-600"
                    )}
                >
                    <Target size={20} />
                    ניהול תקציב
                    {activeTab === 'budget' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                </button>
            </div>

            {activeTab === 'dashboard' ? (
                <>
                    {/* Panel View Content (Existing Dashboard) */}

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

                            {/* Fixed Expenses Panel */}
                            <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200">
                                <h2 className="text-xl font-black text-stone-800 mb-6 flex items-center gap-2">
                                    <CalendarRange className="text-amber-500" />
                                    ניהול הוצאות קבועות
                                </h2>

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!newFixedName || !newFixedAmount || !newFixedCategoryId) return;
                                        createFixedMutation.mutate({
                                            name: newFixedName,
                                            amount: parseFloat(newFixedAmount),
                                            categoryId: parseInt(newFixedCategoryId)
                                        });
                                    }}
                                    className="space-y-4 mb-8 bg-white p-4 rounded-xl border border-stone-100 shadow-sm"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            placeholder="שם ההוצאה (למשל: שכירות)"
                                            value={newFixedName}
                                            onChange={e => setNewFixedName(e.target.value)}
                                            className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="סכום חודשי"
                                            value={newFixedAmount}
                                            onChange={e => setNewFixedAmount(e.target.value)}
                                            className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            required
                                        />
                                        <select
                                            value={newFixedCategoryId}
                                            onChange={e => setNewFixedCategoryId(e.target.value)}
                                            className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                            required
                                        >
                                            <option value="">בחר קטגוריה...</option>
                                            {(categories || []).filter(c => c.type === 'expense').map(cat => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.parentId ? `↳ ${cat.name}` : cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={createFixedMutation.isPending}
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2 rounded-lg transition-all"
                                    >
                                        הוסף הוצאה קבועה
                                    </button>
                                </form>

                                <div className="space-y-2">
                                    {(fixedExpenses || []).map(fixed => (
                                        <div key={fixed.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-8 bg-amber-400 rounded-full" />
                                                <div>
                                                    <div className="font-black text-stone-800">{fixed.name}</div>
                                                    <div className="text-xs font-bold text-stone-400">{fixed.category?.name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-lg font-black text-amber-600">{fixed.amount.toLocaleString()} ₪</div>
                                                <button
                                                    onClick={() => deleteFixedMutation.mutate(fixed.id)}
                                                    className="p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                <Wallet size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-stone-400 text-xs font-black uppercase">יתרה נוכחית</p>
                                <h3 className={clsx("text-2xl font-black", balance >= 0 ? "text-stone-800" : "text-rose-600")}>
                                    {balance.toLocaleString()} ₪
                                </h3>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                <TrendingUp size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-stone-400 text-xs font-black uppercase">הכנסות</p>
                                <h3 className="text-2xl font-black text-stone-800">{totalIncome.toLocaleString()} ₪</h3>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                <TrendingDown size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-stone-400 text-xs font-black uppercase">הוצאות (כולל קבועות)</p>
                                <h3 className="text-2xl font-black text-stone-800">{totalExpenses.toLocaleString()} ₪</h3>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                                <CalendarRange size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-stone-400 text-xs font-black uppercase">הוצאות קבועות</p>
                                <h3 className="text-2xl font-black text-stone-800">{totalFixed.toLocaleString()} ₪</h3>
                            </div>
                        </div>
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
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Pie Chart */}
                        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 flex flex-col">
                            <h2 className="text-xl font-black text-stone-800 mb-4">פילוח הוצאות (כולל קבועות)</h2>
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
                                                dataKey="amount"
                                            >
                                                {expenseByCategory.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-center text-stone-400 font-bold">
                                        אין הוצאות להצגה
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comparison Chart */}
                        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 flex flex-col">
                            <h2 className="text-xl font-black text-stone-800 mb-4">הכנסות מול הוצאות</h2>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={comparisonData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#78716c' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#78716c' }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="amount" radius={[10, 10, 0, 0]} barSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
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
                                        <tr key={transaction.id} className={clsx(
                                            "group transition-colors",
                                            editingId === transaction.id ? "bg-blue-50/50" : "hover:bg-stone-50"
                                        )}>
                                            {/* Date */}
                                            <td className="py-4 px-4 text-sm font-bold text-stone-500">
                                                {editingId === transaction.id ? (
                                                    <input
                                                        type="date"
                                                        value={editForm.date}
                                                        onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    new Date(transaction.date).toLocaleDateString('he-IL', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    })
                                                )}
                                            </td>

                                            {/* Added By */}
                                            <td className="py-4 px-4 text-sm font-black text-blue-600">
                                                {transaction.addedBy}
                                            </td>

                                            {/* Description */}
                                            <td className="py-4 px-4 text-sm font-medium text-stone-600">
                                                {editingId === transaction.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    transaction.description || '-'
                                                )}
                                            </td>

                                            {/* Category */}
                                            <td className="py-4 px-4">
                                                {editingId === transaction.id ? (
                                                    <select
                                                        value={editForm.categoryId}
                                                        onChange={e => setEditForm({ ...editForm, categoryId: e.target.value })}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                                                    >
                                                        {(categories || []).map(cat => (
                                                            <option key={cat.id} value={cat.id}>
                                                                {cat.parentId ? `↳ ${cat.name}` : cat.name} ({cat.type === 'expense' ? 'הוצאה' : 'הכנסה'})
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${transaction.category?.type === 'income'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-rose-50 text-rose-600'
                                                        }`}>
                                                        {transaction.category?.name || 'לא ידוע'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="py-4 px-4 text-left text-lg font-black text-stone-800">
                                                {editingId === transaction.id ? (
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <span>₪</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.amount}
                                                            onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                                            className="w-24 bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-left"
                                                        />
                                                    </div>
                                                ) : (
                                                    `${transaction.amount.toLocaleString()} ₪`
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-4 px-4 text-center">
                                                {editingId === transaction.id ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={saveEdit}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                            title="שמור שינויים"
                                                        >
                                                            <Check size={20} strokeWidth={3} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="p-2 text-stone-400 hover:bg-stone-100 rounded-lg transition-all"
                                                            title="ביטול"
                                                        >
                                                            <X size={20} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => startEdit(transaction)}
                                                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="ערוך"
                                                        >
                                                            <Edit3 size={18} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('בטוח שברצונך למחוק תנועה זו?')) {
                                                                    deleteMutation.mutate(transaction.id);
                                                                }
                                                            }}
                                                            className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="מחק"
                                                        >
                                                            <Trash2 size={18} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                )}
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
                </>
            ) : (
                <div className="space-y-8">
                    {/* Budget Management Tab */}

                    {/* Weekly Budget Tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                            <h2 className="text-xl font-black text-stone-800 mb-6 flex items-center gap-2">
                                <Target className="text-blue-500" />
                                מעקב תקציב שבועי
                            </h2>
                            <div className="space-y-6">
                                {budgetProgress.length > 0 ? budgetProgress.map(cat => (
                                    <div key={cat.id} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className="font-black text-stone-800">{cat.name}</span>
                                                <span className="text-xs text-stone-400 mr-2">({cat.spent.toLocaleString()} / {cat.weeklyBudget.toLocaleString()} ₪)</span>
                                            </div>
                                            <span className={clsx("text-xs font-black", cat.percent >= 90 ? "text-rose-600" : "text-blue-600")}>
                                                {Math.round(cat.percent)}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                                            <div
                                                className={clsx(
                                                    "h-full transition-all duration-500",
                                                    cat.percent >= 90 ? "bg-rose-500" : cat.percent >= 70 ? "bg-amber-500" : "bg-blue-500"
                                                )}
                                                style={{ width: `${cat.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-stone-400 font-bold">
                                        טרם הוגדרו יעדי תקציב שבועיים.<br />
                                        הגדר תקציב בטבלה למטה.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analysis & Comparison */}
                        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                            <h2 className="text-xl font-black text-stone-800 mb-6 flex items-center gap-2">
                                <PieChartIcon className="text-emerald-500" />
                                השוואה לחודש קודם (MoM)
                            </h2>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {momAnalysis.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 hover:bg-stone-50 rounded-xl transition-all border border-transparent hover:border-stone-100">
                                        <div>
                                            <div className="font-black text-stone-800">{item.name}</div>
                                            <div className="text-xs text-stone-400 flex items-center gap-1">
                                                {item.prev.toLocaleString()} ₪ בחודש שעבר
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-stone-800">{item.cur.toLocaleString()} ₪</div>
                                            <div className={clsx(
                                                "text-xs font-black flex items-center gap-0.5 justify-end",
                                                item.diff > 0 ? "text-rose-600" : "text-emerald-600"
                                            )}>
                                                {item.diff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {Math.abs(item.pct).toFixed(1)}%
                                                ({Math.abs(item.diff).toLocaleString()} ₪)
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Custom Date Range Analysis */}
                    <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                        <h2 className="text-xl font-black text-stone-800 mb-6 flex items-center gap-2">
                            <CalendarRange className="text-blue-500" />
                            ניתוח לפי טווח תאריכים
                        </h2>

                        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                            <div className="flex-1">
                                <label className="block text-xs font-black text-stone-400 mb-2 uppercase">מתאריך</label>
                                <input
                                    type="date"
                                    value={analysisRange.from}
                                    onChange={e => setAnalysisRange({ ...analysisRange, from: e.target.value })}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-black text-stone-400 mb-2 uppercase">עד תאריך</label>
                                <input
                                    type="date"
                                    value={analysisRange.to}
                                    onChange={e => setAnalysisRange({ ...analysisRange, to: e.target.value })}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <button
                                onClick={performAnalysis}
                                className="px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-md self-end h-[42px]"
                            >
                                נתח נתונים
                            </button>
                        </div>

                        {analysisResults && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {analysisResults.map((res, i) => (
                                    <div key={i} className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
                                        <div>
                                            <div className="font-black text-stone-800">{res.name}</div>
                                            <div className="text-xs text-stone-400 font-bold">{res.count} תנועות</div>
                                        </div>
                                        <div className={clsx(
                                            "text-lg font-black",
                                            res.type === 'income' ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {res.amount.toLocaleString()} ₪
                                        </div>
                                    </div>
                                ))}
                                {analysisResults.length === 0 && (
                                    <div className="col-span-3 text-center py-8 text-stone-400 font-bold">
                                        אין נתונים לטווח התאריכים שנבחר.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Budget Settings Table */}
                    <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
                        <h2 className="text-xl font-black text-stone-800 mb-6">הגדרות תקציב לפי קטגוריה</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-stone-100">
                                        <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">קטגוריה</th>
                                        <th className="text-right py-3 px-4 text-xs font-black text-stone-400 uppercase">סוג</th>
                                        <th className="text-left py-3 px-4 text-xs font-black text-stone-400 uppercase">תקציב שבועי (₪)</th>
                                        <th className="text-center py-3 px-4 text-xs font-black text-stone-400 uppercase">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {categories?.map(cat => (
                                        <tr key={cat.id} className="hover:bg-stone-50 transition-colors group">
                                            <td className="py-4 px-4 font-black text-stone-800">
                                                {cat.parentId ? `↳ ${cat.name}` : cat.name}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                                                    cat.type === 'expense' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    {cat.type === 'expense' ? 'הוצאה' : 'הכנסה'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-left">
                                                <input
                                                    type="number"
                                                    defaultValue={cat.weeklyBudget || ''}
                                                    onBlur={(e) => {
                                                        const val = e.target.value;
                                                        if (val !== (cat.weeklyBudget || '').toString()) {
                                                            updateBudgetMutation.mutate({ id: cat.id, weeklyBudget: val ? parseFloat(val) : null });
                                                        }
                                                    }}
                                                    className="w-32 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 font-bold text-left focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="לא הוגדר"
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {updateBudgetMutation.isPending && <RefreshCw size={16} className="animate-spin text-blue-500 mx-auto" />}
                                                {!updateBudgetMutation.isPending && cat.weeklyBudget && <Check size={16} className="text-emerald-500 mx-auto" />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
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
