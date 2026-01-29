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
    allTransactions: [],
    recurringTransactions: [],
    summary: null,
    chartSummary: null,
    spendingSummary: null,
    // Encryption state
    encryptionSettings: null,
    encryptionPending: false
};

// Fields to encrypt for each data type
// Note: amounts are not encrypted to preserve database numeric operations
// Note: category_name is included for decryption since API returns it via joins
const ENCRYPTED_FIELDS = {
    transaction: ['description', 'category_name'],
    category: ['name'],
    recurring: ['description', 'category_name']
};

// Reset state to defaults
function resetState() {
    state.user = null;
    state.categories = [];
    state.transactions = [];
    state.allTransactions = [];
    state.recurringTransactions = [];
    state.summary = null;
    state.chartSummary = null;
    state.spendingSummary = null;
    state.encryptionSettings = null;
    state.encryptionPending = false;
    // Lock the crypto module
    if (window.CryptoModule) {
        CryptoModule.lock();
    }
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

    // Change Password
    changePasswordBtn: document.getElementById('change-password-btn'),
    changePasswordModal: document.getElementById('change-password-modal'),
    changePasswordForm: document.getElementById('change-password-form'),
    
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
    viewAllTransactionsBtn: document.getElementById('view-all-transactions-btn'),
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
    chartPeriodSelector: document.getElementById('chart-period-selector'),

    // Spending Modal
    spendingModal: document.getElementById('spending-modal'),
    spendingPeriodSelector: document.getElementById('spending-period-selector'),
    spendingTableBody: document.getElementById('spending-table-body'),

    // Transactions Modal
    transactionsModal: document.getElementById('transactions-modal'),
    transactionsModalList: document.getElementById('transactions-modal-list'),
    transactionsModalEmpty: document.getElementById('transactions-modal-empty'),
    transactionsSearch: document.getElementById('transactions-search'),
    transactionsPeriodSelector: document.getElementById('transactions-period-selector'),

    // Recurring Transactions
    manageRecurringBtn: document.getElementById('manage-recurring-btn'),
    recurringModal: document.getElementById('recurring-modal'),
    recurringList: document.getElementById('recurring-list'),
    noRecurring: document.getElementById('no-recurring'),
    addRecurringBtn: document.getElementById('add-recurring-btn'),
    recurringFormModal: document.getElementById('recurring-form-modal'),
    recurringForm: document.getElementById('recurring-form'),
    recurringCategory: document.getElementById('recurring-category'),
    transactionRecurring: document.getElementById('transaction-recurring'),
    recurringOptions: document.getElementById('recurring-options'),
    upcomingTab: document.getElementById('upcoming-tab'),
    allTab: document.getElementById('all-tab'),
    upcomingList: document.getElementById('upcoming-list'),
    noUpcoming: document.getElementById('no-upcoming'),
    upcomingDays: document.getElementById('upcoming-days'),
    viewUpcomingBtn: document.getElementById('view-upcoming-btn'),

    // Encryption
    dataEncryptionBtn: document.getElementById('data-encryption-btn'),
    encryptionSettingsModal: document.getElementById('encryption-settings-modal'),
    encryptionStatus: document.getElementById('encryption-status'),
    encryptionStatusIcon: document.getElementById('encryption-status-icon'),
    encryptionStatusLabel: document.getElementById('encryption-status-label'),
    encryptionStatusDesc: document.getElementById('encryption-status-desc'),
    encryptionOptionsDisabled: document.getElementById('encryption-options-disabled'),
    encryptionOptionsEnabled: document.getElementById('encryption-options-enabled'),
    enableEncryptionBtn: document.getElementById('enable-encryption-btn'),
    changeEncryptionPasswordBtn: document.getElementById('change-encryption-password-btn'),
    regenerateRecoveryBtn: document.getElementById('regenerate-recovery-btn'),
    disableEncryptionBtn: document.getElementById('disable-encryption-btn'),
    changeEncryptionPasswordModal: document.getElementById('change-encryption-password-modal'),
    changeEncryptionPasswordForm: document.getElementById('change-encryption-password-form'),
    encryptionUnlockModal: document.getElementById('encryption-unlock-modal'),
    encryptionUnlockForm: document.getElementById('encryption-unlock-form'),
    encryptionRecoveryForm: document.getElementById('encryption-recovery-form'),
    encryptionSetupModal: document.getElementById('encryption-setup-modal'),
    encryptionSetupForm: document.getElementById('encryption-setup-form'),
    recoveryPhraseModal: document.getElementById('recovery-phrase-modal'),
    recoveryPhraseDisplay: document.getElementById('recovery-phrase-display'),

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

// ========================================
// Encryption Helper Functions
// ========================================

function isEncryptionEnabled() {
    return state.user?.encryption_enabled && CryptoModule?.isReady();
}

function isEncryptionUnlocked() {
    return CryptoModule?.isReady();
}

async function encryptTransaction(data) {
    if (!isEncryptionEnabled()) return data;
    return CryptoModule.encryptObject(data, ENCRYPTED_FIELDS.transaction);
}

async function decryptTransaction(data) {
    if (!CryptoModule?.isReady()) return data;
    return CryptoModule.decryptObject(data, ENCRYPTED_FIELDS.transaction);
}

async function decryptTransactions(arr) {
    if (!CryptoModule?.isReady()) return arr;
    return CryptoModule.decryptArray(arr, ENCRYPTED_FIELDS.transaction);
}

async function encryptCategory(data) {
    if (!isEncryptionEnabled()) return data;
    return CryptoModule.encryptObject(data, ENCRYPTED_FIELDS.category);
}

async function decryptCategory(data) {
    if (!CryptoModule?.isReady()) return data;
    return CryptoModule.decryptObject(data, ENCRYPTED_FIELDS.category);
}

async function decryptCategories(arr) {
    if (!CryptoModule?.isReady()) return arr;
    return CryptoModule.decryptArray(arr, ENCRYPTED_FIELDS.category);
}

async function encryptRecurring(data) {
    if (!isEncryptionEnabled()) return data;
    return CryptoModule.encryptObject(data, ENCRYPTED_FIELDS.recurring);
}

async function decryptRecurring(data) {
    if (!CryptoModule?.isReady()) return data;
    return CryptoModule.decryptObject(data, ENCRYPTED_FIELDS.recurring);
}

async function decryptRecurringTransactions(arr) {
    if (!CryptoModule?.isReady()) return arr;
    return CryptoModule.decryptArray(arr, ENCRYPTED_FIELDS.recurring);
}

async function loadEncryptionSettings() {
    try {
        const settings = await api('auth.php?action=get-encryption');
        state.encryptionSettings = settings;
        return settings;
    } catch (error) {
        console.error('Failed to load encryption settings:', error);
        return null;
    }
}

async function unlockEncryption(password) {
    if (!state.encryptionSettings?.encryption_enabled) {
        return true;
    }

    try {
        await CryptoModule.unlock(
            password,
            state.encryptionSettings.encryption_salt,
            state.encryptionSettings.encrypted_mek
        );
        return true;
    } catch (error) {
        console.error('Failed to unlock encryption:', error);
        return false;
    }
}

async function unlockWithRecovery(recoveryPhrase) {
    if (!state.encryptionSettings?.encryption_enabled) {
        return false;
    }

    try {
        await CryptoModule.unlockWithRecovery(
            recoveryPhrase,
            state.encryptionSettings.recovery_salt,
            state.encryptionSettings.recovery_encrypted_mek
        );
        return true;
    } catch (error) {
        console.error('Failed to unlock with recovery:', error);
        return false;
    }
}

async function enableEncryption(password) {
    try {
        // Generate encryption keys
        const encryptionData = await CryptoModule.enableEncryption(password);

        // Save to server
        await api('auth.php?action=enable-encryption', {
            method: 'POST',
            body: {
                encryption_salt: encryptionData.salt,
                encrypted_mek: encryptionData.wrappedMEK,
                recovery_salt: encryptionData.recoverySalt,
                recovery_encrypted_mek: encryptionData.recoveryWrappedMEK
            }
        });

        // Update local state
        state.user.encryption_enabled = true;
        await loadEncryptionSettings();

        // Encrypt all existing data
        await encryptExistingData();

        return {
            success: true,
            recoveryPhrase: encryptionData.recoveryPhrase
        };
    } catch (error) {
        console.error('Failed to enable encryption:', error);
        CryptoModule.lock();
        return { success: false, error: error.message };
    }
}

async function encryptExistingData() {
    if (!CryptoModule?.isReady()) return;

    try {
        // Fetch all data to encrypt
        const [categories, transactions, recurring] = await Promise.all([
            api('api.php?resource=categories'),
            api('api.php?resource=transactions&limit=10000'),
            api('api.php?resource=recurring')
        ]);

        const allCategories = Array.isArray(categories) ? categories : [];
        const allTransactions = Array.isArray(transactions) ? transactions : [];
        const allRecurring = Array.isArray(recurring) ? recurring : [];

        // Encrypt all categories
        for (const category of allCategories) {
            if (category.name && !CryptoModule.isEncrypted(category.name)) {
                const encrypted = await encryptCategory({
                    name: category.name
                });
                await api(`api.php?resource=categories&id=${category.id}`, {
                    method: 'PUT',
                    body: {
                        name: encrypted.name,
                        type: category.type,
                        icon: category.icon,
                        color: category.color,
                        monthly_budget: category.monthly_budget
                    }
                });
            }
        }

        // Encrypt all transactions
        for (const transaction of allTransactions) {
            if (transaction.description && !CryptoModule.isEncrypted(transaction.description)) {
                const encrypted = await encryptTransaction({
                    description: transaction.description
                });
                await api(`api.php?resource=transactions&id=${transaction.id}`, {
                    method: 'PUT',
                    body: {
                        description: encrypted.description,
                        amount: transaction.amount,
                        category_id: transaction.category_id,
                        type: transaction.type,
                        date: transaction.date
                    }
                });
            }
        }

        // Encrypt all recurring transactions
        for (const rec of allRecurring) {
            if (rec.description && !CryptoModule.isEncrypted(rec.description)) {
                const encrypted = await encryptRecurring({
                    description: rec.description
                });
                await api(`api.php?resource=recurring&id=${rec.id}`, {
                    method: 'PUT',
                    body: {
                        description: encrypted.description,
                        amount: rec.amount,
                        category_id: rec.category_id,
                        type: rec.type,
                        frequency: rec.frequency,
                        start_date: rec.start_date,
                        end_date: rec.end_date,
                        is_active: rec.is_active
                    }
                });
            }
        }

        // Reload data with encrypted values
        await loadAppData();
    } catch (error) {
        console.error('Failed to encrypt existing data:', error);
        showToast('Warning: Some existing data could not be encrypted');
    }
}

async function disableEncryption() {
    try {
        if (!CryptoModule?.isReady()) {
            showToast('Encryption must be unlocked first');
            return false;
        }

        // Decrypt all existing data before disabling encryption
        await decryptExistingData();

        // Now disable encryption on the server
        await api('auth.php?action=disable-encryption', {
            method: 'POST'
        });

        state.user.encryption_enabled = false;
        state.encryptionSettings = null;
        CryptoModule.lock();
        CryptoModule.forgetKey();

        // Reload data
        await loadAppData();

        showToast('Encryption disabled');
        return true;
    } catch (error) {
        console.error('Failed to disable encryption:', error);
        showToast('Failed to disable encryption');
        return false;
    }
}

async function decryptExistingData() {
    if (!CryptoModule?.isReady()) return;

    try {
        // Fetch all data to decrypt
        const [categories, transactions, recurring] = await Promise.all([
            api('api.php?resource=categories'),
            api('api.php?resource=transactions&limit=10000'),
            api('api.php?resource=recurring')
        ]);

        const allCategories = Array.isArray(categories) ? categories : [];
        const allTransactions = Array.isArray(transactions) ? transactions : [];
        const allRecurring = Array.isArray(recurring) ? recurring : [];

        // Decrypt all categories
        for (const category of allCategories) {
            if (category.name && CryptoModule.isEncrypted(category.name)) {
                const decrypted = await decryptCategory(category);
                await api(`api.php?resource=categories&id=${category.id}`, {
                    method: 'PUT',
                    body: {
                        name: decrypted.name,
                        type: category.type,
                        icon: category.icon,
                        color: category.color,
                        monthly_budget: category.monthly_budget
                    }
                });
            }
        }

        // Decrypt all transactions
        for (const transaction of allTransactions) {
            if (transaction.description && CryptoModule.isEncrypted(transaction.description)) {
                const decrypted = await decryptTransaction(transaction);
                await api(`api.php?resource=transactions&id=${transaction.id}`, {
                    method: 'PUT',
                    body: {
                        description: decrypted.description,
                        amount: transaction.amount,
                        category_id: transaction.category_id,
                        type: transaction.type,
                        date: transaction.date
                    }
                });
            }
        }

        // Decrypt all recurring transactions
        for (const rec of allRecurring) {
            if (rec.description && CryptoModule.isEncrypted(rec.description)) {
                const decrypted = await decryptRecurring(rec);
                await api(`api.php?resource=recurring&id=${rec.id}`, {
                    method: 'PUT',
                    body: {
                        description: decrypted.description,
                        amount: rec.amount,
                        category_id: rec.category_id,
                        type: rec.type,
                        frequency: rec.frequency,
                        start_date: rec.start_date,
                        end_date: rec.end_date,
                        is_active: rec.is_active
                    }
                });
            }
        }
    } catch (error) {
        console.error('Failed to decrypt existing data:', error);
        showToast('Warning: Some data could not be decrypted');
    }
}

async function handleEncryptionUnlock(password) {
    const success = await unlockEncryption(password);
    if (success) {
        state.encryptionPending = false;
        closeModal(document.getElementById('encryption-unlock-modal'));
        await loadAppData();
        showAppScreen();
        showToast(`Welcome back, ${state.user.name}!`);
        return true;
    }
    return false;
}

async function handleRecoveryUnlock(recoveryPhrase) {
    const success = await unlockWithRecovery(recoveryPhrase);
    if (success) {
        state.encryptionPending = false;
        closeModal(document.getElementById('encryption-unlock-modal'));
        await loadAppData();
        showAppScreen();
        // Prompt user to set a new password since they forgot the old one
        showToast('Recovery successful! Please set a new encryption password.');
        setTimeout(() => {
            openModal(document.getElementById('encryption-new-password-modal'));
        }, 500);
        return true;
    }
    return false;
}

// Password toggle functions
function setupPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.parentElement.querySelector('input');
            if (!input) return;

            const isPassword = input.type === 'password';
            const newType = isPassword ? 'text' : 'password';

            // Check if this toggle is part of a group
            const group = toggle.dataset.toggleGroup;
            if (group) {
                // Toggle all inputs in the same group
                document.querySelectorAll(`.password-toggle[data-toggle-group="${group}"]`).forEach(groupToggle => {
                    const groupInput = groupToggle.parentElement.querySelector('input');
                    if (groupInput) {
                        groupInput.type = newType;
                        groupToggle.classList.toggle('visible', isPassword);
                    }
                });
            } else {
                // Single toggle behavior
                input.type = newType;
                toggle.classList.toggle('visible', isPassword);
            }
        });
    });
}

// Password strength checker using zxcvbn
function setupPasswordStrength() {
    document.querySelectorAll('.input-with-toggle[data-strength="true"]').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        if (!input) return;

        // Create strength meter
        const meter = document.createElement('div');
        meter.className = 'password-strength';
        meter.style.display = 'none';
        meter.innerHTML = `
            <div class="password-strength-bar"><div class="password-strength-fill"></div></div>
            <span class="password-strength-label"></span>
        `;

        // Create hints container
        const hintsContainer = document.createElement('div');
        hintsContainer.className = 'password-hints-container';
        hintsContainer.innerHTML = `
            <button type="button" class="password-hints-toggle">
                <span class="arrow">▶</span> Password tips
            </button>
            <div class="password-hints">
                <div class="password-hints-title">Choose a strong password:</div>
                <ul>
                    <li>At least 10 characters long</li>
                    <li>Mix of uppercase, lowercase, numbers, and symbols</li>
                    <li>Don't use common words or patterns</li>
                </ul>
            </div>
        `;

        // Insert after the wrapper's parent input-group
        const inputGroup = wrapper.closest('.input-group');
        if (inputGroup) {
            inputGroup.appendChild(meter);
            inputGroup.appendChild(hintsContainer);
        }

        // Toggle hints
        const hintsToggle = hintsContainer.querySelector('.password-hints-toggle');
        const hints = hintsContainer.querySelector('.password-hints');
        hintsToggle.addEventListener('click', () => {
            hintsToggle.classList.toggle('expanded');
            hints.classList.toggle('show');
        });

        const fill = meter.querySelector('.password-strength-fill');
        const label = meter.querySelector('.password-strength-label');

        function getRating(score, warning) {
            if (warning && score > 1) score = Math.max(1, score - 1);
            if (score <= 1) return { label: 'Very weak', color: 'var(--color-danger)', width: '33%' };
            if (score === 2) return { label: 'OK', color: 'var(--color-warning)', width: '66%' };
            return { label: 'Strong', color: 'var(--color-success)', width: '100%' };
        }

        input.addEventListener('input', () => {
            const password = input.value;

            if (password.length === 0) {
                meter.style.display = 'none';
                return;
            }

            meter.style.display = 'block';

            if (typeof zxcvbn === 'undefined') {
                label.textContent = 'Loading...';
                return;
            }

            let result = zxcvbn(password);
            let score = result.score;
            let warning = result.feedback.warning || '';

            // Custom checks
            if (password.length < 6) {
                score = 0;
                warning = 'Too short - minimum 6 characters';
            }

            const rating = getRating(score, warning);

            fill.style.width = rating.width;
            fill.style.backgroundColor = rating.color;

            let labelText = rating.label;
            if (warning) labelText += ' - ' + warning;
            label.textContent = labelText;

            input.dataset.strengthScore = score;
        });
    });
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
            console.log('Login successful');

            // Check if encryption is enabled
            if (state.user.encryption_enabled) {
                console.log('Encryption enabled, loading settings...');
                await loadEncryptionSettings();

                // Try to unlock with the same password used for login
                const unlocked = await unlockEncryption(password);
                if (!unlocked) {
                    // Show encryption unlock modal
                    state.encryptionPending = true;
                    openModal(elements.encryptionUnlockModal);
                    showToast('Please enter your encryption password');
                    return;
                }
            }

            console.log('Loading app data...');
            await loadAppData();
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

        // If in dev mode (email disabled), show the reset link in a toast
        if (data.reset_link) {
            showToast('Dev mode: Click the link shown below', 5000);
            // Display the link in a more visible way
            const successEl = document.getElementById('reset-success');
            let devLinkEl = successEl.querySelector('.dev-reset-link');
            if (!devLinkEl) {
                devLinkEl = document.createElement('a');
                devLinkEl.className = 'dev-reset-link';
                devLinkEl.style.cssText = 'display:block;margin-top:16px;padding:12px;background:var(--bg-card);border-radius:8px;color:var(--color-primary);word-break:break-all;font-size:0.85rem;text-align:center;';
                successEl.appendChild(devLinkEl);
            }
            devLinkEl.href = data.reset_link;
            devLinkEl.textContent = 'Click here to reset password';
        }
    } catch (error) {
        showToast(error.message || 'Request failed');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleResetPassword(e) {
    e.preventDefault();

    const passwordInput = document.getElementById('reset-password');
    const password = passwordInput.value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;
    const token = document.getElementById('reset-token').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Check password strength
    const strengthScore = parseInt(passwordInput.dataset.strengthScore || '0');
    if (password.length < 10 || strengthScore < 2) {
        showToast('Please choose a stronger password');
        // Expand password tips
        const hintsToggle = elements.resetForm.querySelector('.password-hints-toggle');
        const hints = elements.resetForm.querySelector('.password-hints');
        if (hintsToggle && hints && !hints.classList.contains('show')) {
            hintsToggle.classList.add('expanded');
            hints.classList.add('show');
        }
        passwordInput.focus();
        return;
    }

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
        const [categories, transactions, summary, recurring] = await Promise.all([
            api('api.php?resource=categories'),
            api('api.php?resource=transactions&limit=50'),
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=recurring')
        ]);

        console.log('Loaded categories:', categories);
        console.log('Loaded transactions:', transactions);
        console.log('Loaded summary:', summary);
        console.log('Loaded recurring:', recurring);

        // Ensure arrays (API might return object with error)
        let cats = Array.isArray(categories) ? categories : [];
        let txns = Array.isArray(transactions) ? transactions : [];
        let recur = Array.isArray(recurring) ? recurring : [];

        // Decrypt data if encryption is enabled
        if (CryptoModule?.isReady()) {
            cats = await decryptCategories(cats);
            txns = await decryptTransactions(txns);
            recur = await decryptRecurringTransactions(recur);

            // Also decrypt category data in summary
            if (summary?.categories) {
                summary.categories = await decryptCategories(summary.categories);
            }
        }

        state.categories = cats;
        state.transactions = txns;
        state.recurringTransactions = recur;
        state.summary = summary && typeof summary === 'object' ? summary : null;
    } catch (error) {
        console.error('Failed to load data:', error);
        state.categories = [];
        state.transactions = [];
        state.recurringTransactions = [];
        state.summary = null;
        showToast('Failed to load data');
    }
}

async function loadSummary() {
    try {
        const period = elements.periodSelector?.value || 'this-month';
        const summary = await api(`api.php?resource=summary&period=${period}`);
        state.summary = summary && typeof summary === 'object' ? summary : null;
        // Decrypt category data in summary
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }
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
        // Encrypt data before sending
        let body = { name, type, icon, monthly_budget: monthlyBudget };
        body = await encryptCategory(body);

        let category = await api('api.php?resource=categories', {
            method: 'POST',
            body
        });

        // Decrypt the response
        category = await decryptCategory(category);
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
        // Encrypt data before sending
        let body = { name, icon, monthly_budget: monthlyBudget };
        if (type) body.type = type;
        body = await encryptCategory(body);

        let category = await api(`api.php?resource=categories&id=${id}`, {
            method: 'PUT',
            body
        });

        // Decrypt the response
        category = await decryptCategory(category);
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
        if (elements.noCategories) elements.noCategories.style.display = 'flex';
        return;
    }

    if (elements.noCategories) elements.noCategories.style.display = 'none';

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
        // Encrypt data before sending
        let body = { description, amount, category_id: categoryId, type, date };
        body = await encryptTransaction(body);

        let transaction = await api('api.php?resource=transactions', {
            method: 'POST',
            body
        });

        // Decrypt the response
        transaction = await decryptTransaction(transaction);
        state.transactions.unshift(transaction);

        // Refresh summary and categories (with decryption)
        const period = elements.periodSelector?.value || 'this-month';
        const [summary, categories] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

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

        // Refresh summary and categories (with decryption)
        const period = elements.periodSelector?.value || 'this-month';
        const [summary, categories] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

        renderAll();
        showToast('Transaction deleted');
    } catch (error) {
        showToast('Failed to delete transaction');
    }
}

async function updateTransaction(id, description, amount, categoryId, type, date) {
    try {
        // Encrypt data before sending
        let body = { description, amount, category_id: categoryId, type, date };
        body = await encryptTransaction(body);

        let transaction = await api(`api.php?resource=transactions&id=${id}`, {
            method: 'PUT',
            body
        });

        // Decrypt the response
        transaction = await decryptTransaction(transaction);

        // Update in state
        const index = state.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            state.transactions[index] = transaction;
        }

        // Refresh summary and categories (with decryption)
        const period = elements.periodSelector?.value || 'this-month';
        const [summary, categories] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

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

    // Hide recurring options when editing (not applicable for existing transactions)
    const recurringToggle = document.getElementById('recurring-toggle');
    if (recurringToggle) recurringToggle.style.display = 'none';
    if (elements.transactionRecurring) elements.transactionRecurring.checked = false;
    if (elements.recurringOptions) elements.recurringOptions.style.display = 'none';

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
        if (elements.noTransactions) elements.noTransactions.style.display = 'flex';
        return;
    }

    if (elements.noTransactions) elements.noTransactions.style.display = 'none';

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
// Recurring Transaction Functions
// ========================================

async function loadRecurringTransactions() {
    try {
        const recurring = await api('api.php?resource=recurring');
        const arr = Array.isArray(recurring) ? recurring : [];
        state.recurringTransactions = await decryptRecurringTransactions(arr);
        return state.recurringTransactions;
    } catch (error) {
        console.error('Failed to load recurring transactions:', error);
        showToast('Failed to load recurring transactions');
        return [];
    }
}

async function createRecurringTransaction(description, amount, categoryId, type, frequency, startDate, endDate = null, skipFirst = false) {
    try {
        let body = {
            description,
            amount,
            category_id: categoryId,
            type,
            frequency,
            start_date: startDate,
            skip_first: skipFirst
        };
        if (endDate) {
            body.end_date = endDate;
        }

        // Encrypt data before sending
        body = await encryptRecurring(body);

        let recurring = await api('api.php?resource=recurring', {
            method: 'POST',
            body
        });

        // Refresh all data including the new recurring transaction
        const period = elements.periodSelector?.value || 'this-month';
        const [transactions, summary, categories, recurringList] = await Promise.all([
            api('api.php?resource=transactions&limit=50'),
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories'),
            api('api.php?resource=recurring')
        ]);

        state.transactions = await decryptTransactions(Array.isArray(transactions) ? transactions : []);
        state.categories = await decryptCategories(Array.isArray(categories) ? categories : []);
        state.recurringTransactions = await decryptRecurringTransactions(Array.isArray(recurringList) ? recurringList : []);
        state.summary = summary;
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

        renderAll();
        renderRecurringList();
        showToast('Recurring transaction created');
        return recurring;
    } catch (error) {
        showToast(error.message || 'Failed to create recurring transaction');
        return null;
    }
}

async function updateRecurringTransaction(id, description, amount, categoryId, type, frequency, startDate, endDate = null) {
    try {
        let body = {
            description,
            amount,
            category_id: categoryId,
            type,
            frequency,
            start_date: startDate
        };
        if (endDate) {
            body.end_date = endDate;
        }

        // Encrypt data before sending
        body = await encryptRecurring(body);

        let recurring = await api(`api.php?resource=recurring&id=${id}`, {
            method: 'PUT',
            body
        });

        // Decrypt the response
        recurring = await decryptRecurring(recurring);
        const index = state.recurringTransactions.findIndex(r => r.id === id);
        if (index !== -1) {
            state.recurringTransactions[index] = recurring;
        }

        renderRecurringList();
        showToast('Recurring transaction updated');
        return recurring;
    } catch (error) {
        showToast(error.message || 'Failed to update recurring transaction');
        return null;
    }
}

async function deleteRecurringTransaction(id) {
    try {
        await api(`api.php?resource=recurring&id=${id}`, { method: 'DELETE' });
        state.recurringTransactions = state.recurringTransactions.filter(r => r.id !== id);
        renderRecurringList();
        showToast('Recurring transaction deleted');
    } catch (error) {
        showToast('Failed to delete recurring transaction');
    }
}

async function toggleRecurringTransaction(id, isActive) {
    try {
        const action = isActive ? 'resume' : 'pause';
        const recurring = await api(`api.php?resource=recurring&id=${id}`, {
            method: 'PUT',
            body: { action }
        });

        const index = state.recurringTransactions.findIndex(r => r.id === id);
        if (index !== -1) {
            state.recurringTransactions[index] = recurring;
        }

        renderRecurringList();
        showToast(isActive ? 'Recurring transaction resumed' : 'Recurring transaction paused');
        return recurring;
    } catch (error) {
        showToast('Failed to update recurring transaction');
        return null;
    }
}

let editingRecurringId = null;

function openEditRecurringModal(recurringId) {
    const recurring = state.recurringTransactions.find(r => r.id === recurringId);
    if (!recurring) return;

    // Hide the recurring list modal
    elements.recurringModal.classList.remove('active');

    editingRecurringId = recurringId;

    // Set form values
    document.getElementById('recurring-description').value = recurring.description;
    document.getElementById('recurring-amount').value = recurring.amount;
    document.getElementById('recurring-frequency').value = recurring.frequency;
    document.getElementById('recurring-start-date').value = recurring.start_date;
    document.getElementById('recurring-end-date').value = recurring.end_date || '';

    // Set type toggle
    const type = recurring.type;
    document.querySelectorAll('.recurring-type-toggle .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Populate category dropdown and select current category
    populateCategoryDropdown(elements.recurringCategory, type);
    if (recurring.category_id) {
        elements.recurringCategory.value = recurring.category_id;
    }

    // Hide skip-first checkbox when editing (only applies to creation)
    const skipFirstGroup = document.getElementById('skip-first-group');
    if (skipFirstGroup) skipFirstGroup.style.display = 'none';

    // Update modal title and button
    const modalTitle = elements.recurringFormModal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Edit Recurring Transaction';
    const submitBtn = document.getElementById('recurring-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    openModal(elements.recurringFormModal, elements.recurringModal);
}

function renderRecurringList() {
    const container = elements.recurringList;
    if (!container) return;

    // Remove existing items (keep empty state)
    container.querySelectorAll('.recurring-item').forEach(item => item.remove());

    const recurringTransactions = Array.isArray(state.recurringTransactions) ? state.recurringTransactions : [];

    if (recurringTransactions.length === 0) {
        if (elements.noRecurring) elements.noRecurring.style.display = 'flex';
        return;
    }

    if (elements.noRecurring) elements.noRecurring.style.display = 'none';

    recurringTransactions.forEach(recurring => {
        const catIcon = recurring.category_icon || '📦';
        const catColor = recurring.category_color || '#64748b';
        const catName = recurring.category_name || 'Unknown';
        const isIncome = recurring.type === 'income';
        const isPaused = !recurring.is_active || recurring.is_active === '0' || recurring.is_active === 0;

        const frequencyLabel = recurring.frequency === 'monthly' ? 'Monthly' : 'Yearly';
        const nextDate = recurring.next_occurrence ? formatDate(recurring.next_occurrence) : 'N/A';

        const html = `
            <div class="recurring-item ${isPaused ? 'paused' : ''}" data-id="${recurring.id}">
                <div class="recurring-content" onclick="openEditRecurringModal(${recurring.id})">
                    <div class="recurring-icon ${recurring.type}" style="background: ${isIncome ? 'var(--color-success-light)' : catColor + '20'}">
                        ${catIcon}
                    </div>
                    <div class="recurring-info">
                        <div class="recurring-description">${escapeHtml(recurring.description)}</div>
                        <div class="recurring-meta">
                            ${escapeHtml(catName)} • ${frequencyLabel} • Next: ${nextDate}
                            ${isPaused ? '<span class="paused-badge">Paused</span>' : ''}
                        </div>
                    </div>
                    <div class="recurring-amount ${recurring.type}">
                        ${isIncome ? '+' : '-'}${formatCurrency(recurring.amount)}
                    </div>
                </div>
                <div class="recurring-actions">
                    <button class="btn btn-icon btn-toggle ${isPaused ? '' : 'active'}" onclick="event.stopPropagation(); toggleRecurringTransaction(${recurring.id}, ${isPaused ? 'true' : 'false'})" title="${isPaused ? 'Resume' : 'Pause'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${isPaused ?
                                '<polygon points="5 3 19 12 5 21 5 3"/>' :
                                '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                            }
                        </svg>
                    </button>
                    <button class="btn btn-delete btn-icon" onclick="event.stopPropagation(); deleteRecurringTransaction(${recurring.id})" title="Delete">
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

function openRecurringModal(showUpcoming = true) {
    loadRecurringTransactions().then(() => {
        renderRecurringList();

        // Set active tab
        document.querySelectorAll('.recurring-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === (showUpcoming ? 'upcoming' : 'all'));
        });
        document.querySelectorAll('.recurring-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === (showUpcoming ? 'upcoming-tab' : 'all-tab'));
        });

        // Load upcoming if that tab is shown
        if (showUpcoming) {
            const days = parseInt(elements.upcomingDays?.value) || 7;
            loadUpcomingRecurring(days);
        }

        openModal(elements.recurringModal);
    });
}

async function loadUpcomingRecurring(days = 7) {
    try {
        let upcoming = await api(`api.php?resource=recurring&upcoming=1&days=${days}`);
        upcoming = await decryptRecurringTransactions(Array.isArray(upcoming) ? upcoming : []);
        renderUpcomingList(upcoming);
    } catch (error) {
        console.error('Failed to load upcoming recurring:', error);
        renderUpcomingList([]);
    }
}

function renderUpcomingList(upcomingTransactions) {
    const container = elements.upcomingList;
    if (!container) return;

    // Remove existing items (keep empty state)
    container.querySelectorAll('.upcoming-item').forEach(item => item.remove());

    if (upcomingTransactions.length === 0) {
        if (elements.noUpcoming) elements.noUpcoming.style.display = 'flex';
        return;
    }

    if (elements.noUpcoming) elements.noUpcoming.style.display = 'none';

    upcomingTransactions.forEach(recurring => {
        const catIcon = recurring.category_icon || '📦';
        const catColor = recurring.category_color || '#64748b';
        const catName = recurring.category_name || 'Unknown';
        const isIncome = recurring.type === 'income';
        const frequencyLabel = recurring.frequency === 'monthly' ? 'Monthly' : 'Yearly';

        // Calculate days until (use T00:00:00 to avoid timezone issues)
        const nextDate = new Date(recurring.next_occurrence + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
        const daysLabel = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

        const html = `
            <div class="upcoming-item" data-id="${recurring.id}">
                <div class="upcoming-icon ${recurring.type}" style="background: ${isIncome ? 'var(--color-success-light)' : catColor + '20'}">
                    ${catIcon}
                </div>
                <div class="upcoming-info">
                    <div class="upcoming-description">${escapeHtml(recurring.description)}</div>
                    <div class="upcoming-meta">
                        ${escapeHtml(catName)} • ${frequencyLabel} • ${formatDate(recurring.next_occurrence)} (${daysLabel})
                    </div>
                </div>
                <div class="upcoming-amount ${recurring.type}">
                    ${isIncome ? '+' : '-'}${formatCurrency(recurring.amount)}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
    });
}

// ========================================
// All Transactions Modal
// ========================================

async function loadAllTransactions() {
    try {
        // Load more transactions for the modal (up to 500)
        let transactions = await api('api.php?resource=transactions&limit=500');
        transactions = await decryptTransactions(Array.isArray(transactions) ? transactions : []);
        state.allTransactions = transactions;
        return transactions;
    } catch (error) {
        console.error('Failed to load all transactions:', error);
        showToast('Failed to load transactions');
        return [];
    }
}

function getDateRangeForPeriod(period) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (period) {
        case 'this-month': {
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);
            return { start, end };
        }
        case 'last-month': {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            return { start, end };
        }
        case 'this-year': {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            return { start, end };
        }
        case 'last-year': {
            const start = new Date(year - 1, 0, 1);
            const end = new Date(year - 1, 11, 31);
            return { start, end };
        }
        case 'all-time':
        default:
            return { start: null, end: null };
    }
}

function filterTransactions() {
    const searchTerm = (elements.transactionsSearch?.value || '').toLowerCase().trim();
    const period = elements.transactionsPeriodSelector?.value || 'this-month';
    const { start, end } = getDateRangeForPeriod(period);

    let filtered = [...state.allTransactions];

    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.description.toLowerCase().includes(searchTerm) ||
            (t.category_name || t.category || '').toLowerCase().includes(searchTerm)
        );
    }

    // Filter by period
    if (start && end) {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        filtered = filtered.filter(t => t.date >= startStr && t.date <= endStr);
    }

    return filtered;
}

function renderTransactionsModal() {
    const container = elements.transactionsModalList;
    const emptyState = elements.transactionsModalEmpty;
    if (!container) return;

    container.innerHTML = '';

    const filteredTransactions = filterTransactions();

    if (filteredTransactions.length === 0) {
        container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    filteredTransactions.forEach(transaction => {
        const catName = transaction.category_name || transaction.category || 'Unknown';
        const catIcon = transaction.category_icon || '📦';
        const catColor = transaction.category_color || '#64748b';
        const isIncome = transaction.type === 'income';

        const html = `
            <div class="transaction-item" data-id="${transaction.id}" onclick="openEditTransactionModal(${transaction.id})">
                <div class="transaction-content">
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

async function openTransactionsModal() {
    await loadAllTransactions();

    // Reset filters
    if (elements.transactionsSearch) elements.transactionsSearch.value = '';
    if (elements.transactionsPeriodSelector) elements.transactionsPeriodSelector.value = 'this-month';

    renderTransactionsModal();
    openModal(elements.transactionsModal);
}

// ========================================
// Summary & Chart
// ========================================

function updateBalances() {
    if (!state.summary) return;

    const { income, expense, balance } = state.summary;

    if (elements.totalBalance) {
        elements.totalBalance.textContent = formatCurrency(balance);
        elements.totalBalance.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }
    if (elements.totalIncome) elements.totalIncome.textContent = formatCurrency(income);
    if (elements.totalExpenses) elements.totalExpenses.textContent = formatCurrency(expense);
}

function renderChart() {
    // Use chartSummary if available, otherwise fall back to summary
    const summary = state.chartSummary || state.summary;

    // Filter categories with spending > 0
    const categoriesWithSpending = (summary?.categories || []).filter(c => c.spent > 0);

    if (!summary || categoriesWithSpending.length === 0) {
        if (elements.noChart) elements.noChart.style.display = 'flex';
        if (elements.chartWithLegend) elements.chartWithLegend.style.display = 'none';
        return;
    }

    if (elements.noChart) elements.noChart.style.display = 'none';
    if (elements.chartWithLegend) elements.chartWithLegend.style.display = 'flex';

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
    ctx.font = 'bold 16px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatCurrency(total), centerX, centerY - 6);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Outfit, system-ui, sans-serif';
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
    updateEncryptionButton();
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

        // Show recurring toggle and reset options
        const recurringToggle = document.getElementById('recurring-toggle');
        if (recurringToggle) recurringToggle.style.display = 'block';
        if (elements.transactionRecurring) {
            elements.transactionRecurring.checked = false;
        }
        if (elements.recurringOptions) {
            elements.recurringOptions.style.display = 'none';
        }

        // Reset modal title and button text
        const modalTitle = elements.transactionModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Transaction';
        const submitBtn = document.getElementById('transaction-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Add Transaction';

        openModal(elements.transactionModal);
    });

    // View All Transactions button
    elements.viewAllTransactionsBtn?.addEventListener('click', openTransactionsModal);

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
        const type = document.querySelector('.transaction-type-toggle .type-btn.active').dataset.type;
        const isRecurring = elements.transactionRecurring?.checked || false;

        if (!categoryId) {
            showToast('Please select a category');
            return;
        }

        if (editingTransactionId) {
            await updateTransaction(editingTransactionId, description, parseFloat(amount), parseInt(categoryId), type, date);
        } else if (isRecurring) {
            // Create recurring transaction instead
            const frequency = document.getElementById('transaction-frequency').value;
            const endDate = document.getElementById('transaction-end-date').value || null;
            await createRecurringTransaction(description, parseFloat(amount), parseInt(categoryId), type, frequency, date, endDate);
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

    // Change Password button in Settings
    elements.changePasswordBtn?.addEventListener('click', () => {
        elements.settingsModal.classList.remove('active');
        elements.changePasswordForm.reset();
        // Reset strength meter visibility
        const meter = elements.changePasswordModal.querySelector('.password-strength');
        if (meter) meter.style.display = 'none';
        openModal(elements.changePasswordModal, elements.settingsModal);
    });

    // Change Password form submission
    elements.changePasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPasswordInput = document.getElementById('new-password');
        const newPassword = newPasswordInput.value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        // Check password strength
        const strengthScore = parseInt(newPasswordInput.dataset.strengthScore || '0');
        if (newPassword.length < 10 || strengthScore < 2) {
            showToast('Please choose a stronger password');
            // Expand password tips
            const hintsToggle = elements.changePasswordModal.querySelector('.password-hints-toggle');
            const hints = elements.changePasswordModal.querySelector('.password-hints');
            if (hintsToggle && hints && !hints.classList.contains('show')) {
                hintsToggle.classList.add('expanded');
                hints.classList.add('show');
            }
            newPasswordInput.focus();
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const data = await api('auth.php?action=change-password', {
                method: 'POST',
                body: { current_password: currentPassword, new_password: newPassword }
            });

            if (data.success) {
                showToast('Password changed successfully');
                closeModal(elements.changePasswordModal);
                e.target.reset();
            }
        } catch (error) {
            showToast(error.message || 'Failed to change password');
        } finally {
            submitBtn.disabled = false;
        }
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

    // Recurring transaction toggle in transaction modal
    elements.transactionRecurring?.addEventListener('change', (e) => {
        if (elements.recurringOptions) {
            elements.recurringOptions.style.display = e.target.checked ? 'block' : 'none';
        }
    });

    // Manage Recurring Transactions button in Settings
    elements.manageRecurringBtn?.addEventListener('click', () => {
        elements.settingsModal.classList.remove('active');
        openRecurringModal(false); // false = show "All Recurring" tab
    });

    // Add Recurring button in recurring modal
    elements.addRecurringBtn?.addEventListener('click', () => {
        elements.recurringModal.classList.remove('active');
        elements.recurringForm.reset();
        editingRecurringId = null;

        // Reset form
        const modalTitle = elements.recurringFormModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Recurring Transaction';
        const submitBtn = document.getElementById('recurring-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Add Recurring';

        // Reset type toggle to expense
        document.querySelectorAll('.recurring-type-toggle .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'expense');
        });

        // Set default start date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('recurring-start-date').value = today;

        // Show skip first checkbox and default to checked (since start date is today)
        const skipFirstGroup = document.getElementById('skip-first-group');
        const skipFirstCheckbox = document.getElementById('recurring-skip-first');
        if (skipFirstGroup) skipFirstGroup.style.display = 'block';
        if (skipFirstCheckbox) skipFirstCheckbox.checked = true;

        // Populate category dropdown with expense categories
        populateCategoryDropdown(elements.recurringCategory, 'expense');

        openModal(elements.recurringFormModal, elements.recurringModal);
    });

    // Update skip-first checkbox when start date changes
    document.getElementById('recurring-start-date')?.addEventListener('change', (e) => {
        const startDate = e.target.value;
        const today = new Date().toISOString().split('T')[0];
        const skipFirstGroup = document.getElementById('skip-first-group');
        const skipFirstCheckbox = document.getElementById('recurring-skip-first');

        if (skipFirstGroup && skipFirstCheckbox) {
            // Show checkbox and default to checked if start date is today or past
            const isPastOrToday = startDate <= today;
            skipFirstGroup.style.display = isPastOrToday ? 'block' : 'none';
            skipFirstCheckbox.checked = isPastOrToday;
        }
    });

    // Recurring type toggle
    document.querySelectorAll('.recurring-type-toggle .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.recurring-type-toggle .type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update category dropdown based on selected type
            const type = btn.dataset.type;
            populateCategoryDropdown(elements.recurringCategory, type);
        });
    });

    // Recurring form submission
    elements.recurringForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('recurring-description').value;
        const amount = parseFloat(document.getElementById('recurring-amount').value);
        const categoryId = parseInt(document.getElementById('recurring-category').value);
        const frequency = document.getElementById('recurring-frequency').value;
        const startDate = document.getElementById('recurring-start-date').value;
        const endDate = document.getElementById('recurring-end-date').value || null;
        const type = document.querySelector('.recurring-type-toggle .type-btn.active')?.dataset.type || 'expense';
        const skipFirst = document.getElementById('recurring-skip-first')?.checked || false;

        if (!categoryId) {
            showToast('Please select a category');
            return;
        }

        if (editingRecurringId) {
            await updateRecurringTransaction(editingRecurringId, description, amount, categoryId, type, frequency, startDate, endDate);
        } else {
            await createRecurringTransaction(description, amount, categoryId, type, frequency, startDate, endDate, skipFirst);
        }

        editingRecurringId = null;
        closeModal(elements.recurringFormModal);
    });

    // Recurring modal tab switching
    document.querySelectorAll('.recurring-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update tab active state
            document.querySelectorAll('.recurring-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content visibility
            document.querySelectorAll('.recurring-tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });

            // Load upcoming if switching to that tab
            if (tabName === 'upcoming') {
                const days = parseInt(elements.upcomingDays?.value) || 7;
                loadUpcomingRecurring(days);
            }
        });
    });

    // Upcoming days input change - listen to both 'change' and 'input' events
    const handleDaysChange = () => {
        const days = parseInt(elements.upcomingDays?.value) || 7;
        loadUpcomingRecurring(days);
    };

    elements.upcomingDays?.addEventListener('change', handleDaysChange);
    elements.upcomingDays?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleDaysChange();
        }
    });

    // Dashboard "Upcoming" button
    elements.viewUpcomingBtn?.addEventListener('click', () => {
        openRecurringModal(true); // true = show upcoming tab
    });

    // Chart click handlers - open spending details modal
    const openSpendingModal = (e) => {
        // Ignore clicks on the period selector itself
        if (e?.target?.closest('.period-selector')) return;

        const summary = state.chartSummary || state.summary;
        if (!summary || !summary.categories) return;

        // Sync period selector with chart period selector
        elements.spendingPeriodSelector.value = elements.chartPeriodSelector.value;
        state.spendingSummary = summary;
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

    // Transactions modal filters
    let searchDebounce;
    elements.transactionsSearch?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            renderTransactionsModal();
        }, 300);
    });

    elements.transactionsPeriodSelector?.addEventListener('change', () => {
        renderTransactionsModal();
    });

    // Stop clicks on modal content from propagating to backdrop
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Close modal handlers - close only the specific modal
    // Backdrop clicks respect data-persist attribute (won't close persistent modals)
    document.querySelectorAll('.modal-backdrop').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = e.target.closest('.modal');
            if (modal && !modal.dataset.persist) {
                closeModal(modal);
            }
        });
    });

    // Close/cancel buttons always work, even on persistent modals
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
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
// Encryption Event Handlers
// ========================================

function setupEncryptionHandlers() {
    // Data Encryption button in settings modal - opens encryption settings
    elements.dataEncryptionBtn?.addEventListener('click', () => {
        closeModal(elements.settingsModal);
        updateEncryptionSettingsModal();
        openModal(elements.encryptionSettingsModal);
    });

    // Enable encryption button
    elements.enableEncryptionBtn?.addEventListener('click', () => {
        closeModal(elements.encryptionSettingsModal);
        openModal(elements.encryptionSetupModal);
    });

    // Change encryption password button
    elements.changeEncryptionPasswordBtn?.addEventListener('click', () => {
        closeModal(elements.encryptionSettingsModal);
        openModal(elements.changeEncryptionPasswordModal);
    });

    // Change encryption password form
    elements.changeEncryptionPasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-encryption-password').value;
        const newPassword = document.getElementById('new-enc-password').value;
        const confirmPassword = document.getElementById('confirm-enc-password').value;

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match');
            return;
        }

        if (newPassword.length < 10) {
            showToast('Password must be at least 10 characters');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            // First verify the current password by trying to unlock
            const settings = state.encryptionSettings;
            if (!settings) {
                showToast('Encryption settings not loaded');
                submitBtn.disabled = false;
                return;
            }

            // Try to derive KEK from current password and unwrap MEK
            try {
                await CryptoModule.unlock(currentPassword, settings.encryption_salt, settings.encrypted_mek);
            } catch (err) {
                showToast('Current encryption password is incorrect');
                submitBtn.disabled = false;
                return;
            }

            // Now change the password (re-wrap MEK with new password)
            const newKeyData = await CryptoModule.changePassword(newPassword);

            // Update on server
            await api('auth.php?action=update-encryption-key', {
                method: 'POST',
                body: {
                    encryption_salt: newKeyData.salt,
                    encrypted_mek: newKeyData.wrappedMEK
                }
            });

            // Update local settings
            state.encryptionSettings.encryption_salt = newKeyData.salt;
            state.encryptionSettings.encrypted_mek = newKeyData.wrappedMEK;

            closeModal(elements.changeEncryptionPasswordModal);
            showToast('Encryption password changed successfully');
            e.target.reset();
        } catch (error) {
            console.error('Failed to change encryption password:', error);
            showToast('Failed to change encryption password');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Disable encryption button
    elements.disableEncryptionBtn?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to disable encryption? Your data will remain encrypted until you manually update each item.')) {
            return;
        }
        closeModal(elements.encryptionSettingsModal);
        await disableEncryption();
    });

    // Encryption setup form
    elements.encryptionSetupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('encryption-setup-password').value;
        const confirm = document.getElementById('encryption-setup-confirm').value;

        if (password !== confirm) {
            showToast('Passwords do not match');
            return;
        }

        if (password.length < 10) {
            showToast('Password must be at least 10 characters');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const result = await enableEncryption(password);
            if (result.success) {
                closeModal(elements.encryptionSetupModal);
                // Show recovery phrase
                displayRecoveryPhrase(result.recoveryPhrase);
                openModal(elements.recoveryPhraseModal);
            } else {
                showToast(result.error || 'Failed to enable encryption');
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Encryption unlock form
    elements.encryptionUnlockForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('encryption-unlock-password').value;
        const rememberKey = document.getElementById('remember-encryption-key')?.checked;
        const rememberDays = parseInt(document.getElementById('remember-key-duration')?.value) || 30;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        submitBtn.disabled = true;

        try {
            const success = await handleEncryptionUnlock(password);
            if (success) {
                // Remember the key if checkbox is checked
                if (rememberKey && CryptoModule?.isReady()) {
                    await CryptoModule.rememberKey(rememberDays);
                }
            } else {
                showToast('Invalid encryption password');
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Recovery form
    elements.encryptionRecoveryForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phrase = document.getElementById('encryption-recovery-phrase').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        submitBtn.disabled = true;

        try {
            const success = await handleRecoveryUnlock(phrase.trim().toLowerCase());
            if (!success) {
                showToast('Invalid recovery phrase');
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Toggle between password and recovery forms
    document.getElementById('use-recovery-btn')?.addEventListener('click', () => {
        elements.encryptionUnlockForm.style.display = 'none';
        elements.encryptionRecoveryForm.style.display = 'block';
    });

    document.getElementById('use-password-btn')?.addEventListener('click', () => {
        elements.encryptionRecoveryForm.style.display = 'none';
        elements.encryptionUnlockForm.style.display = 'block';
    });

    // Copy recovery phrase
    document.getElementById('copy-recovery-phrase')?.addEventListener('click', () => {
        const words = Array.from(document.querySelectorAll('.recovery-word-text'))
            .map(el => el.textContent)
            .join(' ');
        navigator.clipboard.writeText(words).then(() => {
            showToast('Recovery phrase copied to clipboard');
        }).catch(() => {
            showToast('Failed to copy');
        });
    });

    // Confirm recovery saved
    document.getElementById('confirm-recovery-saved')?.addEventListener('click', () => {
        closeModal(elements.recoveryPhraseModal);
        showToast('Encryption enabled successfully');
        updateEncryptionButton();
    });

    // Regenerate recovery phrase button
    elements.regenerateRecoveryBtn?.addEventListener('click', async () => {
        if (!CryptoModule?.isReady()) {
            showToast('Encryption must be unlocked first');
            return;
        }

        if (!confirm('This will generate a new recovery phrase. Your old recovery phrase will no longer work. Continue?')) {
            return;
        }

        closeModal(elements.encryptionSettingsModal);

        try {
            // Generate new recovery key
            const recoveryData = await CryptoModule.regenerateRecoveryKey();

            // Update on server
            await api('auth.php?action=update-recovery-key', {
                method: 'POST',
                body: {
                    recovery_salt: recoveryData.recoverySalt,
                    recovery_encrypted_mek: recoveryData.recoveryWrappedMEK
                }
            });

            // Update local settings
            state.encryptionSettings.recovery_salt = recoveryData.recoverySalt;
            state.encryptionSettings.recovery_encrypted_mek = recoveryData.recoveryWrappedMEK;

            // Show the new recovery phrase
            displayRecoveryPhrase(recoveryData.recoveryPhrase);
            openModal(elements.recoveryPhraseModal);
        } catch (error) {
            console.error('Failed to regenerate recovery phrase:', error);
            showToast('Failed to regenerate recovery phrase');
        }
    });

    // Forget remembered key button
    document.getElementById('forget-remembered-key-btn')?.addEventListener('click', () => {
        if (CryptoModule) {
            CryptoModule.forgetKey();
            updateEncryptionSettingsModal();
            showToast('Remembered key forgotten');
        }
    });

    // New encryption password form (after recovery)
    document.getElementById('encryption-new-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('new-encryption-password').value;
        const confirm = document.getElementById('new-encryption-password-confirm').value;

        if (password !== confirm) {
            showToast('Passwords do not match');
            return;
        }

        if (password.length < 10) {
            showToast('Password must be at least 10 characters');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            // Re-wrap MEK with new password
            const newKeyData = await CryptoModule.changePassword(password);

            // Update on server
            await api('auth.php?action=update-encryption-key', {
                method: 'POST',
                body: {
                    encryption_salt: newKeyData.salt,
                    encrypted_mek: newKeyData.wrappedMEK
                }
            });

            // Update local settings
            state.encryptionSettings.encryption_salt = newKeyData.salt;
            state.encryptionSettings.encrypted_mek = newKeyData.wrappedMEK;

            closeModal(document.getElementById('encryption-new-password-modal'));
            showToast('New encryption password set successfully');

            // Clear form
            e.target.reset();
        } catch (error) {
            console.error('Failed to set new password:', error);
            showToast('Failed to set new password');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

function displayRecoveryPhrase(phrase) {
    const container = elements.recoveryPhraseDisplay;
    if (!container) return;

    const words = phrase.split(' ');
    container.innerHTML = words.map((word, i) => `
        <div class="recovery-word">
            <span class="recovery-word-number">${i + 1}.</span>
            <span class="recovery-word-text">${word}</span>
        </div>
    `).join('');
}

function updateEncryptionButton() {
    // Update the encryption settings modal state
    updateEncryptionSettingsModal();
}

function updateEncryptionSettingsModal() {
    const isEnabled = state.user?.encryption_enabled;
    const isUnlocked = CryptoModule?.isReady();

    // Update status indicator
    if (elements.encryptionStatusIcon) {
        elements.encryptionStatusIcon.classList.toggle('enabled', isEnabled);
    }
    if (elements.encryptionStatus) {
        elements.encryptionStatus.classList.toggle('enabled', isEnabled);
    }
    if (elements.encryptionStatusLabel) {
        elements.encryptionStatusLabel.textContent = isEnabled ? 'Encryption Enabled' : 'Encryption Disabled';
    }
    if (elements.encryptionStatusDesc) {
        if (isEnabled && isUnlocked) {
            elements.encryptionStatusDesc.textContent = 'Your data is encrypted and unlocked';
        } else if (isEnabled) {
            elements.encryptionStatusDesc.textContent = 'Your data is encrypted (locked)';
        } else {
            elements.encryptionStatusDesc.textContent = 'Your data is stored in plain text';
        }
    }

    // Show/hide appropriate options
    if (elements.encryptionOptionsDisabled) {
        elements.encryptionOptionsDisabled.style.display = isEnabled ? 'none' : 'block';
    }
    if (elements.encryptionOptionsEnabled) {
        elements.encryptionOptionsEnabled.style.display = isEnabled ? 'block' : 'none';
    }

    // Show/hide forget remembered key button
    const forgetKeyBtn = document.getElementById('forget-remembered-key-btn');
    const forgetKeyBtnText = document.getElementById('forget-key-btn-text');
    if (forgetKeyBtn && CryptoModule) {
        const keyInfo = CryptoModule.getRememberedKeyInfo();
        if (keyInfo) {
            forgetKeyBtn.style.display = 'flex';
            if (forgetKeyBtnText) {
                if (keyInfo.neverExpires) {
                    forgetKeyBtnText.textContent = 'Forget Remembered Key';
                } else {
                    forgetKeyBtnText.textContent = `Forget Remembered Key (${keyInfo.daysRemaining} days left)`;
                }
            }
        } else {
            forgetKeyBtn.style.display = 'none';
        }
    }
}

// ========================================
// Initialize App
// ========================================

async function init() {
    console.log('App initializing...');
    showScreen('loading');

    // Initialize crypto module
    if (window.CryptoModule) {
        CryptoModule.init();
        console.log('CryptoModule initialized');
    } else {
        console.warn('CryptoModule not available');
    }

    try {
        // Check if already authenticated
        const isAuthenticated = await checkAuthStatus();
        console.log('Auth status:', isAuthenticated);

        if (isAuthenticated) {
            // Check encryption status
            if (state.user?.encryption_enabled) {
                await loadEncryptionSettings();

                // Try to unlock with remembered key first
                if (CryptoModule?.hasRememberedKey()) {
                    const unlocked = await CryptoModule.unlockWithRememberedKey();
                    if (unlocked) {
                        console.log('Unlocked with remembered key');
                        await loadAppData();
                        showAppScreen();
                        return;
                    }
                }

                // Show unlock modal - user needs to enter encryption password
                state.encryptionPending = true;
                showScreen('app');
                openModal(elements.encryptionUnlockModal);
            } else {
                await loadAppData();
                showAppScreen();
            }
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
    setupPasswordToggles();
    setupPasswordStrength();
    setupEncryptionHandlers();

    // Period selector change handler (balance card)
    elements.periodSelector?.addEventListener('change', () => {
        loadSummary();
    });

    // Chart period selector change handler
    elements.chartPeriodSelector?.addEventListener('change', async () => {
        const period = elements.chartPeriodSelector.value;
        try {
            const summary = await api(`api.php?resource=summary&period=${period}`);
            state.chartSummary = summary;
            renderChart();
        } catch (error) {
            showToast('Failed to load chart data');
        }
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
window.deleteRecurringTransaction = deleteRecurringTransaction;
window.openEditRecurringModal = openEditRecurringModal;
window.toggleRecurringTransaction = toggleRecurringTransaction;
