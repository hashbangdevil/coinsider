<?php
// ========================================
// Coinsider - Database Module
// ========================================

require_once __DIR__ . '/config.php';

// Distinct color palette for auto-assigning category colors
const CATEGORY_COLORS = [
    '#6366f1', // Indigo
    '#f43f5e', // Rose
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#a855f7', // Purple
];

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        $dbDir = dirname(DB_PATH);
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }

        $this->pdo = new PDO('sqlite:' . DB_PATH);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        
        $this->initializeTables();
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getPdo() {
        return $this->pdo;
    }

    private function initializeTables() {
        // Users table with password hash
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                currency TEXT DEFAULT 'ZAR',
                reset_token TEXT,
                reset_token_expires DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
        
        // Add currency column if it doesn't exist (migration for existing DBs)
        try {
            $this->pdo->exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'ZAR'");
        } catch (PDOException $e) {
            // Column already exists, ignore
        }

        // Add encryption columns (migration for existing DBs)
        $encryptionColumns = [
            "ALTER TABLE users ADD COLUMN encryption_enabled INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN encryption_salt TEXT",
            "ALTER TABLE users ADD COLUMN encrypted_mek TEXT",
            "ALTER TABLE users ADD COLUMN recovery_salt TEXT",
            "ALTER TABLE users ADD COLUMN recovery_encrypted_mek TEXT"
        ];
        foreach ($encryptionColumns as $sql) {
            try {
                $this->pdo->exec($sql);
            } catch (PDOException $e) {
                // Column already exists, ignore
            }
        }

        // Transactions table
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
                date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");

        // Categories table (user-defined categories with budgets)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                monthly_budget REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, name, type)
            )
        ");

        // Add category_id column to transactions (migration for existing DBs)
        try {
            $this->pdo->exec("ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES categories(id)");
        } catch (PDOException $e) {
            // Column already exists, ignore
        }

        // Recurring transactions table
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS recurring_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                category_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
                frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
                start_date DATE NOT NULL,
                end_date DATE DEFAULT NULL,
                next_occurrence DATE NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        ");

        // Add recurring_id column to transactions (migration for existing DBs)
        try {
            $this->pdo->exec("ALTER TABLE transactions ADD COLUMN recurring_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL");
        } catch (PDOException $e) {
            // Column already exists, ignore
        }

        // Savings buckets table
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS savings_buckets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                color TEXT,
                monthly_target REAL DEFAULT 0,
                current_balance REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )
        ");

        // Savings transactions table
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS savings_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                bucket_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('allocation', 'withdrawal', 'adjustment')),
                description TEXT,
                date DATE NOT NULL,
                linked_transaction_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (bucket_id) REFERENCES savings_buckets(id) ON DELETE CASCADE,
                FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
            )
        ");

        // Add savings_bucket_id column to transactions (migration for existing DBs)
        try {
            $this->pdo->exec("ALTER TABLE transactions ADD COLUMN savings_bucket_id INTEGER REFERENCES savings_buckets(id) ON DELETE SET NULL");
        } catch (PDOException $e) {
            // Column already exists, ignore
        }

        // Indexes
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_transactions(next_occurrence)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_savings_buckets_user ON savings_buckets(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_savings_transactions_user ON savings_transactions(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_savings_transactions_bucket ON savings_transactions(bucket_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_savings_bucket ON transactions(savings_bucket_id)");
    }
}

// ========================================
// User Functions
// ========================================

function findUserByEmail($email) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([strtolower(trim($email))]);
    return $stmt->fetch();
}

function findUserById($id) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function findUserByResetToken($token) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT * FROM users 
        WHERE reset_token = ? AND reset_token_expires > datetime('now')
    ");
    $stmt->execute([$token]);
    return $stmt->fetch();
}

function createUser($email, $name, $password) {
    $pdo = Database::getInstance()->getPdo();
    
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("
        INSERT INTO users (email, name, password_hash) 
        VALUES (?, ?, ?)
    ");
    $stmt->execute([strtolower(trim($email)), trim($name), $passwordHash]);
    
    return findUserById($pdo->lastInsertId());
}

function verifyPassword($user, $password) {
    return password_verify($password, $user['password_hash']);
}

function setResetToken($userId, $token, $expires) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users 
        SET reset_token = ?, reset_token_expires = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $stmt->execute([$token, $expires, $userId]);
}

function clearResetToken($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users 
        SET reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $stmt->execute([$userId]);
}

function updatePassword($userId, $newPassword) {
    $pdo = Database::getInstance()->getPdo();
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("
        UPDATE users 
        SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $stmt->execute([$passwordHash, $userId]);
}

function updateUserName($userId, $name) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    ");
    $stmt->execute([trim($name), $userId]);
    return findUserById($userId);
}

function updateUserCurrency($userId, $currency) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    ");
    $stmt->execute([$currency, $userId]);
    return findUserById($userId);
}

// ========================================
// Encryption Functions
// ========================================

function getEncryptionSettings($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT encryption_enabled, encryption_salt, encrypted_mek, recovery_salt, recovery_encrypted_mek
        FROM users WHERE id = ?
    ");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

function enableEncryption($userId, $encryptionSalt, $encryptedMek, $recoverySalt, $recoveryEncryptedMek) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET
            encryption_enabled = 1,
            encryption_salt = ?,
            encrypted_mek = ?,
            recovery_salt = ?,
            recovery_encrypted_mek = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$encryptionSalt, $encryptedMek, $recoverySalt, $recoveryEncryptedMek, $userId]);
    return getEncryptionSettings($userId);
}

function updateEncryptionKey($userId, $encryptionSalt, $encryptedMek) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET
            encryption_salt = ?,
            encrypted_mek = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$encryptionSalt, $encryptedMek, $userId]);
    return getEncryptionSettings($userId);
}

function disableEncryption($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET
            encryption_enabled = 0,
            encryption_salt = NULL,
            encrypted_mek = NULL,
            recovery_salt = NULL,
            recovery_encrypted_mek = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$userId]);
}

// ========================================
// Category Functions
// ========================================

// Default categories to seed for new users
const DEFAULT_CATEGORIES = [
    // Expense categories
    ['name' => 'Food & Dining', 'type' => 'expense', 'icon' => '🍔', 'color' => '#f97316'],
    ['name' => 'Transportation', 'type' => 'expense', 'icon' => '🚗', 'color' => '#3b82f6'],
    ['name' => 'Shopping', 'type' => 'expense', 'icon' => '🛍️', 'color' => '#ec4899'],
    ['name' => 'Entertainment', 'type' => 'expense', 'icon' => '🎬', 'color' => '#8b5cf6'],
    ['name' => 'Bills & Utilities', 'type' => 'expense', 'icon' => '📄', 'color' => '#06b6d4'],
    ['name' => 'Health', 'type' => 'expense', 'icon' => '💊', 'color' => '#10b981'],
    ['name' => 'Education', 'type' => 'expense', 'icon' => '📚', 'color' => '#6366f1'],
    ['name' => 'Other', 'type' => 'expense', 'icon' => '📦', 'color' => '#64748b'],
    // Income categories
    ['name' => 'Salary', 'type' => 'income', 'icon' => '💵', 'color' => '#22c55e'],
    ['name' => 'Investment', 'type' => 'income', 'icon' => '📈', 'color' => '#14b8a6'],
    ['name' => 'Other', 'type' => 'income', 'icon' => '📦', 'color' => '#64748b'],
];

function getCategories($userId, $type = null) {
    $pdo = Database::getInstance()->getPdo();

    if ($type) {
        $stmt = $pdo->prepare("
            SELECT c.*,
                   (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) > 0 as has_transactions
            FROM categories c
            WHERE c.user_id = ? AND c.type = ?
            ORDER BY c.name ASC
        ");
        $stmt->execute([$userId, $type]);
    } else {
        $stmt = $pdo->prepare("
            SELECT c.*,
                   (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) > 0 as has_transactions
            FROM categories c
            WHERE c.user_id = ?
            ORDER BY c.type DESC, c.name ASC
        ");
        $stmt->execute([$userId]);
    }

    return $stmt->fetchAll();
}

function getCategory($userId, $categoryId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?");
    $stmt->execute([$categoryId, $userId]);
    return $stmt->fetch();
}

function createCategory($userId, $name, $type, $icon, $color = null, $monthlyBudget = 0) {
    $pdo = Database::getInstance()->getPdo();

    // Auto-assign color from palette based on category count
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM categories WHERE user_id = ?");
    $stmt->execute([$userId]);
    $count = $stmt->fetch()['count'];
    $color = CATEGORY_COLORS[$count % count(CATEGORY_COLORS)];

    $stmt = $pdo->prepare("
        INSERT INTO categories (user_id, name, type, icon, color, monthly_budget)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, trim($name), $type, $icon, $color, $monthlyBudget]);
    return getCategory($userId, $pdo->lastInsertId());
}

function updateCategory($userId, $categoryId, $name, $icon, $monthlyBudget, $type = null) {
    $pdo = Database::getInstance()->getPdo();

    // If type is being changed, check if category has transactions
    if ($type !== null) {
        $category = getCategory($userId, $categoryId);
        if ($category && $category['type'] !== $type) {
            if (categoryHasTransactions($userId, $categoryId)) {
                return false; // Cannot change type, has transactions
            }
        }
    }

    // Color is auto-assigned and not editable
    if ($type !== null) {
        $stmt = $pdo->prepare("
            UPDATE categories
            SET name = ?, icon = ?, monthly_budget = ?, type = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([trim($name), $icon, $monthlyBudget, $type, $categoryId, $userId]);
    } else {
        $stmt = $pdo->prepare("
            UPDATE categories
            SET name = ?, icon = ?, monthly_budget = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([trim($name), $icon, $monthlyBudget, $categoryId, $userId]);
    }

    return getCategory($userId, $categoryId);
}

function deleteCategory($userId, $categoryId) {
    // Check if category has transactions first
    if (categoryHasTransactions($userId, $categoryId)) {
        return false; // Cannot delete, has transactions
    }

    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ? AND user_id = ?");
    $stmt->execute([$categoryId, $userId]);
    return $stmt->rowCount() > 0;
}

function categoryHasTransactions($userId, $categoryId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count FROM transactions
        WHERE user_id = ? AND category_id = ?
    ");
    $stmt->execute([$userId, $categoryId]);
    $result = $stmt->fetch();
    return $result['count'] > 0;
}

function seedDefaultCategories($userId) {
    $pdo = Database::getInstance()->getPdo();

    foreach (DEFAULT_CATEGORIES as $cat) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO categories (user_id, name, type, icon, color, monthly_budget)
                VALUES (?, ?, ?, ?, ?, 0)
            ");
            $stmt->execute([$userId, $cat['name'], $cat['type'], $cat['icon'], $cat['color']]);
        } catch (PDOException $e) {
            // Ignore duplicate key errors (category already exists)
        }
    }
}

function getCategorySpent($userId, $categoryId, $yearMonth) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) as spent
        FROM transactions
        WHERE user_id = ? AND category_id = ? AND strftime('%Y-%m', date) = ?
    ");
    $stmt->execute([$userId, $categoryId, $yearMonth]);
    $result = $stmt->fetch();
    return (float) $result['spent'];
}

// Mapping from old category keys to new category data
const CATEGORY_KEY_MAPPING = [
    'food' => ['name' => 'Food & Dining', 'type' => 'expense', 'icon' => '🍔', 'color' => '#f97316'],
    'transport' => ['name' => 'Transportation', 'type' => 'expense', 'icon' => '🚗', 'color' => '#3b82f6'],
    'shopping' => ['name' => 'Shopping', 'type' => 'expense', 'icon' => '🛍️', 'color' => '#ec4899'],
    'entertainment' => ['name' => 'Entertainment', 'type' => 'expense', 'icon' => '🎬', 'color' => '#8b5cf6'],
    'bills' => ['name' => 'Bills & Utilities', 'type' => 'expense', 'icon' => '📄', 'color' => '#06b6d4'],
    'health' => ['name' => 'Health', 'type' => 'expense', 'icon' => '💊', 'color' => '#10b981'],
    'education' => ['name' => 'Education', 'type' => 'expense', 'icon' => '📚', 'color' => '#6366f1'],
    'other' => ['name' => 'Other', 'type' => 'expense', 'icon' => '📦', 'color' => '#64748b'],
    'salary' => ['name' => 'Salary', 'type' => 'income', 'icon' => '💵', 'color' => '#22c55e'],
    'investment' => ['name' => 'Investment', 'type' => 'income', 'icon' => '📈', 'color' => '#14b8a6'],
];

function migrateUserCategories($userId) {
    $pdo = Database::getInstance()->getPdo();

    // Check if user already has categories (already migrated)
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM categories WHERE user_id = ?");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();
    if ($result['count'] > 0) {
        return false; // Already migrated
    }

    // Seed default categories first
    seedDefaultCategories($userId);

    // Get all unique categories from user's transactions
    $stmt = $pdo->prepare("
        SELECT DISTINCT category, type FROM transactions WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $usedCategories = $stmt->fetchAll();

    // Map old budget categories to new category records and merge budget amounts
    $stmt = $pdo->prepare("SELECT * FROM budgets WHERE user_id = ?");
    $stmt->execute([$userId]);
    $budgets = $stmt->fetchAll();

    foreach ($budgets as $budget) {
        $catKey = $budget['category'];
        $catData = CATEGORY_KEY_MAPPING[$catKey] ?? null;

        if ($catData) {
            // Find or create the category and update its monthly_budget
            $stmt = $pdo->prepare("
                UPDATE categories SET monthly_budget = ?
                WHERE user_id = ? AND name = ? AND type = ?
            ");
            $stmt->execute([$budget['amount'], $userId, $catData['name'], $catData['type']]);
        }
    }

    // Update all transactions with category_id based on old category key
    foreach ($usedCategories as $used) {
        $catKey = $used['category'];
        $catData = CATEGORY_KEY_MAPPING[$catKey] ?? null;

        if ($catData) {
            // Find the category ID
            $stmt = $pdo->prepare("
                SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ?
            ");
            $stmt->execute([$userId, $catData['name'], $catData['type']]);
            $category = $stmt->fetch();

            if ($category) {
                // Update transactions with this category key
                $stmt = $pdo->prepare("
                    UPDATE transactions SET category_id = ?
                    WHERE user_id = ? AND category = ?
                ");
                $stmt->execute([$category['id'], $userId, $catKey]);
            }
        }
    }

    return true;
}

function migrateAllUsers() {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->query("SELECT id FROM users");
    $users = $stmt->fetchAll();

    $migrated = 0;
    foreach ($users as $user) {
        if (migrateUserCategories($user['id'])) {
            $migrated++;
        }
    }

    return $migrated;
}

// ========================================
// Transaction Functions
// ========================================

function getTransactions($userId, $limit = 100) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               sb.name as savings_bucket_name, sb.icon as savings_bucket_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN savings_buckets sb ON t.savings_bucket_id = sb.id
        WHERE t.user_id = ?
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT ?
    ");
    $stmt->execute([$userId, $limit]);
    return $stmt->fetchAll();
}

function getTransaction($userId, $transactionId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               sb.name as savings_bucket_name, sb.icon as savings_bucket_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN savings_buckets sb ON t.savings_bucket_id = sb.id
        WHERE t.id = ? AND t.user_id = ?
    ");
    $stmt->execute([$transactionId, $userId]);
    return $stmt->fetch();
}

function createTransactionWithCategoryId($userId, $description, $amount, $categoryId, $type, $date) {
    $pdo = Database::getInstance()->getPdo();

    // Get the category to validate and get a name for the legacy column
    $category = getCategory($userId, $categoryId);
    if (!$category) {
        return null;
    }

    // Validate category type matches transaction type
    if ($category['type'] !== $type) {
        return null;
    }

    $stmt = $pdo->prepare("
        INSERT INTO transactions (user_id, description, amount, category, category_id, type, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $description, $amount, $category['name'], $categoryId, $type, $date]);
    return getTransaction($userId, $pdo->lastInsertId());
}

function updateTransactionWithCategoryId($userId, $transactionId, $description, $amount, $categoryId, $type, $date) {
    $pdo = Database::getInstance()->getPdo();

    // Get the category to validate
    $category = getCategory($userId, $categoryId);
    if (!$category) {
        return null;
    }

    // Validate category type matches transaction type
    if ($category['type'] !== $type) {
        return null;
    }

    $stmt = $pdo->prepare("
        UPDATE transactions
        SET description = ?, amount = ?, category = ?, category_id = ?, type = ?, date = ?
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$description, $amount, $category['name'], $categoryId, $type, $date, $transactionId, $userId]);
    return getTransaction($userId, $transactionId);
}

// Legacy function - keep for backward compatibility during migration
function createTransaction($userId, $description, $amount, $category, $type, $date) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        INSERT INTO transactions (user_id, description, amount, category, type, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $description, $amount, $category, $type, $date]);
    return getTransaction($userId, $pdo->lastInsertId());
}

// Legacy function - keep for backward compatibility during migration
function updateTransaction($userId, $transactionId, $description, $amount, $category, $type, $date) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE transactions
        SET description = ?, amount = ?, category = ?, type = ?, date = ?
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$description, $amount, $category, $type, $date, $transactionId, $userId]);
    return getTransaction($userId, $transactionId);
}

function deleteTransaction($userId, $transactionId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?");
    $stmt->execute([$transactionId, $userId]);
    return $stmt->rowCount() > 0;
}

// ========================================
// Summary Functions
// ========================================

function getMonthlyTotals($userId, $yearMonth) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT 
            type,
            SUM(amount) as total
        FROM transactions 
        WHERE user_id = ? AND strftime('%Y-%m', date) = ?
        GROUP BY type
    ");
    $stmt->execute([$userId, $yearMonth]);
    
    $results = $stmt->fetchAll();
    $totals = ['income' => 0, 'expense' => 0];
    
    foreach ($results as $row) {
        $totals[$row['type']] = (float) $row['total'];
    }
    
    return $totals;
}

function getCategoryTotalsWithDetails($userId, $yearMonth) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            c.id,
            c.name,
            c.icon,
            c.color,
            c.monthly_budget,
            COALESCE(SUM(t.amount), 0) as spent
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id
            AND t.type = 'expense'
            AND strftime('%Y-%m', t.date) = ?
        WHERE c.user_id = ? AND c.type = 'expense'
        GROUP BY c.id, c.name, c.icon, c.color, c.monthly_budget
        ORDER BY spent DESC
    ");
    $stmt->execute([$yearMonth, $userId]);
    $results = $stmt->fetchAll();

    // Calculate percentage for each category
    foreach ($results as &$row) {
        $row['spent'] = (float) $row['spent'];
        $row['monthly_budget'] = (float) $row['monthly_budget'];
        if ($row['monthly_budget'] > 0) {
            $row['percentage'] = round(($row['spent'] / $row['monthly_budget']) * 100, 1);
        } else {
            $row['percentage'] = 0;
        }
    }

    return $results;
}

function getYearlyTotals($userId, $year) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            type,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND strftime('%Y', date) = ?
        GROUP BY type
    ");
    $stmt->execute([$userId, $year]);

    $results = $stmt->fetchAll();
    $totals = ['income' => 0, 'expense' => 0];

    foreach ($results as $row) {
        $totals[$row['type']] = (float) $row['total'];
    }

    return $totals;
}

function getAllTimeTotals($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            type,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ?
        GROUP BY type
    ");
    $stmt->execute([$userId]);

    $results = $stmt->fetchAll();
    $totals = ['income' => 0, 'expense' => 0];

    foreach ($results as $row) {
        $totals[$row['type']] = (float) $row['total'];
    }

    return $totals;
}

function getCategoryTotalsForYear($userId, $year) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            c.id,
            c.name,
            c.icon,
            c.color,
            c.monthly_budget,
            COALESCE(SUM(t.amount), 0) as spent
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id
            AND t.type = 'expense'
            AND strftime('%Y', t.date) = ?
        WHERE c.user_id = ? AND c.type = 'expense'
        GROUP BY c.id, c.name, c.icon, c.color, c.monthly_budget
        ORDER BY spent DESC
    ");
    $stmt->execute([$year, $userId]);
    $results = $stmt->fetchAll();

    // For yearly view, multiply monthly budget by 12 for percentage calc
    foreach ($results as &$row) {
        $row['spent'] = (float) $row['spent'];
        $row['monthly_budget'] = (float) $row['monthly_budget'];
        $yearlyBudget = $row['monthly_budget'] * 12;
        if ($yearlyBudget > 0) {
            $row['percentage'] = round(($row['spent'] / $yearlyBudget) * 100, 1);
        } else {
            $row['percentage'] = 0;
        }
    }

    return $results;
}

function getCategoryTotalsAllTime($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            c.id,
            c.name,
            c.icon,
            c.color,
            c.monthly_budget,
            COALESCE(SUM(t.amount), 0) as spent
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id
            AND t.type = 'expense'
        WHERE c.user_id = ? AND c.type = 'expense'
        GROUP BY c.id, c.name, c.icon, c.color, c.monthly_budget
        ORDER BY spent DESC
    ");
    $stmt->execute([$userId]);
    $results = $stmt->fetchAll();

    // For all-time, don't calculate percentage (no sensible budget comparison)
    foreach ($results as &$row) {
        $row['spent'] = (float) $row['spent'];
        $row['monthly_budget'] = (float) $row['monthly_budget'];
        $row['percentage'] = 0;
    }

    return $results;
}

// ========================================
// Recurring Transaction Functions
// ========================================

function getRecurringTransactions($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM recurring_transactions r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = ?
        ORDER BY r.is_active DESC, r.next_occurrence ASC
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

function getRecurringTransaction($userId, $id) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM recurring_transactions r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.id = ? AND r.user_id = ?
    ");
    $stmt->execute([$id, $userId]);
    return $stmt->fetch();
}

function createRecurringTransaction($userId, $description, $amount, $categoryId, $type, $frequency, $startDate, $endDate = null, $skipFirst = false) {
    $pdo = Database::getInstance()->getPdo();

    // Validate category belongs to user and matches type
    $category = getCategory($userId, $categoryId);
    if (!$category || $category['type'] !== $type) {
        return null;
    }

    // Validate end_date >= start_date if provided
    if ($endDate !== null && $endDate < $startDate) {
        return null;
    }

    $today = date('Y-m-d');

    // Set initial next_occurrence
    if ($skipFirst && $startDate <= $today) {
        // Skip first occurrence - set next_occurrence to the next future date
        $nextOccurrence = calculateNextOccurrence($startDate, $frequency, $today);
    } else {
        // Normal behavior - start from start_date
        $nextOccurrence = $startDate;
    }

    // If end_date is already passed, set next_occurrence to end_date
    if ($endDate !== null && $nextOccurrence > $endDate) {
        $nextOccurrence = $endDate;
    }

    $stmt = $pdo->prepare("
        INSERT INTO recurring_transactions (user_id, description, amount, category_id, type, frequency, start_date, end_date, next_occurrence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $description, $amount, $categoryId, $type, $frequency, $startDate, $endDate, $nextOccurrence]);

    $newId = $pdo->lastInsertId();

    // Generate any pending transactions (only if not skipping and start date is today or past)
    if (!$skipFirst || $startDate > $today) {
        generatePendingRecurringTransactions($userId);
    }

    return getRecurringTransaction($userId, $newId);
}

function updateRecurringTransaction($userId, $id, $description, $amount, $categoryId, $type, $frequency, $startDate, $endDate = null) {
    $pdo = Database::getInstance()->getPdo();

    // Validate category belongs to user and matches type
    $category = getCategory($userId, $categoryId);
    if (!$category || $category['type'] !== $type) {
        return null;
    }

    // Validate end_date >= start_date if provided
    if ($endDate !== null && $endDate < $startDate) {
        return null;
    }

    // Recalculate next_occurrence
    $today = date('Y-m-d');
    $nextOccurrence = $startDate;
    if ($startDate < $today) {
        $nextOccurrence = calculateNextOccurrence($startDate, $frequency, $today);
    }

    if ($endDate !== null && $nextOccurrence > $endDate) {
        $nextOccurrence = $endDate;
    }

    $stmt = $pdo->prepare("
        UPDATE recurring_transactions
        SET description = ?, amount = ?, category_id = ?, type = ?, frequency = ?, start_date = ?, end_date = ?, next_occurrence = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$description, $amount, $categoryId, $type, $frequency, $startDate, $endDate, $nextOccurrence, $id, $userId]);

    return getRecurringTransaction($userId, $id);
}

function deleteRecurringTransaction($userId, $id) {
    $pdo = Database::getInstance()->getPdo();
    // Note: Already-generated transactions are kept (recurring_id becomes NULL due to ON DELETE SET NULL)
    $stmt = $pdo->prepare("DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    return $stmt->rowCount() > 0;
}

function pauseRecurringTransaction($userId, $id) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE recurring_transactions
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$id, $userId]);
    return getRecurringTransaction($userId, $id);
}

function resumeRecurringTransaction($userId, $id) {
    $pdo = Database::getInstance()->getPdo();

    // First get the recurring transaction to recalculate next_occurrence
    $recurring = getRecurringTransaction($userId, $id);
    if (!$recurring) {
        return null;
    }

    $today = date('Y-m-d');
    $nextOccurrence = calculateNextOccurrence($recurring['start_date'], $recurring['frequency'], $today);

    // If end_date is reached, don't resume
    if ($recurring['end_date'] !== null && $nextOccurrence > $recurring['end_date']) {
        return $recurring; // Return without activating
    }

    $stmt = $pdo->prepare("
        UPDATE recurring_transactions
        SET is_active = 1, next_occurrence = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$nextOccurrence, $id, $userId]);

    return getRecurringTransaction($userId, $id);
}

function calculateNextOccurrence($startDate, $frequency, $fromDate = null) {
    $from = $fromDate ? new DateTime($fromDate) : new DateTime();
    $from->setTime(0, 0, 0);
    $start = new DateTime($startDate);
    $start->setTime(0, 0, 0);
    $next = clone $start;

    // If start is strictly in the future, return it
    if ($start > $from) {
        return $start->format('Y-m-d');
    }

    // Calculate the next occurrence AFTER fromDate (must be > fromDate, not ==)
    switch ($frequency) {
        case 'monthly':
            // Calculate months difference
            $interval = $start->diff($from);
            $monthsDiff = ($interval->y * 12) + $interval->m;

            // Always add 1 more to ensure we get a date AFTER fromDate
            $monthsDiff++;

            $next->modify("+{$monthsDiff} months");
            break;

        case 'yearly':
            // Calculate years difference
            $interval = $start->diff($from);
            $yearsDiff = $interval->y;

            // Always add 1 more to ensure we get a date AFTER fromDate
            $yearsDiff++;

            $next->modify("+{$yearsDiff} years");
            break;
    }

    return $next->format('Y-m-d');
}

function generatePendingRecurringTransactions($userId) {
    $pdo = Database::getInstance()->getPdo();
    $today = date('Y-m-d');

    // Get all active recurring transactions that need processing
    $stmt = $pdo->prepare("
        SELECT * FROM recurring_transactions
        WHERE user_id = ? AND is_active = 1
        AND (end_date IS NULL OR next_occurrence <= end_date)
    ");
    $stmt->execute([$userId]);
    $recurringTransactions = $stmt->fetchAll();

    $generated = [];

    foreach ($recurringTransactions as $recurring) {
        $currentDate = $recurring['next_occurrence'];

        // Only generate transactions for dates up to and including today (no future pre-generation)
        while ($currentDate <= $today) {
            // Check if end_date is reached
            if ($recurring['end_date'] !== null && $currentDate > $recurring['end_date']) {
                break;
            }

            // Check if transaction already exists for this date and recurring_id
            $checkStmt = $pdo->prepare("
                SELECT id FROM transactions
                WHERE user_id = ? AND recurring_id = ? AND date = ?
            ");
            $checkStmt->execute([$userId, $recurring['id'], $currentDate]);

            if (!$checkStmt->fetch()) {
                // Create the transaction
                $category = getCategory($userId, $recurring['category_id']);
                $categoryName = $category ? $category['name'] : 'Unknown';

                $insertStmt = $pdo->prepare("
                    INSERT INTO transactions (user_id, description, amount, category, category_id, type, date, recurring_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $insertStmt->execute([
                    $userId,
                    $recurring['description'],
                    $recurring['amount'],
                    $categoryName,
                    $recurring['category_id'],
                    $recurring['type'],
                    $currentDate,
                    $recurring['id']
                ]);

                $generated[] = [
                    'recurring_id' => $recurring['id'],
                    'date' => $currentDate,
                    'description' => $recurring['description']
                ];
            }

            // Move to next occurrence
            $currentDate = calculateNextOccurrence($recurring['start_date'], $recurring['frequency'], $currentDate);

            // Safety check to prevent infinite loop
            if ($currentDate === $recurring['next_occurrence']) {
                break;
            }
        }

        // Update next_occurrence to the next future date
        $newNextOccurrence = calculateNextOccurrence($recurring['start_date'], $recurring['frequency'], $today);
        $updateStmt = $pdo->prepare("
            UPDATE recurring_transactions SET next_occurrence = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $updateStmt->execute([$newNextOccurrence, $recurring['id']]);
    }

    return $generated;
}

function getUpcomingRecurringTransactions($userId, $days = 7) {
    $pdo = Database::getInstance()->getPdo();
    $today = date('Y-m-d');
    $endDate = (new DateTime())->modify("+{$days} days")->format('Y-m-d');

    // Get active recurring transactions with next_occurrence within the window
    $stmt = $pdo->prepare("
        SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM recurring_transactions r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = ?
        AND r.is_active = 1
        AND r.next_occurrence > ?
        AND r.next_occurrence <= ?
        AND (r.end_date IS NULL OR r.next_occurrence <= r.end_date)
        ORDER BY r.next_occurrence ASC
    ");
    $stmt->execute([$userId, $today, $endDate]);
    return $stmt->fetchAll();
}

// ========================================
// Custom Date Range Functions
// ========================================

function getCustomRangeTotals($userId, $startDate, $endDate) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            type,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ?
        GROUP BY type
    ");
    $stmt->execute([$userId, $startDate, $endDate]);

    $results = $stmt->fetchAll();
    $totals = ['income' => 0, 'expense' => 0];

    foreach ($results as $row) {
        $totals[$row['type']] = (float) $row['total'];
    }

    return $totals;
}

function getCategoryTotalsForDateRange($userId, $startDate, $endDate) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            c.id,
            c.name,
            c.icon,
            c.color,
            c.monthly_budget,
            COALESCE(SUM(t.amount), 0) as spent
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id
            AND t.type = 'expense'
            AND t.date >= ?
            AND t.date <= ?
        WHERE c.user_id = ? AND c.type = 'expense'
        GROUP BY c.id, c.name, c.icon, c.color, c.monthly_budget
        ORDER BY spent DESC
    ");
    $stmt->execute([$startDate, $endDate, $userId]);
    $results = $stmt->fetchAll();

    // Calculate months in range for budget comparison
    $start = new DateTime($startDate);
    $end = new DateTime($endDate);
    $interval = $start->diff($end);
    $months = max(1, ($interval->y * 12) + $interval->m + ($interval->d > 0 ? 1 : 0));

    foreach ($results as &$row) {
        $row['spent'] = (float) $row['spent'];
        $row['monthly_budget'] = (float) $row['monthly_budget'];
        $periodBudget = $row['monthly_budget'] * $months;
        if ($periodBudget > 0) {
            $row['percentage'] = round(($row['spent'] / $periodBudget) * 100, 1);
        } else {
            $row['percentage'] = 0;
        }
    }

    return $results;
}

function getTransactionsFiltered($userId, $limit = 100, $categoryId = null, $startDate = null, $endDate = null) {
    $pdo = Database::getInstance()->getPdo();

    $sql = "
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               sb.name as savings_bucket_name, sb.icon as savings_bucket_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN savings_buckets sb ON t.savings_bucket_id = sb.id
        WHERE t.user_id = ?
    ";
    $params = [$userId];

    if ($categoryId !== null) {
        $sql .= " AND t.category_id = ?";
        $params[] = $categoryId;
    }

    if ($startDate !== null) {
        $sql .= " AND t.date >= ?";
        $params[] = $startDate;
    }

    if ($endDate !== null) {
        $sql .= " AND t.date <= ?";
        $params[] = $endDate;
    }

    $sql .= " ORDER BY t.date DESC, t.created_at DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

// ========================================
// Trends Functions
// ========================================

function getTrends($userId, $type = 'both', $granularity = 'monthly', $months = 12, $categoryId = null) {
    $pdo = Database::getInstance()->getPdo();

    $endDate = date('Y-m-d');
    $startDate = (new DateTime())->modify("-{$months} months")->format('Y-m-01');

    $sql = "
        SELECT
            strftime('%Y-%m', date) as period,
            type,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ?
    ";
    $params = [$userId, $startDate, $endDate];

    if ($type !== 'both') {
        $sql .= " AND type = ?";
        $params[] = $type;
    }

    if ($categoryId !== null) {
        $sql .= " AND category_id = ?";
        $params[] = $categoryId;
    }

    $sql .= " GROUP BY period, type ORDER BY period ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll();

    // Build a complete timeline with zero-filled months
    $trends = [];
    $current = new DateTime($startDate);
    $end = new DateTime($endDate);

    while ($current <= $end) {
        $period = $current->format('Y-m');
        $trends[$period] = [
            'period' => $period,
            'label' => $current->format('M Y'),
            'income' => 0,
            'expense' => 0
        ];
        $current->modify('+1 month');
    }

    // Fill in actual values
    foreach ($results as $row) {
        $period = $row['period'];
        if (isset($trends[$period])) {
            $trends[$period][$row['type']] = (float) $row['total'];
        }
    }

    return array_values($trends);
}

// ========================================
// Savings Bucket Functions
// ========================================

function getSavingsBuckets($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT * FROM savings_buckets
        WHERE user_id = ?
        ORDER BY is_active DESC, name ASC
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

function getSavingsBucket($userId, $bucketId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("SELECT * FROM savings_buckets WHERE id = ? AND user_id = ?");
    $stmt->execute([$bucketId, $userId]);
    return $stmt->fetch();
}

function createSavingsBucket($userId, $name, $icon = '💰', $color = null, $monthlyTarget = 0) {
    $pdo = Database::getInstance()->getPdo();

    // Auto-assign color from palette based on bucket count
    if (!$color) {
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM savings_buckets WHERE user_id = ?");
        $stmt->execute([$userId]);
        $count = $stmt->fetch()['count'];
        $color = CATEGORY_COLORS[$count % count(CATEGORY_COLORS)];
    }

    $stmt = $pdo->prepare("
        INSERT INTO savings_buckets (user_id, name, icon, color, monthly_target)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, trim($name), $icon, $color, $monthlyTarget]);
    return getSavingsBucket($userId, $pdo->lastInsertId());
}

function updateSavingsBucket($userId, $bucketId, $name, $icon, $monthlyTarget) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE savings_buckets
        SET name = ?, icon = ?, monthly_target = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([trim($name), $icon, $monthlyTarget, $bucketId, $userId]);
    return getSavingsBucket($userId, $bucketId);
}

function deleteSavingsBucket($userId, $bucketId) {
    $pdo = Database::getInstance()->getPdo();
    // Savings transactions will cascade delete
    // Linked regular transactions will have savings_bucket_id set to NULL
    $stmt = $pdo->prepare("DELETE FROM savings_buckets WHERE id = ? AND user_id = ?");
    $stmt->execute([$bucketId, $userId]);
    return $stmt->rowCount() > 0;
}

function toggleSavingsBucket($userId, $bucketId, $isActive) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE savings_buckets
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$isActive ? 1 : 0, $bucketId, $userId]);
    return getSavingsBucket($userId, $bucketId);
}

// ========================================
// Savings Transaction Functions
// ========================================

function getSavingsTransactions($userId, $bucketId = null, $limit = 100) {
    $pdo = Database::getInstance()->getPdo();

    if ($bucketId !== null) {
        $stmt = $pdo->prepare("
            SELECT st.*, sb.name as bucket_name, sb.icon as bucket_icon
            FROM savings_transactions st
            LEFT JOIN savings_buckets sb ON st.bucket_id = sb.id
            WHERE st.user_id = ? AND st.bucket_id = ?
            ORDER BY st.date DESC, st.created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$userId, $bucketId, $limit]);
    } else {
        $stmt = $pdo->prepare("
            SELECT st.*, sb.name as bucket_name, sb.icon as bucket_icon
            FROM savings_transactions st
            LEFT JOIN savings_buckets sb ON st.bucket_id = sb.id
            WHERE st.user_id = ?
            ORDER BY st.date DESC, st.created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$userId, $limit]);
    }

    return $stmt->fetchAll();
}

function getSavingsTransaction($userId, $transactionId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT st.*, sb.name as bucket_name, sb.icon as bucket_icon
        FROM savings_transactions st
        LEFT JOIN savings_buckets sb ON st.bucket_id = sb.id
        WHERE st.id = ? AND st.user_id = ?
    ");
    $stmt->execute([$transactionId, $userId]);
    return $stmt->fetch();
}

// Internal function - does not manage transactions (for use within other transactions)
function _addSavingsTransactionInternal($pdo, $userId, $bucketId, $amount, $type, $description, $date, $linkedTransactionId = null) {
    // Calculate balance change (allocations add, withdrawals subtract)
    $balanceChange = ($type === 'withdrawal') ? -abs($amount) : abs($amount);

    // Insert the savings transaction
    $stmt = $pdo->prepare("
        INSERT INTO savings_transactions (user_id, bucket_id, amount, type, description, date, linked_transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $bucketId, abs($amount), $type, $description, $date, $linkedTransactionId]);
    $transactionId = $pdo->lastInsertId();

    // Update bucket balance
    $stmt = $pdo->prepare("
        UPDATE savings_buckets
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$balanceChange, $bucketId, $userId]);

    return $transactionId;
}

function addSavingsTransaction($userId, $bucketId, $amount, $type, $description, $date, $linkedTransactionId = null) {
    $pdo = Database::getInstance()->getPdo();

    // Verify bucket exists and belongs to user
    $bucket = getSavingsBucket($userId, $bucketId);
    if (!$bucket) {
        return null;
    }

    $pdo->beginTransaction();
    try {
        $transactionId = _addSavingsTransactionInternal($pdo, $userId, $bucketId, $amount, $type, $description, $date, $linkedTransactionId);
        $pdo->commit();
        return getSavingsTransaction($userId, $transactionId);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// Internal function - does not manage transactions (for use within other transactions)
function _deleteSavingsTransactionInternal($pdo, $userId, $transactionId, $transaction) {
    // Calculate reverse balance change
    $balanceChange = ($transaction['type'] === 'withdrawal') ? abs($transaction['amount']) : -abs($transaction['amount']);

    // Delete the transaction
    $stmt = $pdo->prepare("DELETE FROM savings_transactions WHERE id = ? AND user_id = ?");
    $stmt->execute([$transactionId, $userId]);

    // Update bucket balance
    $stmt = $pdo->prepare("
        UPDATE savings_buckets
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$balanceChange, $transaction['bucket_id'], $userId]);

    return true;
}

function deleteSavingsTransaction($userId, $transactionId) {
    $pdo = Database::getInstance()->getPdo();

    // Get the transaction first to know the amount and type
    $transaction = getSavingsTransaction($userId, $transactionId);
    if (!$transaction) {
        return false;
    }

    $pdo->beginTransaction();
    try {
        _deleteSavingsTransactionInternal($pdo, $userId, $transactionId, $transaction);
        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// ========================================
// Monthly Allocation Functions
// ========================================

function getLastAllocationDate($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT MAX(date) as last_date
        FROM savings_transactions
        WHERE user_id = ? AND type = 'allocation' AND description LIKE 'Monthly allocation%'
    ");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();
    return $result['last_date'];
}

function generateMonthlyAllocations($userId) {
    $pdo = Database::getInstance()->getPdo();
    $today = date('Y-m-d');
    $currentMonth = date('Y-m');

    // Check if allocations already generated for this month
    $lastDate = getLastAllocationDate($userId);
    if ($lastDate && strpos($lastDate, $currentMonth) === 0) {
        return []; // Already allocated this month
    }

    // Get all active buckets with monthly_target > 0
    $stmt = $pdo->prepare("
        SELECT * FROM savings_buckets
        WHERE user_id = ? AND is_active = 1 AND monthly_target > 0
    ");
    $stmt->execute([$userId]);
    $buckets = $stmt->fetchAll();

    $generated = [];
    foreach ($buckets as $bucket) {
        $result = addSavingsTransaction(
            $userId,
            $bucket['id'],
            $bucket['monthly_target'],
            'allocation',
            'Monthly allocation',
            $today
        );
        if ($result) {
            $generated[] = $result;
        }
    }

    return $generated;
}

// ========================================
// Savings Summary Functions
// ========================================

function getSavingsSummary($userId) {
    $pdo = Database::getInstance()->getPdo();

    // Get total saved across all buckets
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(current_balance), 0) as total_saved
        FROM savings_buckets
        WHERE user_id = ? AND is_active = 1
    ");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();
    $totalSaved = (float) $result['total_saved'];

    // Get all-time balance (income - expense)
    $totals = getAllTimeTotals($userId);
    $allTimeBalance = $totals['income'] - $totals['expense'];

    // Available to spend = all-time balance - total saved in buckets
    $availableToSpend = $allTimeBalance - $totalSaved;

    return [
        'total_saved' => $totalSaved,
        'all_time_balance' => $allTimeBalance,
        'available_to_spend' => $availableToSpend
    ];
}

// ========================================
// Modified Transaction Functions for Savings
// ========================================

function createTransactionWithSavings($userId, $description, $amount, $categoryId, $type, $date, $savingsBucketId = null) {
    $pdo = Database::getInstance()->getPdo();

    // Get the category to validate and get a name for the legacy column
    $category = getCategory($userId, $categoryId);
    if (!$category) {
        return null;
    }

    // Validate category type matches transaction type
    if ($category['type'] !== $type) {
        return null;
    }

    // If savings bucket specified, validate it
    if ($savingsBucketId !== null) {
        $bucket = getSavingsBucket($userId, $savingsBucketId);
        if (!$bucket) {
            return null;
        }
        // Only expenses can be funded from savings
        if ($type !== 'expense') {
            $savingsBucketId = null;
        }
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO transactions (user_id, description, amount, category, category_id, type, date, savings_bucket_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $description, $amount, $category['name'], $categoryId, $type, $date, $savingsBucketId]);
        $transactionId = $pdo->lastInsertId();

        // If expense is funded from savings bucket, create a withdrawal
        if ($savingsBucketId !== null && $type === 'expense') {
            _addSavingsTransactionInternal(
                $pdo,
                $userId,
                $savingsBucketId,
                $amount,
                'withdrawal',
                "Expense: $description",
                $date,
                $transactionId
            );
        }

        $pdo->commit();
        return getTransaction($userId, $transactionId);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function updateTransactionWithSavings($userId, $transactionId, $description, $amount, $categoryId, $type, $date, $savingsBucketId = null) {
    $pdo = Database::getInstance()->getPdo();

    // Get the existing transaction
    $existingTransaction = getTransaction($userId, $transactionId);
    if (!$existingTransaction) {
        return null;
    }

    // Get the category to validate
    $category = getCategory($userId, $categoryId);
    if (!$category) {
        return null;
    }

    // Validate category type matches transaction type
    if ($category['type'] !== $type) {
        return null;
    }

    // If savings bucket specified, validate it
    if ($savingsBucketId !== null) {
        $bucket = getSavingsBucket($userId, $savingsBucketId);
        if (!$bucket) {
            return null;
        }
        // Only expenses can be funded from savings
        if ($type !== 'expense') {
            $savingsBucketId = null;
        }
    }

    $pdo->beginTransaction();
    try {
        // Remove old savings transaction if any was linked
        if ($existingTransaction['savings_bucket_id']) {
            // Find and delete the linked savings transaction
            $stmt = $pdo->prepare("
                SELECT st.*, sb.name as bucket_name, sb.icon as bucket_icon
                FROM savings_transactions st
                LEFT JOIN savings_buckets sb ON st.bucket_id = sb.id
                WHERE st.linked_transaction_id = ? AND st.user_id = ?
            ");
            $stmt->execute([$transactionId, $userId]);
            $linkedSavings = $stmt->fetch();
            if ($linkedSavings) {
                _deleteSavingsTransactionInternal($pdo, $userId, $linkedSavings['id'], $linkedSavings);
            }
        }

        // Update the transaction
        $stmt = $pdo->prepare("
            UPDATE transactions
            SET description = ?, amount = ?, category = ?, category_id = ?, type = ?, date = ?, savings_bucket_id = ?
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$description, $amount, $category['name'], $categoryId, $type, $date, $savingsBucketId, $transactionId, $userId]);

        // If expense is funded from savings bucket, create a new withdrawal
        if ($savingsBucketId !== null && $type === 'expense') {
            _addSavingsTransactionInternal(
                $pdo,
                $userId,
                $savingsBucketId,
                $amount,
                'withdrawal',
                "Expense: $description",
                $date,
                $transactionId
            );
        }

        $pdo->commit();
        return getTransaction($userId, $transactionId);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function deleteTransactionWithSavings($userId, $transactionId) {
    $pdo = Database::getInstance()->getPdo();

    // Get the existing transaction
    $existingTransaction = getTransaction($userId, $transactionId);
    if (!$existingTransaction) {
        return false;
    }

    $pdo->beginTransaction();
    try {
        // Remove linked savings transaction if any
        if ($existingTransaction['savings_bucket_id']) {
            $stmt = $pdo->prepare("
                SELECT st.*, sb.name as bucket_name, sb.icon as bucket_icon
                FROM savings_transactions st
                LEFT JOIN savings_buckets sb ON st.bucket_id = sb.id
                WHERE st.linked_transaction_id = ? AND st.user_id = ?
            ");
            $stmt->execute([$transactionId, $userId]);
            $linkedSavings = $stmt->fetch();
            if ($linkedSavings) {
                _deleteSavingsTransactionInternal($pdo, $userId, $linkedSavings['id'], $linkedSavings);
            }
        }

        // Delete the transaction
        $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?");
        $stmt->execute([$transactionId, $userId]);
        $result = $stmt->rowCount() > 0;

        $pdo->commit();
        return $result;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
