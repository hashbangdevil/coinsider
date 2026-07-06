// ========================================
// Coinsider - Application Logic
// Think. Track. Thrive.
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
    savingsBuckets: [],
    savingsSummary: null,
    accounts: [],
    accountsModuleEnabled: false,
    accountsTotalBalance: 0,
    accountTransfers: [],
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
    transaction: ['description', 'category_name', 'savings_bucket_name', 'account_name'],
    category: ['name'],
    recurring: ['description', 'category_name'],
    bucket: ['name'],
    savingsTransaction: ['description', 'bucket_name'],
    account: ['name'],
    accountTransfer: ['description', 'from_account_name', 'to_account_name']
};

// Reset state to defaults
function resetState() {
    state.user = null;
    state.categories = [];
    state.transactions = [];
    state.allTransactions = [];
    state.recurringTransactions = [];
    state.savingsBuckets = [];
    state.savingsSummary = null;
    state.accounts = [];
    state.accountsModuleEnabled = false;
    state.accountsTotalBalance = 0;
    state.accountTransfers = [];
    state.summary = null;
    state.chartSummary = null;
    state.spendingSummary = null;
    state.encryptionSettings = null;
    state.encryptionPending = false;
    // Lock the crypto module and clear session
    if (window.CryptoModule) {
        CryptoModule.lock();
        CryptoModule.clearSession();
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
    menuBtn: document.getElementById('menu-btn'),
    logoutBtn: document.getElementById('logout-btn'),

    // Navigation Drawer
    navDrawer: document.getElementById('nav-drawer'),
    navDrawerBackdrop: document.getElementById('nav-drawer-backdrop'),
    navDrawerClose: document.getElementById('nav-drawer-close'),
    dashboardContent: document.getElementById('dashboard-content'),

    // Menu Sections
    reportsSection: document.getElementById('reports-section'),
    savingsSection: document.getElementById('savings-section'),
    settingsSection: document.getElementById('settings-section'),
    categoriesMenuSection: document.getElementById('categories-menu-section'),
    recurringMenuSection: document.getElementById('recurring-menu-section'),

    // Back buttons
    reportsBackBtn: document.getElementById('reports-back-btn'),
    savingsBackBtn: document.getElementById('savings-back-btn'),
    settingsBackBtn: document.getElementById('settings-back-btn'),
    categoriesBackBtn: document.getElementById('categories-back-btn'),
    recurringBackBtn: document.getElementById('recurring-back-btn'),

    // Settings (now a section, not modal)
    settingsCurrency: document.getElementById('settings-currency'),

    // Change Password
    changePasswordBtn: document.getElementById('change-password-btn'),
    changePasswordModal: document.getElementById('change-password-modal'),
    changePasswordForm: document.getElementById('change-password-form'),
    
    // Balance
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpenses: document.getElementById('total-expenses'),
    balanceLabel: document.getElementById('balance-label'),
    balancePeriodSelector: document.getElementById('balance-period-selector'),
    balanceToggle: document.getElementById('balance-toggle'),
    toggleLabel: document.getElementById('toggle-label'),
    totalSaved: document.getElementById('total-saved'),
    savingsDetail: document.getElementById('savings-detail'),
    balanceInfoBtn: document.getElementById('balance-info-btn'),
    balanceInfoModal: document.getElementById('balance-info-modal'),
    
    // Categories (formerly Budgets)
    categoriesList: document.getElementById('budgets-list'),
    noCategories: document.getElementById('no-budgets'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    categoryModal: document.getElementById('budget-modal'),
    categoryForm: document.getElementById('budget-form'),
    categoriesListContainer: document.getElementById('categories-list-container'),

    // Recurring (in menu section)
    addRecurringMenuBtn: document.getElementById('add-recurring-menu-btn'),
    recurringMenuList: document.getElementById('recurring-menu-list'),
    noRecurringMenu: document.getElementById('no-recurring-menu'),
    recurringUpcomingList: document.getElementById('recurring-upcoming-list'),
    noRecurringUpcoming: document.getElementById('no-recurring-upcoming'),
    recurringUpcomingDays: document.getElementById('recurring-upcoming-days'),

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
    regenerateRecoveryBtn: document.getElementById('regenerate-recovery-btn'),
    disableEncryptionBtn: document.getElementById('disable-encryption-btn'),
    encryptionUnlockModal: document.getElementById('encryption-unlock-modal'),
    encryptionUnlockForm: document.getElementById('encryption-unlock-form'),
    encryptionRecoveryForm: document.getElementById('encryption-recovery-form'),
    encryptionSetupModal: document.getElementById('encryption-setup-modal'),
    encryptionSetupForm: document.getElementById('encryption-setup-form'),
    recoveryPhraseModal: document.getElementById('recovery-phrase-modal'),
    recoveryPhraseDisplay: document.getElementById('recovery-phrase-display'),

    // Savings Buckets
    bucketsList: document.getElementById('buckets-list'),
    noBuckets: document.getElementById('no-buckets'),
    addBucketBtn: document.getElementById('add-bucket-btn'),
    bucketModal: document.getElementById('bucket-modal'),
    bucketForm: document.getElementById('bucket-form'),
    bucketModalTitle: document.getElementById('bucket-modal-title'),
    bucketSubmitBtn: document.getElementById('bucket-submit-btn'),
    bucketName: document.getElementById('bucket-name'),
    bucketIcon: document.getElementById('bucket-icon'),
    bucketEmojiPreview: document.getElementById('bucket-emoji-preview'),
    bucketEmojiPicker: document.getElementById('bucket-emoji-picker'),
    bucketTarget: document.getElementById('bucket-target'),
    bucketInitialDeposit: document.getElementById('bucket-initial-deposit'),
    bucketInitialDepositGroup: document.getElementById('bucket-initial-deposit-group'),
    bucketAdjustModal: document.getElementById('bucket-adjust-modal'),
    bucketAdjustForm: document.getElementById('bucket-adjust-form'),
    adjustModalTitle: document.getElementById('adjust-modal-title'),
    adjustBucketId: document.getElementById('adjust-bucket-id'),
    adjustBucketInfo: document.getElementById('adjust-bucket-info'),
    adjustBucketIcon: document.getElementById('adjust-bucket-icon'),
    adjustBucketName: document.getElementById('adjust-bucket-name'),
    adjustBucketBalance: document.getElementById('adjust-bucket-balance'),
    adjustAmount: document.getElementById('adjust-amount'),
    adjustDescription: document.getElementById('adjust-description'),
    adjustSubmitBtn: document.getElementById('adjust-submit-btn'),
    bucketDetailsModal: document.getElementById('bucket-details-modal'),
    bucketDetailsTitle: document.getElementById('bucket-details-title'),
    bucketDetailsHeader: document.getElementById('bucket-details-header'),
    bucketTransactionsList: document.getElementById('bucket-transactions-list'),
    noBucketTransactions: document.getElementById('no-bucket-transactions'),
    bucketDepositBtn: document.getElementById('bucket-deposit-btn'),
    bucketWithdrawBtn: document.getElementById('bucket-withdraw-btn'),
    bucketEditBtn: document.getElementById('bucket-edit-btn'),
    bucketDeleteBtn: document.getElementById('bucket-delete-btn'),
    transactionBucket: document.getElementById('transaction-bucket'),
    savingsBucketGroup: document.getElementById('savings-bucket-group'),

    // Accounts
    accountsSection: document.getElementById('accounts-section'),
    accountsBackBtn: document.getElementById('accounts-back-btn'),
    accountsDisabled: document.getElementById('accounts-disabled'),
    accountsContent: document.getElementById('accounts-content'),
    accountsList: document.getElementById('accounts-list'),
    noAccounts: document.getElementById('no-accounts'),
    accountsTotalBalance: document.getElementById('accounts-total-balance'),
    addAccountBtn: document.getElementById('add-account-btn'),
    enableAccountsBtn: document.getElementById('enable-accounts-btn'),
    transferBtn: document.getElementById('transfer-btn'),
    accountModal: document.getElementById('account-modal'),
    accountForm: document.getElementById('account-form'),
    accountModalTitle: document.getElementById('account-modal-title'),
    accountEditId: document.getElementById('account-edit-id'),
    accountIcon: document.getElementById('account-icon'),
    accountEmojiPreview: document.getElementById('account-emoji-preview'),
    accountEmojiPicker: document.getElementById('account-emoji-picker'),
    accountName: document.getElementById('account-name'),
    accountType: document.getElementById('account-type'),
    accountStartingBalance: document.getElementById('account-starting-balance'),
    accountBalanceGroup: document.getElementById('account-balance-group'),
    accountSubmitBtn: document.getElementById('account-submit-btn'),
    transferModal: document.getElementById('transfer-modal'),
    transferForm: document.getElementById('transfer-form'),
    transferFrom: document.getElementById('transfer-from'),
    transferTo: document.getElementById('transfer-to'),
    transferAmount: document.getElementById('transfer-amount'),
    transferDate: document.getElementById('transfer-date'),
    transferDescription: document.getElementById('transfer-description'),
    transactionAccount: document.getElementById('transaction-account'),
    transactionAccountGroup: document.getElementById('transaction-account-group'),

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

function showConfirm(message, title = 'Confirm', acceptText = 'Delete') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const acceptBtn = document.getElementById('confirm-accept');
        const cancelBtn = document.getElementById('confirm-cancel');
        const backdrop = modal.querySelector('.modal-backdrop');

        titleEl.textContent = title;
        messageEl.textContent = message;
        acceptBtn.textContent = acceptText;

        const cleanup = () => {
            modal.classList.remove('active');
            acceptBtn.removeEventListener('click', onAccept);
            cancelBtn.removeEventListener('click', onCancel);
            backdrop.removeEventListener('click', onCancel);
        };

        const onAccept = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        acceptBtn.addEventListener('click', onAccept);
        cancelBtn.addEventListener('click', onCancel);
        backdrop.addEventListener('click', onCancel);

        modal.classList.add('active');
    });
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

async function encryptBucket(data) {
    if (!isEncryptionEnabled()) return data;
    return CryptoModule.encryptObject(data, ENCRYPTED_FIELDS.bucket);
}

async function decryptBucket(data) {
    if (!CryptoModule?.isReady()) return data;
    return CryptoModule.decryptObject(data, ENCRYPTED_FIELDS.bucket);
}

async function decryptBuckets(arr) {
    if (!CryptoModule?.isReady()) return arr;
    return CryptoModule.decryptArray(arr, ENCRYPTED_FIELDS.bucket);
}

async function encryptSavingsTransaction(data) {
    if (!isEncryptionEnabled()) return data;
    return CryptoModule.encryptObject(data, ENCRYPTED_FIELDS.savingsTransaction);
}

async function decryptSavingsTransaction(data) {
    if (!CryptoModule?.isReady()) return data;
    return CryptoModule.decryptObject(data, ENCRYPTED_FIELDS.savingsTransaction);
}

async function decryptSavingsTransactions(arr) {
    if (!CryptoModule?.isReady()) return arr;
    return CryptoModule.decryptArray(arr, ENCRYPTED_FIELDS.savingsTransaction);
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
        // Save to session storage for soft refresh persistence
        await CryptoModule.saveToSession();
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
        // Save to session storage for soft refresh persistence
        await CryptoModule.saveToSession();
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
        // Prompt user to set a new password to sync login and encryption passwords
        showToast('Recovery successful! Please set a new password.');
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
        const data = await api('auth.php?action=status');
        
        if (data.authenticated && data.user) {
            state.user = data.user;
            return true;
        }
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

            // Check if encryption is enabled
            if (state.user.encryption_enabled) {
                await loadEncryptionSettings();

                // Try to unlock with remembered key first
                let unlocked = false;
                if (CryptoModule?.hasRememberedKey()) {
                    unlocked = await CryptoModule.unlockWithRememberedKey();
                    if (unlocked) {
                        // Save to session for soft refresh persistence
                        await CryptoModule.saveToSession();
                    }
                }

                // If not unlocked, try with the login password (unified password)
                if (!unlocked) {
                    unlocked = await unlockEncryption(password);
                }

                if (!unlocked) {
                    // Login password should always work for encryption now (unified password)
                    // If it doesn't, data may be corrupted - show recovery-only modal
                    state.encryptionPending = true;
                    showScreen('app');
                    // Show recovery form directly
                    elements.encryptionUnlockForm.style.display = 'none';
                    elements.encryptionRecoveryForm.style.display = 'block';
                    openModal(elements.encryptionUnlockModal);
                    showToast('Please use your recovery phrase to unlock your data');
                    return;
                }
            }

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
            await loadAppData();
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
    const encryptionEnabled = document.getElementById('reset-encryption-enabled')?.value === 'true';
    const recoveryPhrase = document.getElementById('reset-recovery-phrase')?.value?.trim().toLowerCase();
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

    // If encryption is enabled, recovery phrase is required
    if (encryptionEnabled && !recoveryPhrase) {
        showToast('Recovery phrase is required to reset password');
        return;
    }

    submitBtn.disabled = true;

    try {
        let encryptionData = null;

        // If encryption is enabled, recover MEK and re-wrap with new password
        if (encryptionEnabled && window._resetEncryptionData) {
            try {
                // Initialize crypto module if needed
                if (window.CryptoModule && !CryptoModule.isReady()) {
                    CryptoModule.init();
                }

                // Unlock with recovery phrase
                await CryptoModule.unlockWithRecovery(
                    recoveryPhrase,
                    window._resetEncryptionData.recovery_salt,
                    window._resetEncryptionData.recovery_encrypted_mek
                );

                // Re-wrap MEK with new password
                const newKeyData = await CryptoModule.changePassword(password);
                encryptionData = {
                    encryption_salt: newKeyData.salt,
                    encrypted_mek: newKeyData.wrappedMEK
                };

                // Lock crypto module after
                CryptoModule.lock();
            } catch (cryptoError) {
                console.error('Failed to recover encryption:', cryptoError);
                showToast('Invalid recovery phrase. Please check and try again.');
                submitBtn.disabled = false;
                return;
            }
        }

        // Build request body
        const body = { token, password };
        if (encryptionData) {
            body.encryption_salt = encryptionData.encryption_salt;
            body.encrypted_mek = encryptionData.encrypted_mek;
        }

        const data = await api('auth.php?action=reset-password', {
            method: 'POST',
            body
        });

        if (data.success) {
            showToast('Password reset successfully!');
            showAuthForm('login');
            // Clear URL parameter and encryption data
            window.history.replaceState({}, document.title, window.location.pathname);
            window._resetEncryptionData = null;
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

    // Clear session encryption key
    CryptoModule?.clearSession();

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
        // Restore last-selected balance period (persisted across reloads/sessions)
        // and reflect it in the selector, so the dashboard summary matches.
        const period = localStorage.getItem('balancePeriod') || 'all-time';
        if (elements.balancePeriodSelector && elements.balancePeriodSelector.value !== period) {
            elements.balancePeriodSelector.value = period;
        }
        const [categories, transactions, summary, recurring, savingsBucketsData, accountsData] = await Promise.all([
            api('api.php?resource=categories'),
            api('api.php?resource=transactions&limit=50'),
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=recurring'),
            api('api.php?resource=savings-buckets'),
            api('api.php?resource=accounts')
        ]);


        // Ensure arrays (API might return object with error)
        let cats = Array.isArray(categories) ? categories : [];
        let txns = Array.isArray(transactions) ? transactions : [];
        let recur = Array.isArray(recurring) ? recurring : [];

        // Handle savings buckets response (API returns { buckets, summary })
        let buckets = savingsBucketsData?.buckets || [];
        let savingsSummary = savingsBucketsData?.summary || null;

        // Handle accounts response (API returns { accounts, total_balance })
        let accounts = accountsData?.accounts || [];
        let accountsTotalBalance = accountsData?.total_balance || 0;

        // Decrypt data if encryption is enabled
        if (CryptoModule?.isReady()) {
            cats = await decryptCategories(cats);
            txns = await decryptTransactions(txns);
            recur = await decryptRecurringTransactions(recur);
            buckets = await decryptBuckets(buckets);
            accounts = await decryptAccounts(accounts);

            // Also decrypt category data in summary
            if (summary?.categories) {
                summary.categories = await decryptCategories(summary.categories);
            }
        }

        state.categories = cats;
        state.transactions = txns;
        state.recurringTransactions = recur;
        state.savingsBuckets = buckets;
        state.savingsSummary = savingsSummary;
        state.accounts = accounts;
        state.accountsTotalBalance = accountsTotalBalance;
        state.accountsModuleEnabled = state.user?.accounts_enabled || false;
        state.summary = summary && typeof summary === 'object' ? summary : null;
    } catch (error) {
        console.error('Failed to load data:', error);
        state.categories = [];
        state.transactions = [];
        state.recurringTransactions = [];
        state.savingsBuckets = [];
        state.savingsSummary = null;
        state.accounts = [];
        state.accountsTotalBalance = 0;
        state.accountsModuleEnabled = false;
        state.summary = null;
        showToast('Failed to load data');
    }
}

async function loadSummary() {
    try {
        // Restore last-selected period (persisted across reloads/sessions).
        // loadSummary can run before setupBalanceCard on init, so restore here.
        const savedPeriod = localStorage.getItem('balancePeriod');
        if (savedPeriod && elements.balancePeriodSelector && elements.balancePeriodSelector.value !== savedPeriod) {
            elements.balancePeriodSelector.value = savedPeriod;
        }

        // Use selected period from balance card
        const period = elements.balancePeriodSelector?.value || 'all-time';
        const summary = await api(`api.php?resource=summary&period=${period}`);
        state.summary = summary && typeof summary === 'object' ? summary : null;
        // Decrypt category data in summary
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }
        updateBalances();
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
    if (!await showConfirm('This category will be permanently deleted.', 'Delete Category')) return;

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

function openNewCategoryModal() {
    editingCategoryId = null;
    elements.categoryForm.reset();
    document.getElementById('category-icon').value = '📦';
    updateEmojiPickerSelection('📦');

    // Reset type toggle to expense and enable it
    const typeToggle = document.querySelector('.category-type-toggle');
    if (typeToggle) typeToggle.classList.remove('disabled');
    document.querySelectorAll('.category-type-toggle .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'expense');
    });

    const modalTitle = elements.categoryModal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Add Category';

    openModal(elements.categoryModal);
}

function openEditCategoryModalFromSection(category) {
    if (!category) return;

    editingCategoryId = category.id;

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

    openModal(elements.categoryModal);
}

function openEditCategoryModal(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

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

    openModal(elements.categoryModal);
}

// ========================================
// Transaction Functions
// ========================================

async function createTransaction(description, amount, categoryId, type, date, savingsBucketId = null, accountId = null) {
    try {
        // Encrypt data before sending
        let body = { description, amount, category_id: categoryId, type, date };
        if (savingsBucketId) {
            body.savings_bucket_id = savingsBucketId;
        }
        if (accountId) {
            body.account_id = accountId;
        }
        body = await encryptTransaction(body);

        let transaction = await api('api.php?resource=transactions', {
            method: 'POST',
            body
        });

        // Decrypt the response
        transaction = await decryptTransaction(transaction);
        state.transactions.unshift(transaction);

        // Refresh summary, categories, and savings buckets (with decryption)
        const period = 'all-time';
        const [summary, categories, savingsBucketsData] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories'),
            api('api.php?resource=savings-buckets')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

        // Update savings buckets if a bucket was used
        if (savingsBucketId) {
            state.savingsBuckets = await decryptBuckets(savingsBucketsData?.buckets || []);
            state.savingsSummary = savingsBucketsData?.summary || null;
        }

        // Update accounts if an account was used
        if (accountId && state.accountsModuleEnabled) {
            await loadAccounts();
        }

        renderAll();
        showToast('Transaction added');
    } catch (error) {
        showToast('Failed to add transaction');
    }
}

async function deleteTransaction(id) {
    if (!await showConfirm('This transaction will be permanently deleted.', 'Delete Transaction')) return;

    // Check if transaction has an account (for balance update)
    const transaction = state.transactions.find(t => t.id === id);
    const hadAccount = transaction?.account_id;

    try {
        await api(`api.php?resource=transactions&id=${id}`, { method: 'DELETE' });
        state.transactions = state.transactions.filter(t => t.id !== id);

        // Refresh summary and categories (with decryption)
        const period = 'all-time';
        const [summary, categories] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

        // Update accounts if the transaction had an account
        if (hadAccount && state.accountsModuleEnabled) {
            await loadAccounts();
        }

        renderAll();
        showToast('Transaction deleted');
    } catch (error) {
        showToast('Failed to delete transaction');
    }
}

async function updateTransaction(id, description, amount, categoryId, type, date, savingsBucketId = null, accountId = null) {
    try {
        // Encrypt data before sending
        let body = { description, amount, category_id: categoryId, type, date };
        if (savingsBucketId) {
            body.savings_bucket_id = savingsBucketId;
        }
        if (accountId !== undefined) {
            body.account_id = accountId;
        }
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

        // Refresh summary, categories, and savings buckets (with decryption)
        const period = 'all-time';
        const [summary, categories, savingsBucketsData] = await Promise.all([
            api(`api.php?resource=summary&period=${period}`),
            api('api.php?resource=categories'),
            api('api.php?resource=savings-buckets')
        ]);

        state.summary = summary;
        state.categories = await decryptCategories(categories);
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }

        // Update savings buckets
        state.savingsBuckets = await decryptBuckets(savingsBucketsData?.buckets || []);
        state.savingsSummary = savingsBucketsData?.summary || null;

        // Update accounts if module is enabled
        if (state.accountsModuleEnabled) {
            await loadAccounts();
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

    // Show/hide savings bucket dropdown based on type and populate it
    if (elements.savingsBucketGroup) {
        elements.savingsBucketGroup.style.display = type === 'expense' ? 'block' : 'none';
    }
    populateBucketDropdown();
    if (elements.transactionBucket) {
        elements.transactionBucket.value = transaction.savings_bucket_id || '';
    }

    // Populate account dropdown and set current value
    populateAccountDropdowns();
    if (elements.transactionAccount) {
        elements.transactionAccount.value = transaction.account_id || '';
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

        // Account badge (only show if accounts enabled and transaction has account)
        const accountBadge = state.accountsModuleEnabled && transaction.account_id && transaction.account_name
            ? `<span class="transaction-account-badge">${escapeHtml(transaction.account_icon || '💰')} ${escapeHtml(transaction.account_name)}</span>`
            : '';

        const html = `
            <div class="transaction-item" data-id="${transaction.id}">
                <div class="transaction-content" onclick="openEditTransactionModal(${transaction.id})">
                    <div class="transaction-icon ${transaction.type}" style="background: ${isIncome ? 'var(--color-success-light)' : catColor + '20'}">
                        ${catIcon}
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-description">${escapeHtml(transaction.description)}</div>
                        <div class="transaction-meta">${escapeHtml(catName)} • ${formatDate(transaction.date)}${accountBadge ? ' ' + accountBadge : ''}${transaction.needs_review == 1 ? ' <span class="import-badge">review</span>' : ''}</div>
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
        const period = 'all-time';
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
    if (!await showConfirm('This recurring transaction will be permanently deleted.', 'Delete Recurring')) return;

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

function openRecurringFormModal(recurring = null) {
    if (recurring) {
        // Editing existing recurring transaction
        editingRecurringId = recurring.id;

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

        // Hide skip-first checkbox when editing
        const skipFirstGroup = document.getElementById('skip-first-group');
        if (skipFirstGroup) skipFirstGroup.style.display = 'none';

        // Update modal title and button
        const modalTitle = elements.recurringFormModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Edit Recurring Transaction';
        const submitBtn = document.getElementById('recurring-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Save Changes';
    } else {
        // Adding new recurring transaction
        editingRecurringId = null;
        elements.recurringForm.reset();

        // Reset type toggle to expense
        document.querySelectorAll('.recurring-type-toggle .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'expense');
        });

        // Set default start date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('recurring-start-date').value = today;

        // Show skip first checkbox and default to checked
        const skipFirstGroup = document.getElementById('skip-first-group');
        const skipFirstCheckbox = document.getElementById('recurring-skip-first');
        if (skipFirstGroup) skipFirstGroup.style.display = 'block';
        if (skipFirstCheckbox) skipFirstCheckbox.checked = true;

        // Populate category dropdown with expense categories
        populateCategoryDropdown(elements.recurringCategory, 'expense');

        // Update modal title and button
        const modalTitle = elements.recurringFormModal.querySelector('.modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Add Recurring Transaction';
        const submitBtn = document.getElementById('recurring-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Add Recurring';
    }

    openModal(elements.recurringFormModal);
}

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
// Savings Bucket Functions
// ========================================

function getBucketById(bucketId) {
    return state.savingsBuckets.find(b => b.id === bucketId) || null;
}

function getActiveBuckets() {
    return state.savingsBuckets.filter(b => b.is_active);
}

function populateBucketDropdown() {
    const select = elements.transactionBucket;
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">None - use available funds</option>';

    const activeBuckets = getActiveBuckets();
    activeBuckets.forEach(bucket => {
        const option = document.createElement('option');
        option.value = bucket.id;
        option.textContent = `${bucket.icon} ${bucket.name} (${formatCurrency(bucket.current_balance)})`;
        select.appendChild(option);
    });

    // Restore previous selection if still valid
    if (currentValue && activeBuckets.some(b => b.id == currentValue)) {
        select.value = currentValue;
    }
}

async function loadSavingsBuckets() {
    try {
        const data = await api('api.php?resource=savings-buckets');
        let buckets = data?.buckets || [];
        buckets = await decryptBuckets(buckets);
        state.savingsBuckets = buckets;
        state.savingsSummary = data?.summary || null;
        renderSavingsBuckets();
        updateSavingsSummary();
    } catch (error) {
        console.error('Failed to load savings buckets:', error);
    }
}

async function createSavingsBucket(name, icon, monthlyTarget, initialDeposit = 0) {
    try {
        let body = { name, icon, monthly_target: monthlyTarget };
        body = await encryptBucket(body);

        let bucket = await api('api.php?resource=savings-buckets', {
            method: 'POST',
            body
        });

        bucket = await decryptBucket(bucket);
        state.savingsBuckets.push(bucket);

        // Add initial deposit if specified
        if (initialDeposit > 0) {
            await addToBucketSilent(bucket.id, initialDeposit, 'allocation', 'Initial deposit');
            showToast(`Bucket created with ${formatCurrency(initialDeposit)} deposit`);
        } else {
            renderSavingsBuckets();
            updateSavingsSummary();
            showToast('Savings bucket created');
        }

        // Scroll to the new bucket after render completes
        requestAnimationFrame(() => {
            setTimeout(() => {
                const newBucketCard = document.querySelector(`.bucket-card[data-bucket-id="${bucket.id}"]`);
                if (newBucketCard) {
                    newBucketCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 50);
        });

        return bucket;
    } catch (error) {
        console.error('Failed to create bucket:', error);
        showToast('Failed to create bucket');
        return null;
    }
}

async function updateSavingsBucket(id, name, icon, monthlyTarget) {
    try {
        let body = { name, icon, monthly_target: monthlyTarget };
        body = await encryptBucket(body);

        let bucket = await api(`api.php?resource=savings-buckets&id=${id}`, {
            method: 'PUT',
            body
        });

        bucket = await decryptBucket(bucket);
        const index = state.savingsBuckets.findIndex(b => b.id === id);
        if (index !== -1) {
            state.savingsBuckets[index] = bucket;
        }
        renderSavingsBuckets();
        showToast('Savings bucket updated');
        return bucket;
    } catch (error) {
        console.error('Failed to update bucket:', error);
        showToast('Failed to update bucket');
        return null;
    }
}

async function deleteSavingsBucket(id) {
    try {
        await api(`api.php?resource=savings-buckets&id=${id}`, { method: 'DELETE' });
        state.savingsBuckets = state.savingsBuckets.filter(b => b.id !== id);

        // Reload savings summary
        const data = await api('api.php?resource=savings-buckets');
        state.savingsSummary = data?.summary || null;

        renderSavingsBuckets();
        updateSavingsSummary();
        showToast('Savings bucket deleted');
    } catch (error) {
        console.error('Failed to delete bucket:', error);
        showToast('Failed to delete bucket');
    }
}

async function addToBucket(bucketId, amount, type, description) {
    try {
        let body = {
            bucket_id: bucketId,
            amount: amount,
            type: type,
            description: description,
            date: new Date().toISOString().split('T')[0]
        };
        body = await encryptSavingsTransaction(body);

        await api('api.php?resource=savings-transactions', {
            method: 'POST',
            body
        });

        // Reload buckets to get updated balance
        await loadSavingsBuckets();

        // Also reload summary to update available to spend
        const period = 'all-time';
        const summary = await api(`api.php?resource=summary&period=${period}`);
        state.summary = summary;
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }
        updateBalances();

        showToast(type === 'allocation' ? 'Deposit added' : 'Withdrawal processed');
    } catch (error) {
        console.error('Failed to add to bucket:', error);
        showToast('Failed to process bucket transaction');
    }
}

async function addToBucketSilent(bucketId, amount, type, description) {
    try {
        let body = {
            bucket_id: bucketId,
            amount: amount,
            type: type,
            description: description,
            date: new Date().toISOString().split('T')[0]
        };
        body = await encryptSavingsTransaction(body);

        await api('api.php?resource=savings-transactions', {
            method: 'POST',
            body
        });

        // Reload buckets to get updated balance
        await loadSavingsBuckets();

        // Also reload summary to update available to spend
        const period = 'all-time';
        const summary = await api(`api.php?resource=summary&period=${period}`);
        state.summary = summary;
        if (state.summary?.categories) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }
        updateBalances();
    } catch (error) {
        console.error('Failed to add to bucket:', error);
        throw error;
    }
}

async function loadBucketDetails(bucketId) {
    try {
        const bucket = await api(`api.php?resource=savings-buckets&id=${bucketId}`);
        const decryptedBucket = await decryptBucket(bucket);

        // Decrypt transactions in the bucket
        if (decryptedBucket.transactions) {
            decryptedBucket.transactions = await decryptSavingsTransactions(decryptedBucket.transactions);
        }

        return decryptedBucket;
    } catch (error) {
        console.error('Failed to load bucket details:', error);
        return null;
    }
}

function updateSavingsSummary() {
    // Update balance card with savings info
    updateBalances();
}

function renderSavingsBuckets() {
    const container = elements.bucketsList;
    const emptyState = elements.noBuckets;
    if (!container) return;

    const buckets = state.savingsBuckets || [];

    if (buckets.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyState);
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    buckets.forEach(bucket => {
        const card = renderBucketCard(bucket);
        container.appendChild(card);
    });

    // Also update the transaction modal dropdown
    populateBucketDropdown();
}

function renderBucketCard(bucket) {
    const card = document.createElement('div');
    card.className = `bucket-card${bucket.is_active ? '' : ' inactive'}`;
    card.dataset.bucketId = bucket.id;

    const balance = bucket.current_balance || 0;
    const target = bucket.monthly_target || 0;
    const progressPercent = target > 0 ? Math.min((balance / target) * 100, 100) : 0;
    const isNegative = balance < 0;

    card.innerHTML = `
        <div class="bucket-header">
            <div class="bucket-icon">${escapeHtml(bucket.icon)}</div>
            <div class="bucket-info">
                <h4>${escapeHtml(bucket.name)}</h4>
                <span class="bucket-balance ${isNegative ? 'negative' : ''}">${formatCurrency(balance)}</span>
            </div>
            <div class="bucket-actions">
                <button class="btn-icon bucket-deposit-action" title="Deposit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
                <button class="btn-icon bucket-withdraw-action" title="Withdraw">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
            </div>
        </div>
        ${target > 0 ? `
            <div class="bucket-progress">
                <div class="bucket-progress-bar ${isNegative ? 'negative' : ''}" style="width: ${progressPercent}%"></div>
            </div>
            <div class="bucket-footer">
                <span>Monthly: ${formatCurrency(target)}</span>
                <span>${progressPercent.toFixed(0)}% of goal</span>
            </div>
        ` : ''}
    `;

    // Click on card to view details
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.bucket-actions')) {
            openBucketDetailsModal(bucket.id);
        }
    });

    // Deposit button
    card.querySelector('.bucket-deposit-action')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openBucketAdjustModal(bucket.id, 'allocation');
    });

    // Withdraw button
    card.querySelector('.bucket-withdraw-action')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openBucketAdjustModal(bucket.id, 'withdrawal');
    });

    return card;
}

// ========================================
// Savings Bucket Modals
// ========================================

let currentEditingBucket = null;

function openBucketModal(bucketId = null) {
    currentEditingBucket = bucketId ? getBucketById(bucketId) : null;

    elements.bucketModalTitle.textContent = currentEditingBucket ? 'Edit Savings Bucket' : 'Add Savings Bucket';
    elements.bucketSubmitBtn.textContent = currentEditingBucket ? 'Save Changes' : 'Create Bucket';

    if (currentEditingBucket) {
        elements.bucketName.value = currentEditingBucket.name;
        elements.bucketIcon.value = currentEditingBucket.icon;
        elements.bucketEmojiPreview.textContent = currentEditingBucket.icon;
        elements.bucketTarget.value = currentEditingBucket.monthly_target || '';
        // Hide initial deposit field when editing
        if (elements.bucketInitialDepositGroup) {
            elements.bucketInitialDepositGroup.style.display = 'none';
        }
    } else {
        elements.bucketName.value = '';
        elements.bucketIcon.value = '💰';
        elements.bucketEmojiPreview.textContent = '💰';
        elements.bucketTarget.value = '';
        // Show initial deposit field when creating and reset value
        if (elements.bucketInitialDepositGroup) {
            elements.bucketInitialDepositGroup.style.display = '';
        }
        if (elements.bucketInitialDeposit) {
            elements.bucketInitialDeposit.value = '';
        }
    }

    openModal(elements.bucketModal);
}

let currentAdjustType = 'allocation';

function openBucketAdjustModal(bucketId, type = 'allocation') {
    const bucket = getBucketById(bucketId);
    if (!bucket) return;

    currentAdjustType = type;
    elements.adjustBucketId.value = bucketId;
    elements.adjustModalTitle.textContent = type === 'allocation' ? 'Deposit to Bucket' : 'Withdraw from Bucket';
    elements.adjustBucketIcon.textContent = bucket.icon;
    elements.adjustBucketName.textContent = bucket.name;
    elements.adjustBucketBalance.textContent = formatCurrency(bucket.current_balance);
    elements.adjustAmount.value = '';
    elements.adjustDescription.value = '';
    elements.adjustSubmitBtn.textContent = type === 'allocation' ? 'Confirm Deposit' : 'Confirm Withdrawal';

    // Update toggle buttons
    const toggleBtns = elements.bucketAdjustModal.querySelectorAll('.adjust-type-toggle .type-btn');
    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    openModal(elements.bucketAdjustModal);
}

let currentViewingBucket = null;

async function openBucketDetailsModal(bucketId) {
    const bucket = await loadBucketDetails(bucketId);
    if (!bucket) return;

    currentViewingBucket = bucket;

    elements.bucketDetailsTitle.textContent = `${bucket.icon} ${bucket.name}`;

    // Render header with balance and monthly target
    elements.bucketDetailsHeader.innerHTML = `
        <div class="bucket-detail-balance">
            <span class="label">Current Balance</span>
            <span class="value ${bucket.current_balance < 0 ? 'negative' : ''}">${formatCurrency(bucket.current_balance)}</span>
        </div>
        ${bucket.monthly_target > 0 ? `
            <div class="bucket-detail-target">
                <span class="label">Monthly Target</span>
                <span class="value">${formatCurrency(bucket.monthly_target)}</span>
            </div>
        ` : ''}
    `;

    // Render transactions
    renderBucketTransactions(bucket.transactions || []);

    openModal(elements.bucketDetailsModal);
}

function renderBucketTransactions(transactions) {
    const container = elements.bucketTransactionsList;
    const emptyState = elements.noBucketTransactions;

    if (transactions.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    transactions.forEach(tx => {
        const isDeposit = tx.type === 'allocation' || tx.type === 'adjustment' && tx.amount > 0;
        const item = document.createElement('div');
        item.className = `bucket-transaction-item ${isDeposit ? 'deposit' : 'withdrawal'}`;
        item.innerHTML = `
            <div class="bucket-tx-info">
                <span class="bucket-tx-description">${escapeHtml(tx.description || (isDeposit ? 'Deposit' : 'Withdrawal'))}</span>
                <span class="bucket-tx-date">${formatDate(tx.date)}</span>
            </div>
            <span class="bucket-tx-amount ${isDeposit ? 'positive' : 'negative'}">
                ${isDeposit ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}
            </span>
        `;
        container.appendChild(item);
    });
}

// ========================================
// Navigation Drawer
// ========================================

function openNavDrawer() {
    elements.navDrawer?.classList.add('active');
    elements.navDrawerBackdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeNavDrawer() {
    elements.navDrawer?.classList.remove('active');
    elements.navDrawerBackdrop?.classList.remove('active');
    document.body.style.overflow = '';
}

function showMenuSection(sectionName) {
    // Hide dashboard content
    elements.dashboardContent?.classList.add('hidden');

    // Hide all menu sections
    const menuSections = document.querySelectorAll('.menu-section');
    menuSections.forEach(section => {
        section.style.display = 'none';
    });

    // Show the selected section
    switch (sectionName) {
        case 'reports':
            elements.reportsSection.style.display = 'block';
            // Render charts now that the section is visible
            renderChart();
            const months = parseInt(document.getElementById('trends-range-selector')?.value) || 12;
            loadTrends(months);
            break;
        case 'categories':
            elements.categoriesMenuSection.style.display = 'block';
            renderCategoriesInSection();
            break;
        case 'recurring':
            elements.recurringMenuSection.style.display = 'block';
            renderRecurringInSection();
            break;
        case 'savings':
            elements.savingsSection.style.display = 'block';
            renderSavingsBuckets();
            break;
        case 'accounts':
            elements.accountsSection.style.display = 'block';
            renderAccounts();
            break;
        case 'settings':
            elements.settingsSection.style.display = 'block';
            elements.settingsCurrency.value = state.user?.currency || 'ZAR';
            updateEncryptionStatusText();
            break;
    }

    closeNavDrawer();
}

function showDashboard() {
    // Hide all menu sections
    const menuSections = document.querySelectorAll('.menu-section');
    menuSections.forEach(section => {
        section.style.display = 'none';
    });

    // Show dashboard content
    elements.dashboardContent?.classList.remove('hidden');
}

function updateEncryptionStatusText() {
    const statusText = document.getElementById('encryption-status-text');
    if (statusText) {
        if (state.user?.encryption_enabled) {
            statusText.textContent = 'Your data is encrypted';
        } else {
            statusText.textContent = 'Protect your financial data';
        }
    }
}

function renderCategoriesInSection() {
    const container = elements.categoriesListContainer;
    if (!container) return;

    container.innerHTML = '';

    if (state.categories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                <p>No categories yet</p>
                <span>Create your first category to get started</span>
            </div>
        `;
        return;
    }

    // Group by type
    const expenses = state.categories.filter(c => c.type === 'expense');
    const incomes = state.categories.filter(c => c.type === 'income');

    // Get saved accordion state from localStorage
    const accordionState = JSON.parse(localStorage.getItem('categoryAccordionState') || '{"expense": true, "income": true}');

    if (expenses.length > 0) {
        const expenseGroup = createCategoryAccordion('expense', 'Expense Categories', expenses, accordionState.expense);
        container.appendChild(expenseGroup);
    }

    if (incomes.length > 0) {
        const incomeGroup = createCategoryAccordion('income', 'Income Categories', incomes, accordionState.income);
        container.appendChild(incomeGroup);
    }

    // Check if container can scroll and update class for scroll indicator
    requestAnimationFrame(() => {
        updateCategoryScrollIndicator();
    });
}

function updateCategoryScrollIndicator() {
    const container = elements.categoriesListContainer;
    const section = elements.categoriesMenuSection;
    if (!container || !section) return;

    const canScroll = container.scrollHeight > container.clientHeight;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;

    if (canScroll && !isAtBottom) {
        section.classList.add('can-scroll');
    } else {
        section.classList.remove('can-scroll');
    }
}

function createCategoryAccordion(type, title, categories, isExpanded = true) {
    const group = document.createElement('div');
    group.className = 'category-accordion';
    group.dataset.type = type;

    const header = document.createElement('button');
    header.className = `category-accordion-header ${isExpanded ? 'expanded' : ''}`;
    header.innerHTML = `
        <span class="category-accordion-title">${title}</span>
        <span class="category-accordion-count">${categories.length}</span>
        <svg class="category-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    `;

    const content = document.createElement('div');
    content.className = `category-accordion-content ${isExpanded ? 'expanded' : ''}`;

    categories.forEach(cat => {
        content.appendChild(createCategoryListItem(cat));
    });

    header.addEventListener('click', () => {
        const willExpand = !header.classList.contains('expanded');
        header.classList.toggle('expanded');
        content.classList.toggle('expanded');

        // Save state to localStorage
        const accordionState = JSON.parse(localStorage.getItem('categoryAccordionState') || '{"expense": true, "income": true}');
        accordionState[type] = willExpand;
        localStorage.setItem('categoryAccordionState', JSON.stringify(accordionState));
    });

    group.appendChild(header);
    group.appendChild(content);

    return group;
}

function createCategoryListItem(category) {
    const item = document.createElement('div');
    item.className = 'category-list-item';
    item.innerHTML = `
        <div class="category-list-icon">${escapeHtml(category.icon)}</div>
        <div class="category-list-info">
            <span class="category-list-name">${escapeHtml(category.name)}</span>
            ${category.budget_amount > 0 ? `<span class="category-list-budget">${formatCurrency(category.budget_amount)}/mo</span>` : ''}
        </div>
        <div class="category-list-actions">
            <button class="btn-icon btn-small" data-edit="${category.id}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
            <button class="btn-icon btn-small btn-danger-ghost" data-delete="${category.id}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `;

    // Edit button
    item.querySelector('[data-edit]').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCategoryModalFromSection(category);
    });

    // Delete button
    item.querySelector('[data-delete]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm(
            `Transactions will keep their data but won't have a category.`,
            `Delete "${category.name}"?`
        );
        if (confirmed) {
            await deleteCategory(category.id);
            renderCategoriesInSection();
        }
    });

    return item;
}

function renderRecurringInSection() {
    const container = elements.recurringMenuList;
    const emptyState = elements.noRecurringMenu;
    if (!container || !emptyState) return;

    // Clear existing items except empty state
    Array.from(container.children).forEach(child => {
        if (!child.classList.contains('empty-state')) {
            child.remove();
        }
    });

    const recurring = state.recurringTransactions.filter(r => r.is_active);

    if (recurring.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    recurring.forEach(rule => {
        const category = getCategoryById(rule.category_id);
        const item = document.createElement('div');
        item.className = `recurring-item ${rule.is_active ? '' : 'paused'}`;
        item.innerHTML = `
            <div class="recurring-content">
                <div class="recurring-icon ${rule.type}">${escapeHtml(category.icon)}</div>
                <div class="recurring-info">
                    <div class="recurring-description">${escapeHtml(rule.description)}</div>
                    <div class="recurring-meta">
                        <span>${rule.frequency === 'monthly' ? 'Monthly' : 'Yearly'}</span>
                        <span>•</span>
                        <span>Day ${new Date(rule.start_date).getDate()}</span>
                    </div>
                </div>
            </div>
            <span class="recurring-amount ${rule.type}">${rule.type === 'income' ? '+' : '-'}${formatCurrency(rule.amount)}</span>
        `;

        item.addEventListener('click', () => {
            openRecurringFormModal(rule);
        });

        container.appendChild(item);
    });
}

function setupNavigationDrawer() {
    // Menu button opens drawer
    elements.menuBtn?.addEventListener('click', openNavDrawer);

    // Logo preview (mobile: tap to show enlarged)
    const logoSmall = document.querySelector('.app-logo-small');
    const logoPreviewOverlay = document.getElementById('logo-preview-overlay');

    if (logoSmall && logoPreviewOverlay) {
        // Only handle click on touch devices (desktop uses CSS hover)
        logoSmall.addEventListener('click', () => {
            const isTouchDevice = window.matchMedia('(hover: none)').matches;
            if (isTouchDevice) {
                logoPreviewOverlay.classList.add('visible');
            }
        });

        logoPreviewOverlay.addEventListener('click', () => {
            logoPreviewOverlay.classList.remove('visible');
        });
    }

    // Close button and backdrop close drawer
    elements.navDrawerClose?.addEventListener('click', closeNavDrawer);
    elements.navDrawerBackdrop?.addEventListener('click', closeNavDrawer);

    // Navigation items
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            showMenuSection(section);
        });
    });

    // Back buttons
    elements.reportsBackBtn?.addEventListener('click', showDashboard);
    elements.savingsBackBtn?.addEventListener('click', showDashboard);
    elements.settingsBackBtn?.addEventListener('click', showDashboard);
    elements.categoriesBackBtn?.addEventListener('click', showDashboard);
    elements.recurringBackBtn?.addEventListener('click', showDashboard);
    elements.accountsBackBtn?.addEventListener('click', showDashboard);

    // Add category button in categories section
    elements.addCategoryBtn?.addEventListener('click', () => openNewCategoryModal());

    // Scroll indicator for categories list
    elements.categoriesListContainer?.addEventListener('scroll', updateCategoryScrollIndicator);

    // Add recurring button in recurring section
    elements.addRecurringMenuBtn?.addEventListener('click', () => openRecurringFormModal());

    // Recurring tabs in section
    const recurringSection = elements.recurringMenuSection;
    if (recurringSection) {
        recurringSection.querySelectorAll('.recurring-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                recurringSection.querySelectorAll('.recurring-tab').forEach(t => t.classList.remove('active'));
                recurringSection.querySelectorAll('.recurring-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const tabId = `recurring-${tab.dataset.tab}-tab`;
                document.getElementById(tabId)?.classList.add('active');

                if (tab.dataset.tab === 'upcoming') {
                    renderUpcomingInSection();
                }
            });
        });

        // Upcoming days input
        elements.recurringUpcomingDays?.addEventListener('change', renderUpcomingInSection);
    }

    // Handle keyboard escape to close drawer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.navDrawer?.classList.contains('active')) {
            closeNavDrawer();
        }
    });
}

async function renderUpcomingInSection() {
    const days = parseInt(elements.recurringUpcomingDays?.value) || 7;
    const container = elements.recurringUpcomingList;
    const emptyState = elements.noRecurringUpcoming;
    if (!container || !emptyState) return;

    // Clear existing items except empty state
    Array.from(container.children).forEach(child => {
        if (!child.classList.contains('empty-state')) {
            child.remove();
        }
    });

    try {
        let upcoming = await api(`api.php?resource=recurring&upcoming=1&days=${days}`);
        upcoming = await decryptRecurringTransactions(Array.isArray(upcoming) ? upcoming : []);

        if (upcoming.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        upcoming.forEach(recurring => {
            const category = getCategoryById(recurring.category_id);
            const nextDate = new Date(recurring.next_occurrence);
            const itemEl = document.createElement('div');
            itemEl.className = 'upcoming-item';
            itemEl.innerHTML = `
                <div class="upcoming-date">${formatDate(nextDate)}</div>
                <div class="upcoming-content">
                    <div class="upcoming-icon ${recurring.type}">${category.icon}</div>
                    <div class="upcoming-info">
                        <span class="upcoming-description">${escapeHtml(recurring.description)}</span>
                    </div>
                    <span class="upcoming-amount ${recurring.type}">${recurring.type === 'income' ? '+' : '-'}${formatCurrency(recurring.amount)}</span>
                </div>
            `;
            container.appendChild(itemEl);
        });
    } catch (error) {
        console.error('Failed to load upcoming recurring:', error);
        emptyState.style.display = 'flex';
    }
}

function setupBalanceCard() {
    // Balance toggle handler
    elements.balanceToggle?.addEventListener('change', () => {
        updateBalances();
    });

    // Balance period selector handler
    elements.balancePeriodSelector?.addEventListener('change', async () => {
        // Persist the user's choice so it survives reloads/reopens
        localStorage.setItem('balancePeriod', elements.balancePeriodSelector.value);
        await loadSummary();
    });

    // Balance info button
    elements.balanceInfoBtn?.addEventListener('click', () => {
        openModal(elements.balanceInfoModal);
    });

    // Balance info modal close
    document.getElementById('balance-info-close')?.addEventListener('click', () => {
        closeModal(elements.balanceInfoModal);
    });
}

function setupBucketModals() {
    // Add bucket button
    elements.addBucketBtn?.addEventListener('click', () => openBucketModal());

    // Bucket form submit
    elements.bucketForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = elements.bucketName.value.trim();
        const icon = elements.bucketIcon.value;
        const monthlyTarget = parseFloat(elements.bucketTarget.value) || 0;
        const initialDeposit = parseFloat(elements.bucketInitialDeposit?.value) || 0;

        if (currentEditingBucket) {
            await updateSavingsBucket(currentEditingBucket.id, name, icon, monthlyTarget);
        } else {
            await createSavingsBucket(name, icon, monthlyTarget, initialDeposit);
        }

        closeModal(elements.bucketModal);
    });

    // Bucket emoji picker
    elements.bucketEmojiPicker?.querySelectorAll('.emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            elements.bucketIcon.value = emoji;
            elements.bucketEmojiPreview.textContent = emoji;
        });
    });

    // Bucket adjust form submit
    elements.bucketAdjustForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const bucketId = parseInt(elements.adjustBucketId.value);
        const amount = parseFloat(elements.adjustAmount.value);
        const description = elements.adjustDescription.value.trim();

        if (amount <= 0) {
            showToast('Please enter a valid amount');
            return;
        }

        await addToBucket(bucketId, amount, currentAdjustType, description);
        closeModal(elements.bucketAdjustModal);
    });

    // Adjust type toggle
    elements.bucketAdjustModal?.querySelectorAll('.adjust-type-toggle .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAdjustType = btn.dataset.type;
            elements.adjustModalTitle.textContent = currentAdjustType === 'allocation' ? 'Deposit to Bucket' : 'Withdraw from Bucket';
            elements.adjustSubmitBtn.textContent = currentAdjustType === 'allocation' ? 'Confirm Deposit' : 'Confirm Withdrawal';

            elements.bucketAdjustModal.querySelectorAll('.adjust-type-toggle .type-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
        });
    });

    // Bucket details modal actions
    elements.bucketDepositBtn?.addEventListener('click', () => {
        if (currentViewingBucket) {
            closeModal(elements.bucketDetailsModal);
            openBucketAdjustModal(currentViewingBucket.id, 'allocation');
        }
    });

    elements.bucketWithdrawBtn?.addEventListener('click', () => {
        if (currentViewingBucket) {
            closeModal(elements.bucketDetailsModal);
            openBucketAdjustModal(currentViewingBucket.id, 'withdrawal');
        }
    });

    elements.bucketEditBtn?.addEventListener('click', () => {
        if (currentViewingBucket) {
            closeModal(elements.bucketDetailsModal);
            openBucketModal(currentViewingBucket.id);
        }
    });

    elements.bucketDeleteBtn?.addEventListener('click', async () => {
        if (!currentViewingBucket) return;
        const confirmed = await showConfirm(
            'This will also delete all associated transactions.',
            `Delete "${currentViewingBucket.name}"?`
        );
        if (confirmed) {
            closeModal(elements.bucketDetailsModal);
            await deleteSavingsBucket(currentViewingBucket.id);
        }
    });

    // Show/hide savings bucket dropdown based on transaction type
    setupTransactionBucketToggle();
}

function setupTransactionBucketToggle() {
    // Watch for transaction type changes to show/hide bucket dropdown
    const transactionTypeToggle = elements.transactionModal?.querySelector('.transaction-type-toggle');
    if (transactionTypeToggle) {
        transactionTypeToggle.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const isExpense = btn.dataset.type === 'expense';
                if (elements.savingsBucketGroup) {
                    elements.savingsBucketGroup.style.display = isExpense ? 'block' : 'none';
                }
                if (!isExpense && elements.transactionBucket) {
                    elements.transactionBucket.value = '';
                }
            });
        });
    }
}

// ========================================
// Accounts Module
// ========================================

// Account helper functions
function getAccountById(accountId) {
    return state.accounts.find(a => a.id === accountId);
}

function getAccountTypeLabel(type) {
    const labels = {
        'bank': 'Bank Account',
        'credit_card': 'Credit Card',
        'cash': 'Cash',
        'savings': 'Savings Account',
        'ewallet': 'E-Wallet',
        'investment': 'Investment',
        'other': 'Other'
    };
    return labels[type] || 'Account';
}

function getAccountTypeDefaultIcon(type) {
    const icons = {
        'bank': '🏦',
        'credit_card': '💳',
        'cash': '💵',
        'savings': '🐷',
        'ewallet': '📱',
        'investment': '📈',
        'other': '💰'
    };
    return icons[type] || '💰';
}

// Encryption helpers for accounts
async function encryptAccount(account) {
    if (!CryptoModule?.isReady()) return account;
    const encrypted = { ...account };
    for (const field of ENCRYPTED_FIELDS.account) {
        if (encrypted[field]) {
            encrypted[field] = await CryptoModule.encrypt(encrypted[field]);
        }
    }
    return encrypted;
}

async function decryptAccount(account) {
    if (!account || !CryptoModule?.isReady()) return account;
    const decrypted = { ...account };
    for (const field of ENCRYPTED_FIELDS.account) {
        if (decrypted[field] && typeof decrypted[field] === 'string') {
            try {
                decrypted[field] = await CryptoModule.decrypt(decrypted[field]);
            } catch (e) {
                // Field might not be encrypted
            }
        }
    }
    return decrypted;
}

async function decryptAccounts(accounts) {
    if (!accounts || !CryptoModule?.isReady()) return accounts;
    return Promise.all(accounts.map(decryptAccount));
}

async function encryptAccountTransfer(transfer) {
    if (!CryptoModule?.isReady()) return transfer;
    const encrypted = { ...transfer };
    // Only encrypt description field for transfers
    if (encrypted.description) {
        encrypted.description = await CryptoModule.encrypt(encrypted.description);
    }
    return encrypted;
}

async function decryptAccountTransfer(transfer) {
    if (!transfer || !CryptoModule?.isReady()) return transfer;
    const decrypted = { ...transfer };
    for (const field of ENCRYPTED_FIELDS.accountTransfer) {
        if (decrypted[field] && typeof decrypted[field] === 'string') {
            try {
                decrypted[field] = await CryptoModule.decrypt(decrypted[field]);
            } catch (e) {
                // Field might not be encrypted
            }
        }
    }
    return decrypted;
}

async function decryptAccountTransfers(transfers) {
    if (!transfers || !CryptoModule?.isReady()) return transfers;
    return Promise.all(transfers.map(decryptAccountTransfer));
}

// Accounts CRUD functions
async function loadAccounts() {
    try {
        const data = await api('api.php?resource=accounts');
        let accounts = data?.accounts || [];
        accounts = await decryptAccounts(accounts);
        state.accounts = accounts;
        state.accountsTotalBalance = data?.total_balance || 0;
        state.accountsModuleEnabled = state.user?.accounts_enabled || false;
        renderAccounts();
        populateAccountDropdowns();
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

async function createAccount(name, type, icon, startingBalance) {
    try {
        let body = { name, type, icon, starting_balance: startingBalance };
        body = await encryptAccount(body);

        let account = await api('api.php?resource=accounts', {
            method: 'POST',
            body
        });

        account = await decryptAccount(account);
        state.accounts.push(account);
        state.accountsTotalBalance += startingBalance || 0;
        renderAccounts();
        populateAccountDropdowns();
        showToast('Account created');
        return account;
    } catch (error) {
        console.error('Failed to create account:', error);
        showToast(error.message || 'Failed to create account');
        return null;
    }
}

async function updateAccount(id, data) {
    try {
        let body = { ...data };
        body = await encryptAccount(body);

        let account = await api(`api.php?resource=accounts&id=${id}`, {
            method: 'PUT',
            body
        });

        account = await decryptAccount(account);
        const index = state.accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            state.accounts[index] = account;
        }
        renderAccounts();
        populateAccountDropdowns();
        showToast('Account updated');
        return account;
    } catch (error) {
        console.error('Failed to update account:', error);
        showToast('Failed to update account');
        return null;
    }
}

let reassignSourceId = null;

// Prompt to move an account's transactions to another account, then delete it.
function openReassignModal(accountId) {
    const others = (state.accounts || []).filter(a => a.id !== accountId);
    if (!others.length) { showToast('You need another account to move transactions to'); return; }
    reassignSourceId = accountId;
    const source = getAccountById(accountId);
    document.getElementById('reassign-account-target').innerHTML = others
        .map((a, i) => `<option value="${a.id}"${i === 0 ? ' selected' : ''}>${escapeHtml(a.icon || '')} ${escapeHtml(a.name)}</option>`)
        .join('');
    const text = document.getElementById('reassign-account-text');
    if (text && source) {
        text.textContent = `"${source.name}" has transactions. Choose an account to move them to — it will then be deleted.`;
    }
    openModal(document.getElementById('reassign-account-modal'));
}

async function confirmReassignDelete() {
    const targetId = document.getElementById('reassign-account-target')?.value;
    if (!reassignSourceId || !targetId) return;
    try {
        await api(`api.php?resource=accounts&id=${reassignSourceId}&reassign_to=${targetId}`, { method: 'DELETE' });
        closeModal(document.getElementById('reassign-account-modal'));
        reassignSourceId = null;
        showToast('Account deleted; transactions moved');
        await loadAppData();
        renderAll();
        populateAccountDropdowns();
    } catch (error) {
        showToast(error.message || 'Failed to delete account');
    }
}

async function deleteAccount(id) {
    if ((state.accounts || []).length <= 1) {
        showToast('You need at least one account');
        return;
    }
    try {
        await api(`api.php?resource=accounts&id=${id}`, { method: 'DELETE' });
        const account = state.accounts.find(a => a.id === id);
        if (account) {
            state.accountsTotalBalance -= account.current_balance || 0;
        }
        state.accounts = state.accounts.filter(a => a.id !== id);
        renderAccounts();
        populateAccountDropdowns();
        showToast('Account deleted');
    } catch (error) {
        console.error('Failed to delete account:', error);
        const errorMsg = error.message || 'Failed to delete account';
        if (errorMsg.includes('linked transactions')) {
            openReassignModal(id); // offer to move the transactions, then delete
        } else {
            showToast(errorMsg);
        }
    }
}

// Account transfers
async function createAccountTransfer(fromAccountId, toAccountId, amount, description, date) {
    try {
        let body = {
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount,
            description,
            date
        };
        body = await encryptAccountTransfer(body);

        const transfer = await api('api.php?resource=account-transfers', {
            method: 'POST',
            body
        });

        // Update local account balances
        const fromAccount = state.accounts.find(a => a.id === fromAccountId);
        const toAccount = state.accounts.find(a => a.id === toAccountId);
        if (fromAccount) fromAccount.current_balance -= amount;
        if (toAccount) toAccount.current_balance += amount;

        renderAccounts();
        showToast('Transfer completed');
        return transfer;
    } catch (error) {
        console.error('Failed to create transfer:', error);
        showToast('Failed to create transfer');
        return null;
    }
}

async function deleteAccountTransfer(id) {
    try {
        await api(`api.php?resource=account-transfers&id=${id}`, { method: 'DELETE' });
        // Reload accounts to get updated balances
        await loadAccounts();
        showToast('Transfer deleted');
    } catch (error) {
        console.error('Failed to delete transfer:', error);
        showToast('Failed to delete transfer');
    }
}

// Module toggle functions
async function enableAccountsModule() {
    try {
        await api('api.php?resource=accounts', {
            method: 'PUT',
            body: { action: 'enable' }
        });
        state.accountsModuleEnabled = true;
        if (state.user) state.user.accounts_enabled = true;
        renderAccounts();
        showToast('Accounts module enabled');
    } catch (error) {
        console.error('Failed to enable accounts module:', error);
        showToast('Failed to enable accounts module');
    }
}

async function disableAccountsModule() {
    try {
        await api('api.php?resource=accounts', {
            method: 'PUT',
            body: { action: 'disable' }
        });
        state.accountsModuleEnabled = false;
        if (state.user) state.user.accounts_enabled = false;
        renderAccounts();
        showToast('Accounts module disabled');
    } catch (error) {
        console.error('Failed to disable accounts module:', error);
        showToast('Failed to disable accounts module');
    }
}

// Render functions
function renderAccounts() {
    const container = elements.accountsList;
    const emptyState = elements.noAccounts;
    const disabledState = elements.accountsDisabled;
    const contentState = elements.accountsContent;

    if (!container) return;

    // Check if module is enabled
    if (!state.accountsModuleEnabled) {
        if (disabledState) disabledState.style.display = 'block';
        if (contentState) contentState.style.display = 'none';
        if (elements.addAccountBtn) elements.addAccountBtn.style.display = 'none';
        if (elements.transferBtn) elements.transferBtn.style.display = 'none';
        return;
    }

    // Module is enabled - show buttons
    if (disabledState) disabledState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';
    if (elements.addAccountBtn) elements.addAccountBtn.style.display = 'inline-flex';
    if (elements.transferBtn) elements.transferBtn.style.display = state.accounts.length >= 2 ? 'inline-flex' : 'none';

    const accounts = state.accounts || [];

    // Update total balance
    if (elements.accountsTotalBalance) {
        elements.accountsTotalBalance.textContent = formatCurrency(state.accountsTotalBalance);
    }

    if (accounts.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            container.appendChild(emptyState);
            emptyState.style.display = 'flex';
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    accounts.forEach(account => {
        const card = renderAccountCard(account);
        container.appendChild(card);
    });
}

function renderAccountCard(account) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.accountId = account.id;

    const balance = account.current_balance || 0;
    const isNegative = balance < 0;
    const balanceClass = isNegative ? 'negative' : (balance > 0 ? 'positive' : '');

    card.innerHTML = `
        <div class="account-icon">${escapeHtml(account.icon || getAccountTypeDefaultIcon(account.type))}</div>
        <div class="account-info">
            <div class="account-name">${escapeHtml(account.name)}</div>
            <div class="account-type">${getAccountTypeLabel(account.type)}</div>
        </div>
        <div class="account-balance">
            <div class="account-balance-amount ${balanceClass}">${formatCurrency(balance)}</div>
        </div>
    `;

    // Click to edit
    card.addEventListener('click', () => openAccountModal(account.id));

    return card;
}

function populateAccountDropdowns() {
    // Populate transaction account dropdown
    if (elements.transactionAccount) {
        const currentValue = elements.transactionAccount.value;
        elements.transactionAccount.innerHTML = '';

        state.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.icon} ${account.name}`;
            elements.transactionAccount.appendChild(option);
        });

        // Ledger model: always an account — restore the selection or default to the first.
        if (currentValue && state.accounts.some(a => a.id == currentValue)) {
            elements.transactionAccount.value = currentValue;
        } else if (state.accounts.length) {
            elements.transactionAccount.value = state.accounts[0].id;
        }
    }

    // Populate transfer dropdowns
    if (elements.transferFrom) {
        const currentValue = elements.transferFrom.value;
        elements.transferFrom.innerHTML = '<option value="">Select account</option>';
        state.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.icon} ${account.name} (${formatCurrency(account.current_balance || 0)})`;
            elements.transferFrom.appendChild(option);
        });
        if (currentValue) elements.transferFrom.value = currentValue;
    }

    if (elements.transferTo) {
        const currentValue = elements.transferTo.value;
        elements.transferTo.innerHTML = '<option value="">Select account</option>';
        state.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.icon} ${account.name}`;
            elements.transferTo.appendChild(option);
        });
        if (currentValue) elements.transferTo.value = currentValue;
    }

    // Show/hide account dropdown in transaction modal based on module status
    if (elements.transactionAccountGroup) {
        elements.transactionAccountGroup.style.display = state.accountsModuleEnabled ? 'block' : 'none';
    }
}

// ========================================
// Accounts Modals
// ========================================

let currentEditingAccount = null;

function openAccountModal(accountId = null) {
    currentEditingAccount = accountId ? getAccountById(accountId) : null;

    elements.accountModalTitle.textContent = currentEditingAccount ? 'Edit Account' : 'Add Account';
    elements.accountSubmitBtn.textContent = currentEditingAccount ? 'Save Changes' : 'Add Account';

    // Delete is only offered when editing an existing account.
    const accountDeleteBtn = document.getElementById('account-delete-btn');
    if (accountDeleteBtn) accountDeleteBtn.style.display = currentEditingAccount ? '' : 'none';

    if (currentEditingAccount) {
        elements.accountEditId.value = currentEditingAccount.id;
        elements.accountName.value = currentEditingAccount.name;
        elements.accountType.value = currentEditingAccount.type;
        elements.accountIcon.value = currentEditingAccount.icon || getAccountTypeDefaultIcon(currentEditingAccount.type);
        elements.accountEmojiPreview.textContent = currentEditingAccount.icon || getAccountTypeDefaultIcon(currentEditingAccount.type);
        // Hide starting balance when editing
        if (elements.accountBalanceGroup) {
            elements.accountBalanceGroup.style.display = 'none';
        }
    } else {
        elements.accountEditId.value = '';
        elements.accountName.value = '';
        elements.accountType.value = 'bank';
        elements.accountIcon.value = '🏦';
        elements.accountEmojiPreview.textContent = '🏦';
        elements.accountStartingBalance.value = '';
        // Show starting balance when creating
        if (elements.accountBalanceGroup) {
            elements.accountBalanceGroup.style.display = 'block';
        }
    }

    openModal(elements.accountModal);
}

function openTransferModal() {
    if (state.accounts.length < 2) {
        showToast('You need at least 2 accounts to transfer');
        return;
    }

    elements.transferForm.reset();
    elements.transferDate.value = new Date().toISOString().split('T')[0];
    populateAccountDropdowns();
    openModal(elements.transferModal);
}

function setupAccountModals() {
    // Add account button
    elements.addAccountBtn?.addEventListener('click', () => openAccountModal());

    // Enable accounts button
    elements.enableAccountsBtn?.addEventListener('click', async () => {
        await enableAccountsModule();
    });

    // Transfer button
    elements.transferBtn?.addEventListener('click', () => openTransferModal());

    // Account form submit
    elements.accountForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = elements.accountName.value.trim();
        const type = elements.accountType.value;
        const icon = elements.accountIcon.value;

        if (!name) {
            showToast('Please enter an account name');
            return;
        }

        if (currentEditingAccount) {
            await updateAccount(currentEditingAccount.id, { name, type, icon });
        } else {
            const startingBalance = parseFloat(elements.accountStartingBalance.value) || 0;
            await createAccount(name, type, icon, startingBalance);
        }

        closeModal(elements.accountModal);
    });

    // Account emoji picker
    elements.accountEmojiPicker?.querySelectorAll('.emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            elements.accountIcon.value = emoji;
            elements.accountEmojiPreview.textContent = emoji;
        });
    });

    // Account type change updates default icon
    elements.accountType?.addEventListener('change', () => {
        if (!currentEditingAccount) {
            const defaultIcon = getAccountTypeDefaultIcon(elements.accountType.value);
            elements.accountIcon.value = defaultIcon;
            elements.accountEmojiPreview.textContent = defaultIcon;
        }
    });

    // Transfer form submit
    elements.transferForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fromId = parseInt(elements.transferFrom.value);
        const toId = parseInt(elements.transferTo.value);
        const amount = parseFloat(elements.transferAmount.value);
        const date = elements.transferDate.value;
        const description = elements.transferDescription.value.trim();

        if (!fromId || !toId) {
            showToast('Please select both accounts');
            return;
        }

        if (fromId === toId) {
            showToast('Cannot transfer to the same account');
            return;
        }

        if (!amount || amount <= 0) {
            showToast('Please enter a valid amount');
            return;
        }

        await createAccountTransfer(fromId, toId, amount, description, date);
        closeModal(elements.transferModal);
    });

    // Account card delete via long press or context menu (future enhancement)
    // For now, add a delete button in the modal
    const deleteBtn = elements.accountModal?.querySelector('.btn-danger');
    deleteBtn?.addEventListener('click', async () => {
        if (!currentEditingAccount) return;
        const confirmed = await showConfirm(
            'If this account has transactions, you will choose another account to move them to.',
            `Delete "${currentEditingAccount.name}"?`
        );
        if (confirmed) {
            closeModal(elements.accountModal);
            await deleteAccount(currentEditingAccount.id);
        }
    });

    // Confirm moving transactions to another account, then deleting.
    document.getElementById('reassign-account-confirm')?.addEventListener('click', confirmReassignDelete);

    // Back button for accounts section
    elements.accountsBackBtn?.addEventListener('click', () => {
        hideAllMenuSections();
        elements.dashboardContent.style.display = 'block';
    });
}

// ========================================
// PWA Install Prompt
// ========================================

let deferredInstallPrompt = null;

function setupInstallPrompt() {
    const installBanner = document.getElementById('install-banner');
    const iosInstallBanner = document.getElementById('ios-install-banner');
    const installAccept = document.getElementById('install-accept');
    const installDismiss = document.getElementById('install-dismiss');
    const iosInstallClose = document.getElementById('ios-install-close');
    const appVersion = document.getElementById('app-version');

    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');

    // Helper to check if we should auto-show the banner
    function shouldAutoShow() {
        if (isStandalone) return false;
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        if (dismissedTime) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) return false;
        }
        return true;
    }

    // Debug: tap version 3 times to show install debug info
    let versionTaps = 0;
    let versionTapTimer = null;
    appVersion?.addEventListener('click', () => {
        versionTaps++;
        clearTimeout(versionTapTimer);
        versionTapTimer = setTimeout(() => { versionTaps = 0; }, 1000);

        if (versionTaps >= 3) {
            versionTaps = 0;
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            const hasPrompt = !!deferredInstallPrompt;

            const info = `Install Debug:
• Standalone: ${isStandalone}
• Dismissed: ${dismissed ? new Date(parseInt(dismissed)).toLocaleDateString() : 'never'}
• Has prompt event: ${hasPrompt}
• User agent: ${navigator.userAgent.substring(0, 50)}...`;

            if (confirm(info + '\n\nClear dismissed & reload?')) {
                localStorage.removeItem('pwa-install-dismissed');
                location.reload();
            }
        }
    });

    // If already installed, no need for any install prompts
    if (isStandalone) {
        return;
    }

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
        // iOS: show instructions if not dismissed
        if (shouldAutoShow() && iosInstallBanner) {
            setTimeout(() => {
                iosInstallBanner.classList.add('visible');
            }, 3000);
        }

        iosInstallClose?.addEventListener('click', () => {
            iosInstallBanner.classList.remove('visible');
            localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        });
        return;
    }

    // Standard beforeinstallprompt for Chrome/Edge/etc
    // ALWAYS set up the listener to capture the event
    let promptReceived = false;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        promptReceived = true;

        // Only auto-show on mobile, not desktop
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (shouldAutoShow() && isMobileDevice) {
            setTimeout(() => {
                if (installBanner) {
                    installBanner.classList.add('visible');
                }
            }, 2000);
        }
    });

    // Fallback: if no prompt event after 5 seconds, show banner with manual instructions (mobile only)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (shouldAutoShow() && isMobile) {
        setTimeout(() => {
            if (!promptReceived && installBanner && !installBanner.classList.contains('visible')) {
                // Update banner text for manual install
                const bannerText = installBanner.querySelector('.install-banner-text span');
                if (bannerText) {
                    bannerText.textContent = 'Use menu ⋮ → "Add to Home screen"';
                }
                if (installAccept) {
                    installAccept.textContent = 'Got it';
                }
                installBanner.classList.add('visible');
            }
        }, 5000);
    }

    // ALWAYS set up button handlers
    installAccept?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
            // No prompt event - just close the banner (instructions already shown)
            installBanner?.classList.remove('visible');
            localStorage.setItem('pwa-install-dismissed', Date.now().toString());
            return;
        }

        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;

        if (outcome === 'accepted') {
            showToast('App installed successfully!');
        }

        deferredInstallPrompt = null;
        installBanner?.classList.remove('visible');
    });

    installDismiss?.addEventListener('click', () => {
        installBanner?.classList.remove('visible');
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
        installBanner?.classList.remove('visible');
        iosInstallBanner?.classList.remove('visible');
        deferredInstallPrompt = null;
        showToast('App installed successfully!');
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

        // Account badge (only show if accounts enabled and transaction has account)
        const accountBadge = state.accountsModuleEnabled && transaction.account_id && transaction.account_name
            ? `<span class="transaction-account-badge">${escapeHtml(transaction.account_icon || '💰')} ${escapeHtml(transaction.account_name)}</span>`
            : '';

        const html = `
            <div class="transaction-item" data-id="${transaction.id}" onclick="openEditTransactionModal(${transaction.id})">
                <div class="transaction-content">
                    <div class="transaction-icon ${transaction.type}" style="background: ${isIncome ? 'var(--color-success-light)' : catColor + '20'}">
                        ${catIcon}
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-description">${escapeHtml(transaction.description)}</div>
                        <div class="transaction-meta">${escapeHtml(catName)} • ${formatDate(transaction.date)}${accountBadge ? ' ' + accountBadge : ''}${transaction.needs_review == 1 ? ' <span class="import-badge">review</span>' : ''}</div>
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
    const totalSaved = state.savingsSummary?.total_saved || 0;
    const availableToSpend = balance - totalSaved;
    const showSavingsApplied = elements.balanceToggle?.checked ?? true;
    const hasBuckets = state.savingsBuckets && state.savingsBuckets.length > 0;

    // Determine which value to show
    const displayValue = showSavingsApplied ? availableToSpend : balance;

    if (elements.totalBalance) {
        elements.totalBalance.textContent = formatCurrency(displayValue);
        elements.totalBalance.style.color = displayValue >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    }

    // Update label based on toggle
    if (elements.balanceLabel) {
        elements.balanceLabel.textContent = 'Net Balance';
    }
    if (elements.toggleLabel) {
        elements.toggleLabel.textContent = showSavingsApplied ? 'Savings applied' : 'Savings ignored';
    }

    // Update savings breakdown
    if (elements.totalSaved) {
        elements.totalSaved.textContent = formatCurrency(totalSaved);
    }

    // Show/hide savings detail based on whether user has buckets
    if (elements.savingsDetail) {
        elements.savingsDetail.style.display = hasBuckets ? 'flex' : 'none';
    }

    // Update income/expenses
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
                <span class="legend-label">${escapeHtml(icons[index])} ${escapeHtml(item.name)}</span>
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
            <tr onclick="openCategoryDrilldown(${cat.id})" style="cursor: pointer;">
                <td>
                    <div class="category-cell">
                        <span class="category-color" style="background: ${cat.color}"></span>
                        <span class="category-icon">${escapeHtml(cat.icon)}</span>
                        ${escapeHtml(cat.name)}
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
    renderSavingsBuckets();
    updateSavingsSummary();
    renderAccounts();
    populateAccountDropdowns();
    updateCurrencyPrefixes();
    updateVerificationBanner();
}

// ========================================
// Email Verification Banner
// ========================================

function updateVerificationBanner() {
    const banner = document.getElementById('verification-banner');
    if (!banner) return;

    if (!state.user) {
        banner.style.display = 'none';
        return;
    }

    // Show banner if email not verified and still in grace period
    if (!state.user.email_verified && state.user.verification_grace_days >= 0) {
        banner.style.display = 'flex';
        const daysLeft = state.user.verification_grace_days;
        const message = banner.querySelector('.verification-message');
        if (message) {
            if (daysLeft === 7) {
                // Just signed up
                message.textContent = "We've sent you a verification email. Please check your inbox.";
            } else if (daysLeft > 0) {
                message.textContent = `Please verify your email address. ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`;
            } else {
                message.textContent = 'Please verify your email address to continue using the app.';
            }
        }
    } else {
        banner.style.display = 'none';
    }
}

async function resendVerificationEmail() {
    try {
        const btn = document.getElementById('resend-verification-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending...';
        }

        const data = await api('auth.php?action=resend-verification', {
            method: 'POST'
        });

        if (data.success) {
            showToast('Verification email sent! Check your inbox.', 'success');
        }

        if (btn) {
            btn.textContent = 'Email Sent';
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = 'Resend';
            }, 30000); // Allow resend after 30 seconds
        }
    } catch (error) {
        showToast(error.message || 'Failed to send verification email', 'error');
        const btn = document.getElementById('resend-verification-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Resend';
        }
    }
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

        // Re-render the categories section if it's visible
        if (elements.categoriesMenuSection?.style.display !== 'none') {
            renderCategoriesInSection();
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

        // Show savings bucket dropdown (expense is default) and populate it
        if (elements.savingsBucketGroup) {
            elements.savingsBucketGroup.style.display = 'block';
        }
        populateBucketDropdown();
        if (elements.transactionBucket) {
            elements.transactionBucket.value = '';
        }

        // Populate account dropdown — defaults to the user's first account.
        populateAccountDropdowns();

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
        const savingsBucketId = elements.transactionBucket?.value ? parseInt(elements.transactionBucket.value) : null;
        const accountId = elements.transactionAccount?.value ? parseInt(elements.transactionAccount.value) : null;

        if (!categoryId) {
            showToast('Please select a category');
            return;
        }

        if (editingTransactionId) {
            await updateTransaction(editingTransactionId, description, parseFloat(amount), parseInt(categoryId), type, date, savingsBucketId, accountId);
        } else if (isRecurring) {
            // Create recurring transaction instead
            const frequency = document.getElementById('transaction-frequency').value;
            const endDate = document.getElementById('transaction-end-date').value || null;
            await createRecurringTransaction(description, parseFloat(amount), parseInt(categoryId), type, frequency, date, endDate);
        } else {
            await createTransaction(description, parseFloat(amount), parseInt(categoryId), type, date, savingsBucketId, accountId);
        }

        editingTransactionId = null;
        closeModal(elements.transactionModal);
    });
    
    // Navigation Drawer
    setupNavigationDrawer();

    // Currency selector in settings section
    elements.settingsCurrency?.addEventListener('change', async (e) => {
        const currency = e.target.value;
        await updateUserCurrency(currency);
        showToast('Currency updated');
    });

    // Change Password button in Settings section
    elements.changePasswordBtn?.addEventListener('click', () => {
        elements.changePasswordForm.reset();
        // Reset strength meter visibility
        const meter = elements.changePasswordModal.querySelector('.password-strength');
        if (meter) meter.style.display = 'none';
        openModal(elements.changePasswordModal);
    });

    // Check for Updates button
    document.getElementById('check-updates-btn')?.addEventListener('click', async () => {
        showToast('Checking for updates...');
        try {
            // Unregister service worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }

            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }

            // Reload the page
            showToast('Update complete. Reloading...');
            setTimeout(() => {
                window.location.reload(true);
            }, 1000);
        } catch (error) {
            console.error('Update check failed:', error);
            showToast('Update failed. Try refreshing manually.');
        }
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
            // Change login password on server
            const data = await api('auth.php?action=change-password', {
                method: 'POST',
                body: { current_password: currentPassword, new_password: newPassword }
            });

            if (data.success) {
                // If encryption is enabled, re-wrap MEK with new password
                if (state.user?.encryption_enabled && CryptoModule?.isReady()) {
                    try {
                        const newKeyData = await CryptoModule.changePassword(newPassword);
                        await api('auth.php?action=update-encryption-key', {
                            method: 'POST',
                            body: {
                                encryption_salt: newKeyData.salt,
                                encrypted_mek: newKeyData.wrappedMEK
                            }
                        });
                        // Update local settings
                        if (state.encryptionSettings) {
                            state.encryptionSettings.encryption_salt = newKeyData.salt;
                            state.encryptionSettings.encrypted_mek = newKeyData.wrappedMEK;
                        }
                    } catch (encError) {
                        console.error('Failed to update encryption key:', encError);
                        showToast('Password changed, but encryption key update failed');
                        closeModal(elements.changePasswordModal);
                        e.target.reset();
                        return;
                    }
                }
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

    // Recurring transaction toggle in transaction modal
    elements.transactionRecurring?.addEventListener('change', (e) => {
        if (elements.recurringOptions) {
            elements.recurringOptions.style.display = e.target.checked ? 'block' : 'none';
        }
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

        // Re-render the recurring section if it's visible
        if (elements.recurringMenuSection?.style.display !== 'none') {
            renderRecurringInSection();
        }

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
    const verifyToken = urlParams.get('verify');

    if (resetToken) {
        document.getElementById('reset-token').value = resetToken;
        showAuthForm('reset');

        // Check if user has encryption enabled
        checkResetTokenEncryption(resetToken);
    }

    // Handle email verification token
    if (verifyToken) {
        handleEmailVerification(verifyToken);
    }
}

// Handle email verification from URL
async function handleEmailVerification(token) {
    try {
        showToast('Verifying your email...', 'info');
        const data = await api(`auth.php?action=verify-email&token=${encodeURIComponent(token)}`);

        if (data.success) {
            // Update user state if logged in
            if (state.user) {
                state.user.email_verified = true;
                state.user.verification_grace_days = 0;
                updateVerificationBanner();
            }

            // Show success modal
            showVerificationSuccessModal();
        }

        // Clear the verify token from URL
        const url = new URL(window.location);
        url.searchParams.delete('verify');
        window.history.replaceState({}, document.title, url.pathname);

    } catch (error) {
        showToast(error.message || 'Failed to verify email', 'error');
    }
}

// Show email verification success modal
function showVerificationSuccessModal() {
    const modal = document.getElementById('verification-success-modal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Close button handler
    const closeBtn = document.getElementById('verification-success-close');
    const backdrop = modal.querySelector('.modal-backdrop');

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeModal, { once: true });
    backdrop?.addEventListener('click', closeModal, { once: true });
}

// Check if user associated with reset token has encryption enabled
async function checkResetTokenEncryption(token) {
    try {
        const data = await api(`auth.php?action=get-encryption-by-token&token=${encodeURIComponent(token)}`);

        const recoverySection = document.getElementById('reset-recovery-section');
        const encryptionEnabledInput = document.getElementById('reset-encryption-enabled');
        const recoveryPhraseInput = document.getElementById('reset-recovery-phrase');

        if (data.encryption_enabled) {
            // Store encryption data for later use
            window._resetEncryptionData = {
                recovery_salt: data.recovery_salt,
                recovery_encrypted_mek: data.recovery_encrypted_mek
            };

            // Show recovery section
            if (recoverySection) {
                recoverySection.style.display = 'block';
                recoveryPhraseInput.required = true;
            }
            if (encryptionEnabledInput) {
                encryptionEnabledInput.value = 'true';
            }
        } else {
            // Hide recovery section
            if (recoverySection) {
                recoverySection.style.display = 'none';
                recoveryPhraseInput.required = false;
            }
            if (encryptionEnabledInput) {
                encryptionEnabledInput.value = 'false';
            }
            window._resetEncryptionData = null;
        }
    } catch (error) {
        console.error('Failed to check encryption status:', error);
        // On error, hide recovery section
        const recoverySection = document.getElementById('reset-recovery-section');
        if (recoverySection) {
            recoverySection.style.display = 'none';
        }
    }
}

// ========================================
// Service Worker Registration
// ========================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
        } catch (error) {
        }
    }
}

// ========================================
// Encryption Event Handlers
// ========================================

function setupEncryptionHandlers() {
    // Data Encryption button in settings section - opens encryption settings modal
    elements.dataEncryptionBtn?.addEventListener('click', () => {
        updateEncryptionSettingsModal();
        openModal(elements.encryptionSettingsModal);
    });

    // Enable encryption button
    elements.enableEncryptionBtn?.addEventListener('click', () => {
        closeModal(elements.encryptionSettingsModal);
        openModal(elements.encryptionSetupModal);
    });

    // Disable encryption button
    elements.disableEncryptionBtn?.addEventListener('click', async () => {
        const confirmed = await showConfirm(
            'Your data will remain encrypted until you manually update each item.',
            'Disable encryption?',
            'Disable'
        );
        if (!confirmed) return;
        closeModal(elements.encryptionSettingsModal);
        await disableEncryption();
    });

    // Encryption setup form
    elements.encryptionSetupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('encryption-setup-password').value;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            // Verify the login password with the server first
            await api('auth.php?action=verify-password', {
                method: 'POST',
                body: { password }
            });

            // Password verified, now enable encryption with it
            const result = await enableEncryption(password);
            if (result.success) {
                closeModal(elements.encryptionSetupModal);
                // Show recovery phrase
                displayRecoveryPhrase(result.recoveryPhrase);
                openModal(elements.recoveryPhraseModal);
            } else {
                showToast(result.error || 'Failed to enable encryption');
            }
        } catch (error) {
            showToast(error.message || 'Incorrect password');
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

        const confirmed = await showConfirm(
            'Your old recovery phrase will no longer work.',
            'Generate new recovery phrase?',
            'Generate'
        );
        if (!confirmed) return;

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

    // New password form (after recovery) - changes both login and encryption password
    document.getElementById('encryption-new-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('recovery-current-password').value;
        const newPassword = document.getElementById('new-encryption-password').value;
        const confirmPassword = document.getElementById('new-encryption-password-confirm').value;

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
            // First change login password on server
            await api('auth.php?action=change-password', {
                method: 'POST',
                body: { current_password: currentPassword, new_password: newPassword }
            });

            // Re-wrap MEK with new password
            const newKeyData = await CryptoModule.changePassword(newPassword);

            // Update encryption key on server
            await api('auth.php?action=update-encryption-key', {
                method: 'POST',
                body: {
                    encryption_salt: newKeyData.salt,
                    encrypted_mek: newKeyData.wrappedMEK
                }
            });

            // Update local settings
            if (state.encryptionSettings) {
                state.encryptionSettings.encryption_salt = newKeyData.salt;
                state.encryptionSettings.encrypted_mek = newKeyData.wrappedMEK;
            }

            closeModal(document.getElementById('encryption-new-password-modal'));
            showToast('Password updated successfully');

            // Clear form
            e.target.reset();
        } catch (error) {
            console.error('Failed to set new password:', error);
            showToast(error.message || 'Failed to set new password');
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
// Custom Date Range State
// ========================================

let customDateRange = {
    startDate: null,
    endDate: null
};

// ========================================
// Custom Date Range Functions
// ========================================

function showCustomDateRange(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = 'flex';
        // Set default dates if not already set
        const startInput = container.querySelector('input[type="date"]:first-of-type');
        const endInput = container.querySelector('input[type="date"]:last-of-type');
        if (startInput && !startInput.value) {
            const start = new Date();
            start.setMonth(start.getMonth() - 1);
            startInput.value = start.toISOString().split('T')[0];
        }
        if (endInput && !endInput.value) {
            endInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function hideCustomDateRange(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = 'none';
    }
}

async function applyCustomRange(startDate, endDate) {
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates');
        return;
    }
    if (startDate > endDate) {
        showToast('Start date must be before end date');
        return;
    }
    customDateRange = { startDate, endDate };

    try {
        const summary = await api(`api.php?resource=summary&period=custom&start_date=${startDate}&end_date=${endDate}`);
        state.summary = summary;
        if (state.summary?.categories && CryptoModule?.isReady()) {
            state.summary.categories = await decryptCategories(state.summary.categories);
        }
        updateBalances();
        renderChart();
    } catch (error) {
        showToast('Failed to load custom range data');
    }
}

// ========================================
// Category Drill-Down Functions
// ========================================

async function openCategoryDrilldown(categoryId, period = null) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    const spendingPeriod = period || elements.spendingPeriodSelector?.value || 'this-month';

    // Build query params
    let queryParams = `category_id=${categoryId}&limit=500`;

    if (spendingPeriod === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        queryParams += `&start_date=${customDateRange.startDate}&end_date=${customDateRange.endDate}`;
    } else {
        const { start, end } = getDateRangeForPeriod(spendingPeriod);
        if (start && end) {
            queryParams += `&start_date=${start.toISOString().split('T')[0]}&end_date=${end.toISOString().split('T')[0]}`;
        }
    }

    try {
        let transactions = await api(`api.php?resource=transactions&${queryParams}`);
        transactions = await decryptTransactions(Array.isArray(transactions) ? transactions : []);

        renderCategoryDrilldown(category, transactions, spendingPeriod);

        // Close spending modal if open
        closeModal(elements.spendingModal);
        openModal(document.getElementById('category-transactions-modal'));
    } catch (error) {
        console.error('Failed to load category transactions:', error);
        showToast('Failed to load transactions');
    }
}

function renderCategoryDrilldown(category, transactions, period) {
    const titleEl = document.getElementById('category-modal-title');
    const summaryEl = document.getElementById('category-summary');
    const listEl = document.getElementById('category-transactions-list');
    const emptyEl = document.getElementById('category-transactions-empty');

    if (titleEl) {
        titleEl.textContent = `${category.icon} ${category.name}`;
    }

    // Calculate total spent
    const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const budget = category.monthly_budget || 0;

    // Get period label
    let periodLabel = period;
    if (period === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        const start = new Date(customDateRange.startDate);
        const end = new Date(customDateRange.endDate);
        periodLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
        periodLabel = period.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Render summary header
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="category-summary-icon" style="background: ${category.color}20; color: ${category.color}">
                ${category.icon}
            </div>
            <div class="category-summary-info">
                <div class="category-summary-name">${escapeHtml(category.name)}</div>
                <div class="category-summary-period">${periodLabel}</div>
            </div>
            <div class="category-summary-amount">
                <div class="category-summary-spent">${formatCurrency(totalSpent)}</div>
                ${budget > 0 ? `<div class="category-summary-budget">of ${formatCurrency(budget)} budget</div>` : ''}
            </div>
        `;
    }

    // Render transactions list
    if (listEl) {
        if (transactions.length === 0) {
            listEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
        } else {
            listEl.style.display = 'flex';
            if (emptyEl) emptyEl.style.display = 'none';

            listEl.innerHTML = transactions.map(transaction => {
                const isIncome = transaction.type === 'income';
                return `
                    <div class="transaction-item" data-id="${transaction.id}" onclick="openEditTransactionModal(${transaction.id})">
                        <div class="transaction-content">
                            <div class="transaction-icon ${transaction.type}" style="background: ${isIncome ? 'var(--color-success-light)' : category.color + '20'}">
                                ${escapeHtml(category.icon)}
                            </div>
                            <div class="transaction-info">
                                <div class="transaction-description">${escapeHtml(transaction.description)}</div>
                                <div class="transaction-meta">${formatDate(transaction.date)}</div>
                            </div>
                            <div class="transaction-amount ${transaction.type}">
                                ${isIncome ? '+' : '-'}${formatCurrency(transaction.amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ========================================
// Budget vs Actual Comparison
// ========================================

async function loadBudgetComparison(period = 'this-month') {
    let url = `api.php?resource=budget-comparison&period=${period}`;

    if (period === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        url += `&start_date=${customDateRange.startDate}&end_date=${customDateRange.endDate}`;
    }

    try {
        const data = await api(url);
        let categories = data.categories || [];

        // Decrypt if needed
        if (CryptoModule?.isReady()) {
            categories = await decryptCategories(categories);
        }

        renderBudgetComparison(categories);
    } catch (error) {
        console.error('Failed to load budget comparison:', error);
        showToast('Failed to load comparison data');
    }
}

function renderBudgetComparison(categories) {
    const container = document.getElementById('comparison-list');
    if (!container) return;

    if (categories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: var(--space-xl);">No expense categories found</p>';
        return;
    }

    // Filter to only show categories with budget > 0 or spending > 0
    const relevantCategories = categories.filter(c => c.budget > 0 || c.spent > 0);

    if (relevantCategories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: var(--space-xl);">No budgets or spending to compare</p>';
        return;
    }

    // Find max value for scaling
    const maxValue = Math.max(...relevantCategories.map(c => Math.max(c.budget, c.spent)));

    container.innerHTML = relevantCategories.map(cat => {
        const budgetWidth = maxValue > 0 ? (cat.budget / maxValue) * 100 : 0;
        const spentWidth = maxValue > 0 ? (cat.spent / maxValue) * 100 : 0;

        let statusClass = 'under';
        if (cat.budget > 0 && cat.percentage >= 100) {
            statusClass = 'over';
        } else if (cat.budget > 0 && cat.percentage >= 80) {
            statusClass = 'near';
        }

        const percentDisplay = cat.budget > 0 ? `${Math.round(cat.percentage)}%` : '—';

        return `
            <div class="comparison-row" onclick="openCategoryDrilldown(${cat.id})">
                <div class="comparison-category">
                    <div class="comparison-icon" style="background: ${cat.color}20">
                        ${cat.icon}
                    </div>
                    <span class="comparison-name">${escapeHtml(cat.name)}</span>
                </div>
                <div class="comparison-bar-container">
                    ${cat.budget > 0 ? `<div class="comparison-budget-bar" style="width: ${budgetWidth}%"></div>` : ''}
                    <div class="comparison-actual-bar ${statusClass}" style="width: ${spentWidth}%"></div>
                </div>
                <div class="comparison-values">
                    <span class="comparison-spent">${formatCurrency(cat.spent)}</span>
                    <span class="comparison-budget">${cat.budget > 0 ? 'of ' + formatCurrency(cat.budget) : 'no budget'}</span>
                </div>
                <span class="comparison-percent ${statusClass}">${percentDisplay}</span>
            </div>
        `;
    }).join('');
}

// ========================================
// Spending Trends Functions
// ========================================

async function loadTrends(months = 12) {
    try {
        const data = await api(`api.php?resource=trends&months=${months}`);
        renderTrendsChart(data.data || []);
    } catch (error) {
        console.error('Failed to load trends:', error);
        showToast('Failed to load trends data');
    }
}

function renderTrendsChart(data) {
    const canvas = document.getElementById('trends-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth - 32; // Account for padding
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#a8a9b8';
        ctx.font = '14px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }

    // Chart dimensions
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate max value for scaling
    const maxValue = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
    const roundedMax = Math.ceil(maxValue / 1000) * 1000;

    // Colors
    const incomeColor = getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || '#5ce5a5';
    const expenseColor = getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() || '#ff7a8a';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#a8a9b8';
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.12)';

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Y-axis labels
        const value = roundedMax - (roundedMax / gridLines) * i;
        ctx.fillStyle = textColor;
        ctx.font = '11px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatCompactCurrency(value), padding.left - 8, y + 4);
    }

    // Bar dimensions
    const groupWidth = chartWidth / data.length;
    const barWidth = Math.min(groupWidth * 0.35, 24);
    const barGap = 4;

    // Draw bars
    data.forEach((item, index) => {
        const x = padding.left + groupWidth * index + groupWidth / 2;

        // Income bar
        const incomeHeight = (item.income / roundedMax) * chartHeight;
        ctx.fillStyle = incomeColor;
        ctx.beginPath();
        ctx.roundRect(x - barWidth - barGap/2, padding.top + chartHeight - incomeHeight, barWidth, incomeHeight, 3);
        ctx.fill();

        // Expense bar
        const expenseHeight = (item.expense / roundedMax) * chartHeight;
        ctx.fillStyle = expenseColor;
        ctx.beginPath();
        ctx.roundRect(x + barGap/2, padding.top + chartHeight - expenseHeight, barWidth, expenseHeight, 3);
        ctx.fill();

        // X-axis label
        ctx.fillStyle = textColor;
        ctx.font = '10px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const labelParts = item.label.split(' ');
        ctx.fillText(labelParts[0], x, height - padding.bottom + 16);
        if (labelParts[1]) {
            ctx.fillText(labelParts[1], x, height - padding.bottom + 28);
        }
    });

    // Draw legend
    const legendY = 10;
    const legendX = width - padding.right;

    ctx.fillStyle = incomeColor;
    ctx.beginPath();
    ctx.roundRect(legendX - 100, legendY, 12, 12, 2);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = '11px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Income', legendX - 84, legendY + 10);

    ctx.fillStyle = expenseColor;
    ctx.beginPath();
    ctx.roundRect(legendX - 40, legendY, 12, 12, 2);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText('Expense', legendX - 24, legendY + 10);
}

function formatCompactCurrency(value) {
    const currency = state.user?.currency || 'ZAR';
    const config = CURRENCIES[currency] || CURRENCIES.ZAR;

    if (value >= 1000000) {
        return config.symbol + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
        return config.symbol + (value / 1000).toFixed(0) + 'K';
    }
    return config.symbol + value.toFixed(0);
}

// ========================================
// Initialize App
// ========================================

async function init() {
    showScreen('loading');

    // Initialize crypto module
    if (window.CryptoModule) {
        CryptoModule.init();
    } else {
        console.warn('CryptoModule not available');
    }

    try {
        // Check if already authenticated
        const isAuthenticated = await checkAuthStatus();

        if (isAuthenticated) {
            // Check encryption status
            if (state.user?.encryption_enabled) {
                await loadEncryptionSettings();

                let unlocked = false;

                // Try session storage first (survives soft refresh)
                if (CryptoModule?.hasSessionKey()) {
                    unlocked = await CryptoModule.unlockFromSession();
                }

                // Try remembered key from localStorage
                if (!unlocked && CryptoModule?.hasRememberedKey()) {
                    unlocked = await CryptoModule.unlockWithRememberedKey();
                    if (unlocked) {
                        // Also save to session for future soft refreshes
                        await CryptoModule.saveToSession();
                    }
                }

                if (unlocked) {
                    await loadAppData();
                    showAppScreen();
                } else {
                    // No stored key - redirect to login so user can enter password
                    await api('auth.php?action=logout', { method: 'POST' });
                    resetState();
                    showScreen('auth');
                    showAuthForm('login');
                    showToast('Please login to unlock your encrypted data');
                }
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
    setupBucketModals();
    setupAccountModals();
    setupBalanceCard();
    setupInstallPrompt();
    setupImport();

    // Chart period selector change handler
    elements.chartPeriodSelector?.addEventListener('change', async () => {
        const period = elements.chartPeriodSelector.value;
        if (period === 'custom') {
            // For chart, use the same custom date range as the balance card
            if (customDateRange.startDate && customDateRange.endDate) {
                try {
                    const summary = await api(`api.php?resource=summary&period=custom&start_date=${customDateRange.startDate}&end_date=${customDateRange.endDate}`);
                    state.chartSummary = summary;
                    if (state.chartSummary?.categories && CryptoModule?.isReady()) {
                        state.chartSummary.categories = await decryptCategories(state.chartSummary.categories);
                    }
                    renderChart();
                } catch (error) {
                    showToast('Failed to load chart data');
                }
            } else {
                showToast('Please set a custom date range first');
                elements.chartPeriodSelector.value = 'this-month';
            }
        } else {
            try {
                const summary = await api(`api.php?resource=summary&period=${period}`);
                state.chartSummary = summary;
                if (state.chartSummary?.categories && CryptoModule?.isReady()) {
                    state.chartSummary.categories = await decryptCategories(state.chartSummary.categories);
                }
                renderChart();
            } catch (error) {
                showToast('Failed to load chart data');
            }
        }
    });

    // Trends range selector
    document.getElementById('trends-range-selector')?.addEventListener('change', (e) => {
        const months = parseInt(e.target.value) || 12;
        loadTrends(months);
    });


    // Spending modal view toggle
    document.querySelectorAll('.view-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Update toggle buttons
            document.querySelectorAll('.view-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show/hide views
            const tableView = document.getElementById('spending-table-view');
            const comparisonView = document.getElementById('budget-comparison-view');

            if (view === 'table') {
                if (tableView) tableView.style.display = 'block';
                if (comparisonView) comparisonView.style.display = 'none';
            } else {
                if (tableView) tableView.style.display = 'none';
                if (comparisonView) comparisonView.style.display = 'block';
                // Load comparison data
                const period = elements.spendingPeriodSelector?.value || 'this-month';
                loadBudgetComparison(period);
            }
        });
    });

    // Spending period selector with custom range support
    elements.spendingPeriodSelector?.addEventListener('change', async () => {
        const period = elements.spendingPeriodSelector.value;
        const customRangeEl = document.getElementById('spending-custom-range');

        if (period === 'custom') {
            if (customRangeEl) customRangeEl.style.display = 'flex';
        } else {
            if (customRangeEl) customRangeEl.style.display = 'none';
            try {
                const summary = await api(`api.php?resource=summary&period=${period}`);
                state.spendingSummary = summary;
                if (state.spendingSummary?.categories && CryptoModule?.isReady()) {
                    state.spendingSummary.categories = await decryptCategories(state.spendingSummary.categories);
                }
                renderSpendingTable();

                // Also update comparison if that view is active
                const comparisonView = document.getElementById('budget-comparison-view');
                if (comparisonView && comparisonView.style.display !== 'none') {
                    loadBudgetComparison(period);
                }
            } catch (error) {
                showToast('Failed to load data');
            }
        }
    });

    // Apply spending custom range
    document.getElementById('apply-spending-custom')?.addEventListener('click', async () => {
        const startDate = document.getElementById('spending-custom-start').value;
        const endDate = document.getElementById('spending-custom-end').value;

        if (!startDate || !endDate) {
            showToast('Please select both dates');
            return;
        }

        customDateRange = { startDate, endDate };

        try {
            const summary = await api(`api.php?resource=summary&period=custom&start_date=${startDate}&end_date=${endDate}`);
            state.spendingSummary = summary;
            if (state.spendingSummary?.categories && CryptoModule?.isReady()) {
                state.spendingSummary.categories = await decryptCategories(state.spendingSummary.categories);
            }
            renderSpendingTable();

            // Also update comparison if that view is active
            const comparisonView = document.getElementById('budget-comparison-view');
            if (comparisonView && comparisonView.style.display !== 'none') {
                loadBudgetComparison('custom');
            }
        } catch (error) {
            showToast('Failed to load data');
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
// ========================================
// CSV Import
// ========================================

const importState = {
    accountId: null,
    hasHeader: true,
    headers: [],
    rows: [],
    mapping: {},
    parsed: [],
    step: 'source'
};

// --- Parsing helpers -------------------------------------------------------

function importPad(n) { return String(n).padStart(2, '0'); }

// Detect the most likely delimiter from the header line.
function detectDelimiter(text) {
    const first = (text.split(/\r?\n/)[0]) || '';
    const counts = {
        ',': (first.match(/,/g) || []).length,
        ';': (first.match(/;/g) || []).length,
        '\t': (first.match(/\t/g) || []).length
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

// RFC-4180-ish CSV parser: handles quotes, escaped quotes, and quoted newlines.
function parseCSV(text, delim) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === delim) {
            row.push(field); field = '';
        } else if (c === '\r') {
            // ignore; \n handles the line break
        } else if (c === '\n') {
            row.push(field); rows.push(row); row = []; field = '';
        } else {
            field += c;
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Normalise a description to a merchant-ish key for matching/learning.
function normalizeDesc(s) {
    return (s || '')
        .toLowerCase()
        .replace(/[0-9]+/g, ' ')
        .replace(/[^a-z ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseImportDate(raw, format) {
    const s = (raw || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${importPad(m[2])}-${importPad(m[3])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
        let a = +m[1], b = +m[2], y = +m[3];
        if (y < 100) y += 2000;
        const day = (format === 'MDY') ? b : a;
        const mon = (format === 'MDY') ? a : b;
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
            return `${y}-${importPad(mon)}-${importPad(day)}`;
        }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${importPad(d.getMonth() + 1)}-${importPad(d.getDate())}`;
    return null;
}

function parseImportAmount(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.indexOf('-') !== -1) neg = true;
    s = s.replace(/[^0-9.,]/g, '');
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (s.indexOf(',') !== -1) {
        s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    const val = parseFloat(s);
    if (isNaN(val)) return null;
    return neg ? -Math.abs(val) : val;
}

// --- Learning & duplicates (client-side, over decrypted history) -----------

function importHistory() {
    return (state.allTransactions && state.allTransactions.length) ? state.allTransactions : (state.transactions || []);
}

// Suggest the category most often used for descriptions like this one.
function suggestCategoryId(description, type) {
    const key = normalizeDesc(description);
    if (!key) return null;
    const counts = {};
    for (const t of importHistory()) {
        if (t.type !== type || !t.category_id) continue;
        const tk = normalizeDesc(t.description || '');
        if (!tk) continue;
        let match = (tk === key);
        if (!match && key.length >= 4) {
            match = tk.includes(key) || key.includes(tk) || tk.split(' ')[0] === key.split(' ')[0];
        }
        if (match) counts[t.category_id] = (counts[t.category_id] || 0) + 1;
    }
    let best = null, bestN = 0;
    for (const cid in counts) if (counts[cid] > bestN) { bestN = counts[cid]; best = parseInt(cid); }
    return best;
}

function isLikelyDuplicate(row, accountId) {
    const key = normalizeDesc(row.description);
    return importHistory().some(t =>
        t.date === row.date &&
        Math.abs(Math.abs(parseFloat(t.amount)) - row.amount) < 0.005 &&
        String(t.account_id || '') === String(accountId || '') &&
        normalizeDesc(t.description || '') === key
    );
}

// --- Mapping persistence ---------------------------------------------------

function importMappingKey() { return 'import_map_' + (importState.headers || []).join('|').toLowerCase(); }
function loadSavedMapping() { try { return JSON.parse(localStorage.getItem(importMappingKey())); } catch { return null; } }
function saveImportMapping() { try { localStorage.setItem(importMappingKey(), JSON.stringify(importState.mapping)); } catch {} }

function guessMapping(headers) {
    const find = (needles) => {
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i].toLowerCase();
            if (needles.some(n => h.includes(n))) return String(i);
        }
        return '';
    };
    return {
        date: find(['date']),
        description: find(['description', 'desc', 'narrative', 'details', 'reference', 'payee', 'memo']),
        amount: find(['amount', 'value']),
        debit: find(['debit', 'money out', 'withdrawal']),
        credit: find(['credit', 'money in', 'deposit'])
    };
}

// --- UI helpers ------------------------------------------------------------

function importCategoryOptions(type, selectedId) {
    const cats = (state.categories || []).filter(c => c.type === type);
    let html = '<option value="">— category —</option>';
    for (const c of cats) {
        const sel = String(c.id) === String(selectedId) ? ' selected' : '';
        html += `<option value="${c.id}"${sel}>${escapeHtml(c.name)}</option>`;
    }
    return html;
}

function importGoToStep(step) {
    importState.step = step;
    ['source', 'map', 'preview', 'review'].forEach(s => {
        const el = document.getElementById('import-step-' + s);
        if (el) el.style.display = (s === step) ? '' : 'none';
    });
    const back = document.getElementById('import-back-btn');
    const next = document.getElementById('import-next-btn');
    const title = document.getElementById('import-modal-title');
    back.style.display = (step === 'map' || step === 'preview') ? '' : 'none';
    const labels = {
        source: ['Import Transactions', 'Next'],
        map: ['Map columns', 'Next'],
        preview: ['Preview & categorise', 'Import'],
        review: ['Review imported', 'Confirm all']
    };
    title.textContent = labels[step][0];
    next.textContent = labels[step][1];
    const cancel = document.getElementById('import-cancel-btn');
    if (cancel && step !== 'review') cancel.style.display = '';
}

// --- Flow ------------------------------------------------------------------

async function openImportModal() {
    closeNavDrawer();
    importState.accountId = null;
    importState.rows = [];
    importState.headers = [];
    importState.mapping = {};
    importState.parsed = [];
    importState.reviewDone = false;
    const fileEl = document.getElementById('import-file');
    if (fileEl) fileEl.value = '';
    const hdrEl = document.getElementById('import-has-header');
    if (hdrEl) hdrEl.checked = true;

    // Ledger model: every user always has >= 1 account. Default the picker to the
    // first account (no "no account" option); hide the legacy enable-accounts hint.
    const accGroup = document.getElementById('import-account-group');
    const accSel = document.getElementById('import-account');
    const accHint = document.getElementById('import-account-hint');
    accGroup.style.display = '';
    accSel.innerHTML = (state.accounts || [])
        .map((a, i) => `<option value="${a.id}"${i === 0 ? ' selected' : ''}>${escapeHtml(a.name)}</option>`)
        .join('');
    if (accHint) accHint.style.display = 'none';

    importGoToStep('source');
    openModal(document.getElementById('import-modal'));
    updateImportPendingBanner();
}

async function updateImportPendingBanner() {
    const banner = document.getElementById('import-pending-banner');
    try {
        const pending = await api('api.php?resource=transactions&needs_review=1&limit=10000');
        const n = Array.isArray(pending) ? pending.length : 0;
        if (n > 0) {
            document.getElementById('import-pending-text').textContent =
                `${n} transaction${n === 1 ? '' : 's'} from a previous import await review.`;
            banner.style.display = '';
        } else {
            banner.style.display = 'none';
        }
    } catch { banner.style.display = 'none'; }
}

async function importParseFile() {
    const file = document.getElementById('import-file').files?.[0];
    if (!file) { showToast('Choose a CSV file'); return; }
    importState.accountId = document.getElementById('import-account')?.value || null;
    importState.hasHeader = document.getElementById('import-has-header').checked;

    const text = await file.text();
    const rows = parseCSV(text, detectDelimiter(text));
    if (!rows.length) { showToast('No rows found in that file'); return; }

    importState.rows = rows;
    importState.headers = importState.hasHeader
        ? rows[0].map(h => h.trim())
        : rows[0].map((_, i) => `Column ${i + 1}`);

    renderMappingUI();
    importGoToStep('map');
}

function renderMappingUI() {
    const headers = importState.headers;
    const saved = loadSavedMapping();
    const m = saved || guessMapping(headers);
    importState.mapping = Object.assign({ dateFormat: 'DMY', amountSign: 'neg-expense' }, m);

    const colOptions = (selected) => '<option value="">— none —</option>' +
        headers.map((h, i) => `<option value="${i}"${String(selected) === String(i) ? ' selected' : ''}>${escapeHtml(h)}</option>`).join('');
    const field = (key, label) =>
        `<div class="import-map-row"><label>${label}</label><select data-imp-map="${key}">${colOptions(importState.mapping[key])}</select></div>`;

    const mm = importState.mapping;
    let html = field('date', 'Date') + field('description', 'Description') +
        field('amount', 'Amount (single column)') + field('debit', 'Debit / money out') + field('credit', 'Credit / money in');
    html += `<div class="import-map-row"><label>Date format</label><select data-imp-map="dateFormat">
        <option value="DMY"${mm.dateFormat === 'DMY' ? ' selected' : ''}>Day / Month / Year</option>
        <option value="MDY"${mm.dateFormat === 'MDY' ? ' selected' : ''}>Month / Day / Year</option>
        <option value="YMD"${mm.dateFormat === 'YMD' ? ' selected' : ''}>Year-Month-Day</option>
    </select></div>`;
    html += `<div class="import-map-row"><label>Single-amount sign</label><select data-imp-map="amountSign">
        <option value="neg-expense"${mm.amountSign !== 'pos-expense' ? ' selected' : ''}>Negative = expense</option>
        <option value="pos-expense"${mm.amountSign === 'pos-expense' ? ' selected' : ''}>Positive = expense</option>
    </select></div>`;
    document.getElementById('import-map-fields').innerHTML = html;
}

function buildParsedRows() {
    const m = importState.mapping;
    const dataRows = importState.hasHeader ? importState.rows.slice(1) : importState.rows;
    const cell = (r, key) => {
        const i = m[key];
        return (i === '' || i == null) ? '' : (r[i] ?? '');
    };
    const hasAmount = m.amount !== '' && m.amount != null;
    const out = [];
    for (const r of dataRows) {
        const date = parseImportDate(cell(r, 'date'), m.dateFormat);
        const description = String(cell(r, 'description')).trim();
        let amount, type;
        if (hasAmount) {
            const a = parseImportAmount(cell(r, 'amount'));
            if (a == null) continue;
            type = (m.amountSign === 'pos-expense') ? (a > 0 ? 'expense' : 'income') : (a < 0 ? 'expense' : 'income');
            amount = Math.abs(a);
        } else {
            const dv = parseImportAmount(cell(r, 'debit'));
            const cv = parseImportAmount(cell(r, 'credit'));
            if (dv && Math.abs(dv) > 0) { type = 'expense'; amount = Math.abs(dv); }
            else if (cv && Math.abs(cv) > 0) { type = 'income'; amount = Math.abs(cv); }
            else continue;
        }
        if (!date || !description || !(amount > 0)) continue;
        const categoryId = suggestCategoryId(description, type);
        const duplicate = isLikelyDuplicate({ date, description, amount }, importState.accountId);
        out.push({ date, description, amount, type, categoryId, duplicate, include: !duplicate });
    }
    return out;
}

function importBuildPreview() {
    const m = importState.mapping;
    const hasAmount = m.amount !== '' && m.amount != null;
    const hasDC = (m.debit !== '' && m.debit != null) || (m.credit !== '' && m.credit != null);
    if (m.date === '' || m.date == null || m.description === '' || m.description == null) {
        showToast('Map at least Date and Description'); return;
    }
    if (!hasAmount && !hasDC) { showToast('Map an Amount column, or Debit/Credit columns'); return; }

    saveImportMapping();
    importState.parsed = buildParsedRows();
    renderImportPreview();
    importGoToStep('preview');
}

function renderImportPreview() {
    const p = importState.parsed;
    const dupCount = p.filter(r => r.duplicate).length;
    document.getElementById('import-preview-summary').textContent = p.length
        ? `${p.length} row${p.length === 1 ? '' : 's'} parsed${dupCount ? `, ${dupCount} likely duplicate${dupCount === 1 ? '' : 's'} unticked` : ''}. Check categories, then import.`
        : 'No valid rows were parsed — go back and check your column mapping.';

    const body = p.map((r, i) => `
        <tr class="${r.duplicate ? 'import-dup' : ''}">
            <td><input type="checkbox" data-imp-include="${i}"${r.include ? ' checked' : ''}></td>
            <td>${escapeHtml(r.date)}</td>
            <td class="import-desc">${escapeHtml(r.description)}${r.duplicate ? ' <span class="import-badge">dup</span>' : ''}</td>
            <td>${r.type === 'expense' ? '−' : '+'}${formatCurrency(r.amount)}</td>
            <td><select data-imp-cat="${i}">${importCategoryOptions(r.type, r.categoryId)}</select></td>
        </tr>`).join('');
    document.getElementById('import-preview-table').innerHTML =
        '<thead><tr><th></th><th>Date</th><th>Description</th><th>Amount</th><th>Category (suggested)</th></tr></thead>' +
        `<tbody>${body || '<tr><td colspan="5" class="import-empty">No valid rows found.</td></tr>'}</tbody>`;
}

async function submitImport() {
    const rows = importState.parsed.filter(r => r.include);
    if (!rows.length) { showToast('Nothing selected to import'); return; }
    const next = document.getElementById('import-next-btn');
    next.disabled = true;
    try {
        const transactions = await Promise.all(rows.map(async r => {
            const enc = await encryptTransaction({ description: r.description });
            return {
                description: enc.description,
                amount: r.amount,
                type: r.type,
                date: r.date,
                category_id: r.categoryId || null
            };
        }));
        const res = await api('api.php?resource=import', {
            method: 'POST',
            body: { account_id: importState.accountId || null, transactions }
        });
        showToast(`Imported ${res.imported} transaction${res.imported === 1 ? '' : 's'}`);
        await loadAppData();
        renderAll();
        await openReviewStep();
    } catch (e) {
        showToast(e.message || 'Import failed');
    } finally {
        next.disabled = false;
    }
}

async function fetchPendingReview() {
    let list = await api('api.php?resource=transactions&needs_review=1&limit=10000');
    if (!Array.isArray(list)) list = [];
    if (CryptoModule?.isReady()) list = await decryptTransactions(list);
    return list;
}

async function openReviewStep() {
    const pending = await fetchPendingReview();
    renderReview(pending);
    importGoToStep('review');
}

function renderReview(list) {
    document.getElementById('import-review-summary').textContent = list.length
        ? `${list.length} transaction${list.length === 1 ? '' : 's'} awaiting confirmation. Set a category and confirm.`
        : 'All caught up — nothing left to review.';
    const body = list.map(t => `
        <tr data-imp-review="${t.id}">
            <td>${escapeHtml(t.date)}</td>
            <td class="import-desc">${escapeHtml(t.description || '')}</td>
            <td>${t.type === 'expense' ? '−' : '+'}${formatCurrency(Math.abs(t.amount))}</td>
            <td><select data-imp-review-cat="${t.id}">${importCategoryOptions(t.type, t.category_id)}</select></td>
            <td><button class="btn btn-small btn-primary" data-imp-confirm="${t.id}">Confirm</button></td>
        </tr>`).join('');
    document.getElementById('import-review-table').innerHTML =
        '<thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th></th></tr></thead>' +
        `<tbody>${body || '<tr><td colspan="5" class="import-empty">Nothing to review.</td></tr>'}</tbody>`;
    updateReviewCTA(list.length);
}

// Once everything is confirmed, turn the primary CTA into an obvious "Close"
// and hide "Cancel" (the imported rows are already saved).
function updateReviewCTA(remaining) {
    const next = document.getElementById('import-next-btn');
    const cancel = document.getElementById('import-cancel-btn');
    const summary = document.getElementById('import-review-summary');
    if (remaining > 0) {
        next.textContent = 'Confirm all';
        importState.reviewDone = false;
        if (cancel) cancel.style.display = '';
    } else {
        next.textContent = 'Close';
        importState.reviewDone = true;
        if (cancel) cancel.style.display = 'none';
        if (summary) summary.textContent = 'All caught up — nothing left to review.';
    }
}

async function confirmReviewRow(id) {
    const sel = document.querySelector(`[data-imp-review-cat="${id}"]`);
    const categoryId = sel && sel.value ? parseInt(sel.value) : 0;
    if (!categoryId) { showToast('Pick a category first'); return; }
    try {
        await api(`api.php?resource=transactions&id=${id}`, { method: 'PUT', body: { confirm: true, category_id: categoryId } });
        const tr = document.querySelector(`[data-imp-review="${id}"]`);
        if (tr) tr.remove();
        updateReviewCTA(document.querySelectorAll('[data-imp-review]').length);
        await loadAppData();
        renderAll();
    } catch (e) { showToast(e.message || 'Confirm failed'); }
}

async function confirmAllReview() {
    const selects = Array.from(document.querySelectorAll('[data-imp-review-cat]')).filter(s => s.value);
    if (!selects.length) { showToast('Set categories to confirm'); return; }
    const next = document.getElementById('import-next-btn');
    next.disabled = true;
    let ok = 0;
    for (const s of selects) {
        const id = s.getAttribute('data-imp-review-cat');
        try {
            await api(`api.php?resource=transactions&id=${id}`, { method: 'PUT', body: { confirm: true, category_id: parseInt(s.value) } });
            ok++;
            document.querySelector(`[data-imp-review="${id}"]`)?.remove();
        } catch {}
    }
    next.disabled = false;
    showToast(`Confirmed ${ok} transaction${ok === 1 ? '' : 's'}`);
    // Flip the CTA immediately based on remaining rows, before the network
    // refresh below — so it never lingers if loadAppData/fetch is slow or fails.
    updateReviewCTA(document.querySelectorAll('[data-imp-review]').length);
    await loadAppData();
    renderAll();
    renderReview(await fetchPendingReview());
}

async function importNext() {
    if (importState.step === 'source') return importParseFile();
    if (importState.step === 'map') return importBuildPreview();
    if (importState.step === 'preview') return submitImport();
    if (importState.step === 'review') {
        if (importState.reviewDone) { closeModal(document.getElementById('import-modal')); return; }
        return confirmAllReview();
    }
}

function setupImport() {
    document.getElementById('nav-import')?.addEventListener('click', openImportModal);
    document.getElementById('import-next-btn')?.addEventListener('click', importNext);
    document.getElementById('import-back-btn')?.addEventListener('click', () => {
        if (importState.step === 'preview') importGoToStep('map');
        else if (importState.step === 'map') importGoToStep('source');
    });
    document.getElementById('import-review-existing-btn')?.addEventListener('click', openReviewStep);

    const modal = document.getElementById('import-modal');
    modal?.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('[data-imp-map]')) {
            importState.mapping[t.getAttribute('data-imp-map')] = t.value;
        } else if (t.matches('[data-imp-include]')) {
            const row = importState.parsed[+t.getAttribute('data-imp-include')];
            if (row) row.include = t.checked;
        } else if (t.matches('[data-imp-cat]')) {
            const row = importState.parsed[+t.getAttribute('data-imp-cat')];
            if (row) row.categoryId = t.value ? parseInt(t.value) : null;
        }
    });
    modal?.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('[data-imp-confirm]');
        if (btn) confirmReviewRow(btn.getAttribute('data-imp-confirm'));
    });
}

window.deleteCategory = deleteCategory;
window.openEditCategoryModal = openEditCategoryModal;
window.deleteTransaction = deleteTransaction;
window.openEditTransactionModal = openEditTransactionModal;
window.deleteRecurringTransaction = deleteRecurringTransaction;
window.openEditRecurringModal = openEditRecurringModal;
window.toggleRecurringTransaction = toggleRecurringTransaction;
window.openCategoryDrilldown = openCategoryDrilldown;
