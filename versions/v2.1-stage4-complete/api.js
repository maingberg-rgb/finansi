import axios from 'axios';

const api = axios.create({
    baseURL: '/api/',
});

export const getCategories = async () => {
    const { data } = await api.get('categories');
    return data;
};

export const createCategory = async (category) => {
    const { data } = await api.post('categories', category);
    return data;
};

export const deleteCategory = async (id) => {
    const { data } = await api.delete(`categories/${id}`);
    return data;
};

export const forceDeleteCategory = async (id) => {
    const { data } = await api.delete(`categories/${id}/force`);
    return data;
};

export const getTransactions = async () => {
    const { data } = await api.get('transactions');
    return data;
};

export const createTransaction = async (transaction) => {
    const { data } = await api.post('transactions', transaction);
    return data;
};

export const updateTransaction = async ({ id, ...transaction }) => {
    const { data } = await api.put(`transactions/${id}`, transaction);
    return data;
};

export const deleteTransaction = async (id) => {
    const { data } = await api.delete(`transactions/${id}`);
    return data;
};

// Fixed Expenses
export const getFixedExpenses = async () => {
    const { data } = await api.get('fixed-expenses');
    return data;
};

export const createFixedExpense = async (fixed) => {
    const { data } = await api.post('fixed-expenses', fixed);
    return data;
};

export const deleteFixedExpense = async (id) => {
    const { data } = await api.delete(`fixed-expenses/${id}`);
    return data;
};

export default api;
