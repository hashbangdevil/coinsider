// ========================================
// Budget Manager - Application Logic
// ========================================

// API Base URL
const API_BASE = './api';

// ========================================
// App State
// ========================================

const state = {
    user: null,
    categories: [],
    transactions: [],
    summary: null,
    spendingSummary: null
};

// Reset state to defaults
function resetState() {
    state.user = null;
    state.categories = [];
    state.transactions = [];
    state.summary = null;
    state.spendingSummary = null;
}

// ========================================
// Category Helper Functions
// ========================================

function getCategoryById(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    return category || { name: 'Unknown', icon: '📦', color: '#64748b' };
}

function getCategoriesByType(type) {
    return state.categories.filter(c => c.type === type);
}

function populateCategoryDropdown(selectElement, type) {
    const categories = getCategoriesByType(type);
    const currentValue = selectElement.value;

    selectElement.innerHTML = '<option value="">Select category</option>';

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icon} ${cat.name}`;
        selectElement.appendChild(option);
    });

    // Restore previous selection if still valid
    if (currentValue && categories.some(c => c.id == currentValue)) {
        selectElement.value = currentValue;
    }
}

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Screens
    authScreen: document.getElementById('auth-screen'),
    loadingScreen: document.getElementById('loading-screen'),
    appScreen: document.getElementById('app-screen'),
    
    // Auth Forms
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    forgotForm: document.getElementById('forgot-form'),
    resetForm: document.getElementById('reset-form'),
    resetSuccess: document.getElementById('reset-success'),
    
    // Header
    userName: document.getElementById('user-name'),
    currentDate: document.getElementById('current-date'),
    settingsBtn: document.getElementById('settings-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Settings
    settingsModal: document.getElementById('settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    settingsCurrency: document.getElementById('settings-currency'),
    
    // Balance
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpenses: document.getElementById('total-expenses'),
    periodSelector: document.getElementById('period-selector'),
    
    // Categories (formerly Budgets)
    categoriesList: document.getElementById('budgets-list'),
    noCategories: document.getElementById('no-budgets'),
    addCategoryBtn: document.getElementById('add-budget-btn'),
    categoryModal: document.getElementById('budget-modal'),
    categoryForm: document.getElementById('budget-form'),
    manageCategoriesBtn: document.getElementById('manage-categories-btn'),
    categoriesListModal: document.getElementById('categories-list-modal'),
    categoriesListContainer: document.getElementById('categories-list-container'),
    addCategoryFromListBtn: document.getElementById('add-category-from-list-btn'),

    // Transactions
    transactionsList: document.getElementById('transactions-list'),
    noTransactions: document.getElementById('no-transactions'),
    addTransactionBtn: document.getElementById('add-transaction-btn'),
    transactionModal: document.getElementById('transaction-modal'),
    transactionForm: document.getElementById('transaction-form'),
    transactionDate: document.getElementById('transaction-date'),
    transactionCategory: document.getElementById('transaction-category'),
    
    // Chart
    chartContainer: document.getElementById('chart-container'),
    chartWithLegend: document.getElementById('chart-with-legend'),
    noChart: document.getElementById('no-chart'),
    expenseChart: document.getElementById('expense-chart'),
    legendLeft: document.getElementById('legend-left'),
    legendRight: document.getElementById('legend-right'),
    chartHeader: document.getElementById('chart-header'),
    chartWrapper: document.getElementById('chart-wrapper'),

    // Spending Modal
    spendingModal: document.getElementById('spending-modal'),
    spendingPeriodSelector: document.getElementById('spending-period-selector'),
    spendingTableBody: document.getElementById('spending-table-body'),

    // Toast
    toast: document.getElementById('toast')
};

// ========================================
// Utility Functions
// ========================================

// Currency configuration
const CURRENCIES = {
    ZAR: { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US' },
    EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
    AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
    CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
    JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
    CHF: { code: 'CHF', symbol: 'CHF', locale: 'de-CH' },
    CNY: { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
    INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
    BRL: { code: 'BRL', symbol: 'R$', locale: 'pt-BR' },
    KES: { code: 'KES', symbol: 'KSh', locale: 'en-KE' },
    NGN: { code: 'NGN', symbol: '₦', locale: 'en-NG' }
};

function formatCurrency(amount) {
    const currency = state.user?.currency || 'ZAR';
    const config = CURRENCIES[currency] || CURRENCIES.ZAR;

    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        minimumFractionDigits: config.code === 'JPY' ? 0 : 2
    }).format(amount);
}

function getCurrencySymbol() {
    const currency = state.user?.currency || 'ZAR';
    const config = CURRENCIES[currency] || CURRENCIES.ZAR;
    return config.symbol;
}

function updateCurrencyPrefixes() {
    const symbol = getCurrencySymbol();
    document.querySelectorAll('.input-prefix').forEach(el => {
        el.textContent = symbol;
    });
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

function showToast(message, duration = 3000) {
    const toast = elements.toast;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function showScreen(screenName) {
    const screens = ['auth', 'loading', 'app'];
    screens.forEach(name => {
        const screen = document.getElementById(`${name}-screen`);
        if (screen) {
            screen.classList.toggle('active', name === screenName);
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Emoji picker functions
function setupEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;

    emojiPicker.addEventListener('click', (e) => {
        const btn = e.target.closest('.emoji-option');
        if (!btn) return;

        const emoji = btn.dataset.emoji;
        document.getElementById('category-icon').value = emoji;
        updateEmojiPickerSelection(emoji);
    });

    // Set default selection
    updateEmojiPickerSelection('📦');
}

function updateEmojiPickerSelection(emoji) {
    // Update the preview display
    const preview = document.getElementById('emoji-preview');
    if (preview) preview.textContent = emoji;

    // Update button selection state
    const buttons = document.querySelectorAll('.emoji-option');
    buttons.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.emoji === emoji);
    });
}

// ========================================
// API Functions
// ========================================

async function api(endpoint, options = {}) {
    const url = `${API_BASE}/${endpoint}`;
    
    console.log('API Request:', url, options.method || 'GET');
    
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, config);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Check PHP is working.');
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'API error');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ========================================
// Authentication
// ========================================

function showAuthForm(formName) {
    const forms = ['login', 'signup', 'forgot', 'reset', 'reset-success'];
    forms.forEach(name => {
        const form = document.getElementById(`${name}-form`) || document.getElementById(name);
        if (form) {
            form.classList.toggle('active', name === formName);
        }
    });
}

async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const data = await api('auth.php?action=status');
        
        if (data.authenticated && data.user) {
            state.user = data.user;
            console.log('User authenticated:', data.user);
            return true;
        }
        console.log('User not authenticated');
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    
    try {
        const data = await api('auth.php?action=login', {
            method: 'POST',
            body: { email, password }
        });
        
        if (data.success && data.user) {
            state.user = data.user;
            console.log('Login successful, loading data...');
            await loadAppData();
            console.log('Data loaded, state.budgets is:', state.budgets);
            console.log('state.budgets is array:', Array.isArray(state.budgets));
            showAppScreen();
            showToast(`Welcome back, ${state.user.name}!`);
        }
    } catch (error) {
        showToast(error.message || 'Login failed');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    
    try {
        const data = await api('auth.php?action=signup', {
            method: 'POST',
            body: { name, email, password }
        });
        
        if (data.success && data.user) {
            state.user = data.user;
            console.log('Signup successful, loading data...');
            await loadAppData();
            console.log('Data loaded, state.budgets is:', state.budgets);
            showAppScreen();
            showToast(`Welcome, ${state.user.name}!`);
        }
    } catch (error) {
        showToast(error.message || 'Signup failed');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    
    try {
        const data = await api('auth.php?action=forgot-password', {
            method: 'POST',
            body: { email }
        });
        
        // Show success message
        showAuthForm('reset-success');
        
        // If in dev mode, show the reset link
        if (data.reset_link) {
            console.log('Reset link (dev mode):', data.reset_link);
            showToast('Check console for reset link (dev mode)', 5000);
        }
    } catch (error) {
        showToast(error.message || 'Request failed');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;
    const token = document.getElementById('reset-token').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match');
        return;
    }
    
    submitBtn.disabled = true;
    
    try {
        const data = await api('auth.php?action=reset-password', {
            method: 'POST',
            body: { token, password }
        });
        
        if (data.success) {
            showToast('Password reset successfully!');
            showAuthForm('login');
            // Clear URL parameter
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (error) {
        showToast(error.message || 'Reset failed');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleLogout() {
    try {
        await api('auth.php?action=logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }

    state.user = null;
    state.categories = [];
    state.transactions = [];
    state.summary = null;

    // Reset forms
    elements.loginForm.reset();
    elements.signupForm.reset();
    elements.forgotForm.reset();

    showScreen('auth');
    showAuthForm('login');
    showToast('Logged out successfully');
}

async function updateUserCurrency(currency) {
    try {
        const data = await api('auth.php?action=update-settings', {
            method: 'POST',
            body: { currency }
        });
        
        if (data.success && data.user) {
            state.user = data.user;
            renderAll();
            showToast(`Currency changed to ${currency}`);
        }
    } catch (error) {
        showToast(error.message || 'Failed to update currency');
    }
}

// ========================================
// Data Loading
// ========================================

async function loadAppData() {
    try {
        const period = elements.periodSelector?.value || 'this-month';
        const [categories, transactions, summary] = await Promise.all([
            api('api.php?resource=categories'),
            api('api.php?resource=transactions&limit=50'),
            api(`api.php?resource=summary&period=${period}`)
        ]);

        console.log('Loaded categories:', categories);
        console.log('Loaded transactions:', transactions);
        console.log('Loaded summary:', summary);

        // Ensure arrays (API might return object with error)
        state.categories = Array.isArray(categories) ? categories : [];
        state.transactions = Array.isArray(transactions) ? transactions : [];
        state.summary = summary && typeof summary === 'object' ? summary : null;
    } catch (error) {
        console.error('Failed to load data:', error);
        state.categories = [];
        state.transactions = [];
        state.summary = null;
        showToast('Failed to load data');
    }
}

async function loadSummary() {
    try {
        const period = elements.periodSelector?.value || 'this-month';
        const summary = await api(`api.php?resource=summary&period=${period}`);
        state.summary = summary && typeof summary === 'object' ? summary : null;
        updateBalances();
        renderChart();
    } catch (error) {
        console.error('Failed to load summary:', error);
        showToast('Failed to load summary');
    }
}

// ========================================
// Category Functions
// ========================================

async function createCategory(name, type, icon, monthlyBudget) {
    try {
        const category = await api('api.php?resource=categories', {
            method: 'POST',
            body: { name, type, icon, monthly_budget: monthlyBudget }
        });

        state.categories.push(category);
        renderCategories();
        showToast('Category created');
        return category;
    } catch (error) {
        showToast(error.message || 'Failed to create category');
        return null;
    }
}

async function updateCategory(id, name, icon, monthlyBudget, type = null) {
    try {
        const body = { name, icon, monthly_budget: monthlyBudget };
        if (type) body.type = type;

        const category = await api(`api.php?resource=categories&id=${id}`, {
            method: 'PUT',
            body
        });

        const index = state.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            state.categories[index] = category;
        }
        renderCategories();
        showToast('Category updated');
        return category;
    } catch (error) {
        showToast(error.message || 'Failed to update category');
        return null;
    }
}

async function deleteCategory(id) {
    try {
        await api(`api.php?resource=categories&id=${id}`, { method: 'DELETE' });
        state.categories = state.categories.filter(c => c.id !== id);
        renderCategories();
        showToast('Category deleted');
    } catch (error) {
        if (error.message && error.message.includes('transactions')) {
            showToast('Cannot delete category with transactions');
        } else {
            showToast('Failed to delete category');
        }
    }
}

function renderCategories() {
    const container = elements.categoriesList;

    container.querySelectorAll('.budget-item').forEach(item => item.remove());

    // Get expense categories with budget > 0 (show budget tracking)
    const categories = Array.isArray(state.categories) ? state.categories : [];
    const expenseCategories = categories.filter(c => c.type === 'expense');
    console.log('Rendering categories:', expenseCategories);

    if (expenseCategories.length === 0) {
        elements.noCategories.style.display = 'flex';
        return;
    }

    elements.noCategories.style.display = 'none';

    expenseCategories.forEach(category => {
        const spent = category.spent || 0;
        const budget = category.monthly_budget || 0;
        const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

        let progressClass = '';
        if (budget > 0) {
            if (percentage >= 100) progressClass = 'danger';
            else if (percentage >= 80) progressClass = 'warning';
        }

        const html = `
            <div class="budget-item" data-id="${category.id}" onclick="openEditCategoryModal(${category.id})">
                <div class="budget-header">
                    <div class="budget-info">
                        <div class="budget-icon" style="background: ${category.color}20; color: ${category.color}">
                            ${category.icon}
                        </div>
                        <div class="budget-details">
                            <h4>${escapeHtml(category.name)}</h4>
                            <span>${category.type}</span>
                        </div>
                    </div>
                    <div class="budget-amount">
                        <div class="budget-spent">${formatCurrency(spent)}</div>
                        ${budget > 0 ? `<div class="budget-limit">of ${formatCurrency(budget)}</div>` : '<div class="budget-limit">no budget set</div>'}
                    </div>
                </div>
                ${budget > 0 ? `
                <div class="budget-progress">
                    <div class="budget-progress-bar ${progressClass}" style="width: ${percentage}%"></div>
                </div>
                ` : ''}
                <div class="budget-actions">
                    <button class="btn btn-delete btn-icon" onclick="event.stopPropagation(); deleteCategory(${category.id})" title="Delete category">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
    });
}

// Render categories in the list modal (for settings)
function renderCategoriesListModal() {
    const container = elements.categoriesListContainer;
    container.innerHTML = '';

    const categories = Array.isArray(state.categories) ? state.categories : [];

    if (categories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: var(--space-lg);">No categories yet. Add your first category!</p>';
        return;
    }

    // Group by type
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const incomeCategories = categories.filter(c => c.type === 'income');

    if (expenseCategories.length > 0) {
        container.innerHTML += '<h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: var(--space-sm);">Expense Categories</h4>';
        expenseCategories.forEach(cat => {
            container.innerHTML += renderCategoryListItem(cat);
        });
    }

    if (incomeCategories.length > 0) {
        container.innerHTML += '<h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-top: var(--space-lg); margin-bottom: var(--space-sm);">Income Categories</h4>';
        incomeCategories.forEach(cat => {
            container.innerHTML += renderCategoryListItem(cat);
        });
    }
}

function renderCategoryListItem(category) {
    const budget = category.monthly_budget || 0;
    const budgetText = budget > 0 ? formatCurrency(budget) + '/mo' : 'No budget';

    return `
        <div class="category-list-item" data-id="${category.id}" onclick="openEditCategoryModal(${category.id})">
            <div class="category-list-info">
                <div class="category-list-icon" style="background: ${category.color}20; color: ${category.color}">
                    ${category.icon}
                </div>
                <div class="category-list-details">
                    <span class="category-list-name">${escapeHtml(category.name)}</span>
                    <span class="category-list-meta">${budgetText}</span>
                </div>
            </div>
            <div class="category-list-actions">
                <button class="btn btn-icon btn-delete" onclick="event.stopPropagation(); deleteCategory(${category.id})" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// Helper to open edit modal for category
let editingCategoryId = null;

function openEditCategoryModal(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    // Hide the categories list modal (don't use closeModal to avoid parent logic)
    elements.categoriesListModal.classList.remove('active');

    editingCategoryId = categoryId;

    document.getElementById('budget-name').value = category.name;
    document.getElementById('budget-amount').value = category.monthly_budget || 0;
    document.getElementById('category-icon').value = category.icon;

    // Update emoji picker selection
    updateEmojiPickerSelection(category.icon);

    // Set type toggle to category's type (disabled if has transactions)
    const typeToggle = document.querySelector('.category-type-toggle');
    const hasTransactions = category.has_transactions === 1 || category.has_transactions === '1' || category.has_transactions === true;

    if (typeToggle) {
        typeToggle.classList.toggle('disabled', hasTransactions);
    }
    document.querySelectorAll('.category-type-toggle .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === category.type);
    });

    // Update modal title
    const modalTitle = elements.categoryModal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Edit Category';

    openModal(elements.categoryModal, elements.categoriesListModal);
}

// ========================================
// Transaction Functions
// ========================================

async function createTransaction(description, amount, categoryId, type, date) {
    try {
        const transaction = await api('api.php?resource=transactions', {
            method: 'POST',
            body: { description, amount, category_id: categoryId, type, date }
        });

        state.transactions.unshift(transaction);

        // Refresh summary and categories
        const period = elements.periodSelector?.value || 'this-month';
        state.summary = await api(`api.php?resource=summary&period=${period}`);
        state.categories = await api('api.php?resource=categories');

        renderAll();
        showToast('Transaction added');
    } catch (error) {
        showToast('Failed to add transaction');
    }
}

async function deleteTransaction(id) {
    try {
        await api(`api.php?resource=transactions&id=${id}`, { method: 'DELETE' });
        state.transactions = state.transactions.filter(t => t.id !== id);

        // Refresh summary and categories
        const period = elements.periodSelector?.value || 'this-month';
        state.summary = await api(`api.php?resource=summary&period=${period}`);
        state.categories = await api('api.php?resource=categories');

        renderAll();
        showToast('Transaction deleted');
    } catch (error) {
        showToast('Failed to delete transaction');
    }
}

async function updateTransaction(id, description, amount, categoryId, type, date) {
    try {
        const transaction = await api(`api.php?resource=transactions&id=${id}`, {
            method: 'PUT',
            body: { description, amount, category_id: categoryId, type, date }
        });

        // Update in state
        const index = state.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            state.transactions[index] = transaction;
        }

        // Refresh summary and categories
        const period = elements.periodSelector?.value || 'this-month';
        state.summary = await api(`api.php?resource=summary&period=${period}`);
        state.categories = await api('api.php?resource=categories');

        renderAll();
        showToast('Transaction updated');
    } catch (error) {
        showToast('Failed to update transaction');
    }
}

let editingTransactionId = null;

function openEditTransactionModal(transactionId) {
    const transaction = state.transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    editingTransactionId = transactionId;

    // Set form values
    document.getElementById('transaction-description').value = transaction.description;
    document.getElementById('transaction-amount').value = transaction.amount;
    document.getElementById('transaction-date').value = transaction.date;

    // Set type toggle
    const type = transaction.type;
    document.querySelectorAll('.transaction-type-toggle .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Populate category dropdown for this type and select the current category
    populateCategoryDropdown(elements.transactionCategory, type);

    // Select the current category
    if (transaction.category_id) {
        elements.transactionCategory.value = transaction.category_id;
    }

    // Update modal title and button text
    const modalTitle = elements.transactionModal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Edit Transaction';
    const submitBtn = document.getElementById('transaction-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save Transaction';

    openModal(elements.transactionModal);
}

function renderTransactions() {
    const container = elements.transactionsList;

    container.querySelectorAll('.transaction-item').forEach(item => item.remove());

    // Always use a local array variable to prevent errors
    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    console.log('Rendering transactions:', transactions);

    if (transactions.length === 0) {
        elements.noTransactions.style.display = 'flex';
        return;
    }

    elements.noTransactions.style.display = 'none';

    const recentTransactions = transactions.slice(0, 10);

    recentTransactions.forEach(transaction => {
        // Use category info from transaction (joined from categories table)
        const catName = transaction.category_name || transaction.category || 'Unknown';
        const catIcon = transaction.category_icon || '📦';
        const catColor = transaction.category_color || '#64748b';
        const isIncome = transaction.type === 'income';

        const html = `
            <div class="transaction-item" data-id="${transaction.id}">
                <div class="transaction-content" onclick="openEditTransactionModal(${transaction.id})">
                    <div class="transaction-icon ${transaction.type}" style="background: ${isIncome ? 'var(--color-success-light)' : catColor + '20'}">
                        ${catIcon}
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-description">${escapeHtml(transaction.description)}</div>
                        <div class="transaction-meta">${escapeHtml(catName)} • ${formatDate(transaction.date)}</div>
                    </div>
                    <div class="transaction-amount ${transaction.type}">
                        ${isIncome ? '+' : '-'}${formatCurrency(transaction.amount)}
                    </div>
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-delete btn-icon" onclick="event.stopPropagation(); deleteTransaction(${transaction.id})" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
    });
}

// ========================================
// Summary & Chart
// ========================================

function updateBalances() {
    if (!state.summary) return;
    
    const { income, expense, balance } = state.summary;
    
    elements.totalBalance.textContent = formatCurrency(balance);
    elements.totalIncome.textContent = formatCurrency(income);
    elements.totalExpenses.textContent = formatCurrency(expense);
    
    elements.totalBalance.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
}

function renderChart() {
    // Filter categories with spending > 0
    const categoriesWithSpending = (state.summary?.categories || []).filter(c => c.spent > 0);

    if (!state.summary || categoriesWithSpending.length === 0) {
        elements.noChart.style.display = 'flex';
        elements.chartWithLegend.style.display = 'none';
        return;
    }

    elements.noChart.style.display = 'none';
    elements.chartWithLegend.style.display = 'flex';

    // Defer drawing to next frame so layout is calculated
    requestAnimationFrame(() => drawChart(categoriesWithSpending));
}

function drawChart(categoriesWithSpending) {
    const data = [];
    const colors = [];
    const icons = [];

    categoriesWithSpending.forEach(item => {
        data.push(parseFloat(item.spent));
        colors.push(item.color || '#64748b');
        icons.push(item.icon || '📦');
    });

    const total = data.reduce((sum, val) => sum + val, 0);

    // Draw donut chart - fixed size
    const canvas = elements.expenseChart;
    const ctx = canvas.getContext('2d');
    const size = 160;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 65;
    const innerRadius = 42;

    let currentAngle = -Math.PI / 2;

    data.forEach((value, index) => {
        const sliceAngle = (value / total) * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();

        currentAngle += sliceAngle;
    });

    // Draw inner circle (donut hole)
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-secondary').trim() || '#1a1a2e';
    ctx.fill();

    // Draw total in center
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatCurrency(total), centerX, centerY - 6);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px DM Sans';
    ctx.fillText('Total', centerX, centerY + 10);

    // Split legend items between left and right columns
    const midpoint = Math.ceil(categoriesWithSpending.length / 2);
    const leftItems = categoriesWithSpending.slice(0, midpoint);
    const rightItems = categoriesWithSpending.slice(midpoint);

    const renderLegendItem = (item, index) => {
        const percentage = ((parseFloat(item.spent) / total) * 100).toFixed(0);
        return `
            <div class="legend-item">
                <div class="legend-color" style="background: ${colors[index]}"></div>
                <span class="legend-label">${icons[index]} ${item.name}</span>
                <span class="legend-value">${percentage}%</span>
            </div>
        `;
    };

    elements.legendLeft.innerHTML = leftItems.map((item, i) => renderLegendItem(item, i)).join('');
    elements.legendRight.innerHTML = rightItems.map((item, i) => renderLegendItem(item, i + midpoint)).join('');
}

function renderSpendingTable(sortKey = 'spent', sortDir = 'desc') {
    const summary = state.spendingSummary || state.summary;
    if (!summary || !summary.categories) {
        elements.spendingTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    // Get all expense categories (not just those with spending)
    let categories = summary.categories.map(c => ({
        ...c,
        spent: parseFloat(c.spent) || 0,
        budget: parseFloat(c.monthly_budget) || 0,
        percent: c.monthly_budget > 0 ? (parseFloat(c.spent) / parseFloat(c.monthly_budget)) * 100 : 0
    }));

    // Sort
    categories.sort((a, b) => {
        let valA, valB;
        switch (sortKey) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            case 'spent':
                valA = a.spent;
                valB = b.spent;
                break;
            case 'budget':
                valA = a.budget;
                valB = b.budget;
                break;
            case 'percent':
                valA = a.percent;
                valB = b.percent;
                break;
            default:
                valA = a.spent;
                valB = b.spent;
        }
        return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    elements.spendingTableBody.innerHTML = categories.map(cat => {
        const percentClass = cat.percent >= 100 ? 'over-budget' :
                            cat.percent >= 80 ? 'near-budget' :
                            'under-budget';
        const percentDisplay = cat.budget > 0 ? `${cat.percent.toFixed(0)}%` : '—';

        return `
            <tr>
                <td>
                    <div class="category-cell">
                        <span class="category-color" style="background: ${cat.color}"></span>
                        <span class="category-icon">${cat.icon}</span>
                        ${cat.name}
                    </div>
                </td>
                <td class="amount-cell">${formatCurrency(cat.spent)}</td>
                <td class="amount-cell">${cat.budget > 0 ? formatCurrency(cat.budget) : '—'}</td>
                <td class="percent-cell ${percentClass}">${percentDisplay}</td>
            </tr>
        `;
    }).join('');
}

// ========================================
// UI Helpers
// ========================================

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    elements.currentDate.textContent = now.toLocaleDateString('en-US', options);
    
    // Set default date for transaction form
    elements.transactionDate.value = now.toISOString().split('T')[0];
}

function showAppScreen() {
    // Ensure state has valid arrays before rendering
    if (!Array.isArray(state.categories)) state.categories = [];
    if (!Array.isArray(state.transactions)) state.transactions = [];

    elements.userName.textContent = state.user ? state.user.name.split(' ')[0] : 'User';
    updateDate();
    renderAll();
    showScreen('app');
}

function renderAll() {
    renderCategories();
    renderTransactions();
    updateBalances();
    renderChart();
    updateCurrencyPrefixes();
}

// ========================================
// Modal Management
// ========================================

// Track modal parent relationships
let modalParent = null;

function openModal(modal, parent = null) {
    modalParent = parent;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');

    // Reopen parent modal if exists
    if (modalParent) {
        const parent = modalParent;
        modalParent = null;
        openModal(parent);
    } else {
        document.body.style.overflow = '';
    }
}

function setupModals() {
    // Category Modal (formerly Budget Modal)
    elements.addCategoryBtn.addEventListener('click', () => {
        elements.categoryForm.reset();
        editingCategoryId = null;

        // Reset modal title
        const modalTitle = elements.categoryModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Category';

        // Reset type toggle to expense and enable it
        const typeToggle = document.querySelector('.category-type-toggle');
        if (typeToggle) typeToggle.classList.remove('disabled');
        document.querySelectorAll('.category-type-toggle .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'expense');
        });

        // Set default icon value
        const iconInput = document.getElementById('category-icon');
        if (iconInput) iconInput.value = '📦';
        updateEmojiPickerSelection('📦');

        openModal(elements.categoryModal);
    });

    // Category type toggle - use event delegation
    const categoryTypeToggle = document.querySelector('.category-type-toggle');
    if (categoryTypeToggle) {
        categoryTypeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.type-btn');
            if (!btn) return;

            // If disabled, show toast message instead of changing
            if (categoryTypeToggle.classList.contains('disabled')) {
                showToast('Type cannot be changed (category has transactions)');
                return;
            }

            categoryTypeToggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    }

    elements.categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('budget-name').value;
        const amount = parseFloat(document.getElementById('budget-amount').value) || 0;
        const icon = document.getElementById('category-icon')?.value || '📦';
        const type = document.querySelector('.category-type-toggle .type-btn.active')?.dataset.type || 'expense';

        const wasEditing = editingCategoryId !== null;

        if (editingCategoryId) {
            // Update existing category (pass type in case it was changed)
            await updateCategory(editingCategoryId, name, icon, amount, type);
        } else {
            // Create new category with selected type
            await createCategory(name, type, icon, amount);
        }

        editingCategoryId = null;

        // Re-render the categories list if we're returning to it
        if (modalParent === elements.categoriesListModal) {
            renderCategoriesListModal();
        }

        closeModal(elements.categoryModal);
    });

    // Transaction Modal
    elements.addTransactionBtn.addEventListener('click', () => {
        elements.transactionForm.reset();
        editingTransactionId = null;
        elements.transactionDate.value = new Date().toISOString().split('T')[0];
        document.querySelectorAll('.transaction-type-toggle .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'expense');
        });

        // Populate category dropdown with expense categories by default
        populateCategoryDropdown(elements.transactionCategory, 'expense');

        // Reset modal title and button text
        const modalTitle = elements.transactionModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Transaction';
        const submitBtn = document.getElementById('transaction-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Add Transaction';

        openModal(elements.transactionModal);
    });

    // Transaction type toggle - update category dropdown when type changes
    document.querySelectorAll('.transaction-type-toggle .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.transaction-type-toggle .type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update category dropdown based on selected type
            const type = btn.dataset.type;
            populateCategoryDropdown(elements.transactionCategory, type);
        });
    });

    elements.transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('transaction-description').value;
        const amount = document.getElementById('transaction-amount').value;
        const categoryId = document.getElementById('transaction-category').value;
        const date = document.getElementById('transaction-date').value;
        const type = document.querySelector('.type-btn.active').dataset.type;

        if (!categoryId) {
            showToast('Please select a category');
            return;
        }

        if (editingTransactionId) {
            await updateTransaction(editingTransactionId, description, parseFloat(amount), parseInt(categoryId), type, date);
        } else {
            await createTransaction(description, parseFloat(amount), parseInt(categoryId), type, date);
        }

        editingTransactionId = null;
        closeModal(elements.transactionModal);
    });
    
    // Settings Modal
    elements.settingsBtn.addEventListener('click', () => {
        // Set current currency value
        elements.settingsCurrency.value = state.user?.currency || 'ZAR';
        openModal(elements.settingsModal);
    });
    
    elements.settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currency = elements.settingsCurrency.value;
        await updateUserCurrency(currency);
        closeModal(elements.settingsModal);
    });

    // Manage Categories button in Settings
    elements.manageCategoriesBtn.addEventListener('click', () => {
        elements.settingsModal.classList.remove('active');
        renderCategoriesListModal();
        openModal(elements.categoriesListModal, elements.settingsModal);
    });

    // Add Category from List Modal
    elements.addCategoryFromListBtn.addEventListener('click', () => {
        elements.categoriesListModal.classList.remove('active');
        elements.categoryForm.reset();
        editingCategoryId = null;

        const modalTitle = elements.categoryModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Category';

        // Reset type toggle to expense
        const typeToggle = document.querySelector('.category-type-toggle');
        if (typeToggle) typeToggle.classList.remove('disabled');
        document.querySelectorAll('.category-type-toggle .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'expense');
        });

        const iconInput = document.getElementById('category-icon');
        if (iconInput) iconInput.value = '📦';
        updateEmojiPickerSelection('📦');

        openModal(elements.categoryModal, elements.categoriesListModal);
    });

    // Chart click handlers - open spending details modal
    const openSpendingModal = () => {
        if (!state.summary || !state.summary.categories) return;

        // Sync period selector with main period selector
        elements.spendingPeriodSelector.value = elements.periodSelector.value;
        renderSpendingTable();
        openModal(elements.spendingModal);
    };

    elements.chartHeader?.addEventListener('click', openSpendingModal);
    elements.chartWrapper?.addEventListener('click', openSpendingModal);

    // Spending period selector change
    elements.spendingPeriodSelector?.addEventListener('change', async () => {
        const period = elements.spendingPeriodSelector.value;
        try {
            const summary = await api(`api.php?resource=summary&period=${period}`);
            state.spendingSummary = summary;
            renderSpendingTable();
        } catch (error) {
            showToast('Failed to load data');
        }
    });

    // Spending table sorting
    document.querySelectorAll('.spending-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            const currentDir = th.classList.contains('sorted-asc') ? 'asc' :
                              th.classList.contains('sorted-desc') ? 'desc' : null;

            // Remove sort classes from all headers
            document.querySelectorAll('.spending-table th').forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
            });

            // Set new sort direction
            const newDir = currentDir === 'asc' ? 'desc' : 'asc';
            th.classList.add(`sorted-${newDir}`);

            renderSpendingTable(sortKey, newDir);
        });
    });

    // Close modal handlers - close only the specific modal
    document.querySelectorAll('.modal-backdrop, .modal-close, .modal-cancel').forEach(el => {
        el.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        });
    });

    // Close on escape - close the topmost active modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                closeModal(activeModal);
            }
        }
    });
}

// ========================================
// Setup Auth Forms
// ========================================

function setupAuthForms() {
    // Form submissions
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.signupForm.addEventListener('submit', handleSignup);
    elements.forgotForm.addEventListener('submit', handleForgotPassword);
    elements.resetForm.addEventListener('submit', handleResetPassword);
    
    // Form navigation links
    document.querySelectorAll('[data-show]').forEach(btn => {
        btn.addEventListener('click', () => {
            showAuthForm(btn.dataset.show);
        });
    });
    
    // Check for reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    
    if (resetToken) {
        document.getElementById('reset-token').value = resetToken;
        showAuthForm('reset');
    }
}

// ========================================
// Service Worker Registration
// ========================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration.scope);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// ========================================
// Initialize App
// ========================================

async function init() {
    console.log('App initializing...');
    showScreen('loading');
    
    try {
        // Check if already authenticated
        const isAuthenticated = await checkAuthStatus();
        console.log('Auth status:', isAuthenticated);
        
        if (isAuthenticated) {
            await loadAppData();
            showAppScreen();
        } else {
            showScreen('auth');
            showAuthForm('login');
        }
    } catch (error) {
        console.error('Init error:', error);
        // On any error, show auth screen
        showScreen('auth');
        showAuthForm('login');
        showToast('Connection error. Please try again.');
    }
    
    // Setup event listeners
    setupAuthForms();
    elements.logoutBtn.addEventListener('click', handleLogout);
    setupModals();
    setupEmojiPicker();

    // Period selector change handler
    elements.periodSelector?.addEventListener('change', () => {
        loadSummary();
    });

    // Register service worker
    registerServiceWorker();
    
    // Handle window resize for chart
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.user) {
                renderChart();
            }
        }, 250);
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally for onclick handlers
window.deleteCategory = deleteCategory;
window.openEditCategoryModal = openEditCategoryModal;
window.deleteTransaction = deleteTransaction;
window.openEditTransactionModal = openEditTransactionModal;
