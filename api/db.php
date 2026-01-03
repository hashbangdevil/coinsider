<?php
// ========================================
// Budget Manager - Database Module
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

        // Budgets table
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");

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

        // Indexes
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)");
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
// Budget Functions
// ========================================

function getBudgets($userId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT * FROM budgets 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

function getBudget($userId, $budgetId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("SELECT * FROM budgets WHERE id = ? AND user_id = ?");
    $stmt->execute([$budgetId, $userId]);
    return $stmt->fetch();
}

function createBudget($userId, $name, $amount, $category) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        INSERT INTO budgets (user_id, name, amount, category) 
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $name, $amount, $category]);
    return getBudget($userId, $pdo->lastInsertId());
}

function updateBudget($userId, $budgetId, $name, $amount, $category) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE budgets 
        SET name = ?, amount = ?, category = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$name, $amount, $category, $budgetId, $userId]);
    return getBudget($userId, $budgetId);
}

function deleteBudget($userId, $budgetId) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("DELETE FROM budgets WHERE id = ? AND user_id = ?");
    $stmt->execute([$budgetId, $userId]);
    return $stmt->rowCount() > 0;
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
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
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
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
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

// Legacy function - keep for backward compatibility
function getCategoryTotals($userId, $yearMonth) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT
            category,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
        GROUP BY category
        ORDER BY total DESC
    ");
    $stmt->execute([$userId, $yearMonth]);
    return $stmt->fetchAll();
}

function getBudgetSpent($userId, $category, $yearMonth) {
    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) as spent
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND category = ? AND strftime('%Y-%m', date) = ?
    ");
    $stmt->execute([$userId, $category, $yearMonth]);
    $result = $stmt->fetch();
    return (float) $result['spent'];
}
