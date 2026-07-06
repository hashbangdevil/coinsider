<?php
// ========================================
// Coinsider - REST API
// ========================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Parse the request
$method = $_SERVER['REQUEST_METHOD'];

// Use query parameters for routing (works on all servers)
$resource = $_GET['resource'] ?? '';
$id = $_GET['id'] ?? null;

// Route the request
switch ($resource) {
    case 'categories':
        handleCategories($method, $id);
        break;
    case 'transactions':
        handleTransactions($method, $id);
        break;
    case 'recurring':
        handleRecurring($method, $id);
        break;
    case 'summary':
        handleSummary($method);
        break;
    case 'trends':
        handleTrends($method);
        break;
    case 'budget-comparison':
        handleBudgetComparison($method);
        break;
    case 'savings-buckets':
        handleSavingsBuckets($method, $id);
        break;
    case 'savings-transactions':
        handleSavingsTransactions($method, $id);
        break;
    case 'accounts':
        handleAccounts($method, $id);
        break;
    case 'account-transfers':
        handleAccountTransfers($method, $id);
        break;
    case 'import':
        handleImport($method);
        break;
    case '':
        $version = @file_get_contents(__DIR__ . '/../VERSION');
        jsonResponse(['message' => 'Coinsider API', 'version' => $version ? trim($version) : 'unknown']);
        break;
    default:
        errorResponse('Not found', 404);
}

// ========================================
// Category Handlers
// ========================================

function handleCategories($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];
    $yearMonth = date('Y-m');

    switch ($method) {
        case 'GET':
            if ($id) {
                $category = getCategory($userId, $id);
                if (!$category) {
                    errorResponse('Category not found', 404);
                }
                $category['spent'] = getCategorySpent($userId, $id, $yearMonth);
                jsonResponse($category);
            } else {
                // Optional filter by type
                $type = $_GET['type'] ?? null;
                if ($type && !in_array($type, ['income', 'expense'])) {
                    errorResponse('Type must be "income" or "expense"');
                }

                $categories = getCategories($userId, $type);

                // Add spent amount for each category
                foreach ($categories as &$category) {
                    $category['spent'] = getCategorySpent($userId, $category['id'], $yearMonth);
                }

                jsonResponse($categories);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['name']) || empty($data['type']) || empty($data['icon'])) {
                errorResponse('Name, type, and icon are required');
            }

            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            $monthlyBudget = isset($data['monthly_budget']) ? floatval($data['monthly_budget']) : 0;

            try {
                // Color is auto-assigned by createCategory
                $category = createCategory(
                    $userId,
                    trim($data['name']),
                    $data['type'],
                    trim($data['icon']),
                    null,
                    $monthlyBudget
                );
                $category['spent'] = 0;
                jsonResponse($category, 201);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'UNIQUE constraint') !== false) {
                    errorResponse('A category with this name already exists for this type');
                }
                throw $e;
            }
            break;

        case 'PUT':
            if (!$id) {
                errorResponse('Category ID is required');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['name']) || empty($data['icon'])) {
                errorResponse('Name and icon are required');
            }

            $monthlyBudget = isset($data['monthly_budget']) ? floatval($data['monthly_budget']) : 0;
            $type = isset($data['type']) ? $data['type'] : null;

            // Validate type if provided
            if ($type !== null && !in_array($type, ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            // Color is preserved (not editable)
            $category = updateCategory(
                $userId,
                $id,
                trim($data['name']),
                trim($data['icon']),
                $monthlyBudget,
                $type
            );

            if (!$category) {
                errorResponse('Cannot change category type while it has transactions', 400);
            }

            $category['spent'] = getCategorySpent($userId, $id, $yearMonth);
            jsonResponse($category);
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Category ID is required');
            }

            // Check if category exists first
            $category = getCategory($userId, $id);
            if (!$category) {
                errorResponse('Category not found', 404);
            }

            // Check if it has transactions
            if (categoryHasTransactions($userId, $id)) {
                errorResponse('Cannot delete category with existing transactions', 409);
            }

            $deleted = deleteCategory($userId, $id);
            if (!$deleted) {
                errorResponse('Failed to delete category', 500);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// Transaction Handlers
// ========================================

function handleTransactions($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    switch ($method) {
        case 'GET':
            // Generate pending recurring transactions on load
            generatePendingRecurringTransactions($userId);

            if ($id) {
                $transaction = getTransaction($userId, $id);
                if (!$transaction) {
                    errorResponse('Transaction not found', 404);
                }
                jsonResponse($transaction);
            } else {
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $categoryId = isset($_GET['category_id']) ? intval($_GET['category_id']) : null;
                $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
                $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
                $needsReview = isset($_GET['needs_review']) ? (intval($_GET['needs_review']) === 1) : null;

                // Use filtered query if any filter params are provided
                if ($categoryId !== null || $startDate !== null || $endDate !== null || $needsReview !== null) {
                    $transactions = getTransactionsFiltered($userId, $limit, $categoryId, $startDate, $endDate, $needsReview);
                } else {
                    $transactions = getTransactions($userId, $limit);
                }
                jsonResponse($transactions);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            // Support both category_id (new) and category (legacy)
            $hasCategoryId = isset($data['category_id']) && !empty($data['category_id']);
            $hasCategory = isset($data['category']) && !empty($data['category']);

            if (empty($data['description']) || !isset($data['amount']) ||
                (!$hasCategoryId && !$hasCategory) || empty($data['type']) || empty($data['date'])) {
                errorResponse('Description, amount, category_id (or category), type, and date are required');
            }

            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            // Check for optional savings bucket
            $savingsBucketId = isset($data['savings_bucket_id']) ? intval($data['savings_bucket_id']) : null;
            if ($savingsBucketId === 0) $savingsBucketId = null;

            // Account is required in the ledger model — default to the user's
            // first account when the client doesn't send one.
            $accountId = isset($data['account_id']) ? intval($data['account_id']) : null;
            if ($accountId === 0) $accountId = null;
            if ($accountId === null) $accountId = getDefaultAccountId($userId);

            if ($hasCategoryId) {
                // New flow with category_id (and optional savings bucket and account)
                $transaction = createTransactionWithAccount(
                    $userId,
                    trim($data['description']),
                    floatval($data['amount']),
                    intval($data['category_id']),
                    $data['type'],
                    $data['date'],
                    $savingsBucketId,
                    $accountId
                );

                if (!$transaction) {
                    errorResponse('Invalid category or category type mismatch');
                }
            } else {
                // Legacy flow with category string
                $transaction = createTransaction(
                    $userId,
                    trim($data['description']),
                    floatval($data['amount']),
                    trim($data['category']),
                    $data['type'],
                    $data['date']
                );
            }

            jsonResponse($transaction, 201);
            break;

        case 'PUT':
            if (!$id) {
                errorResponse('Transaction ID is required');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Confirm path: assign a category to an imported transaction and
            // clear its needs_review flag (used by the CSV import review queue).
            if (!empty($data['confirm'])) {
                $confirmCategoryId = isset($data['category_id']) ? intval($data['category_id']) : 0;
                if (!$confirmCategoryId) {
                    errorResponse('category_id is required to confirm');
                }
                $transaction = confirmTransaction($userId, $id, $confirmCategoryId);
                if (!$transaction) {
                    errorResponse('Transaction not found or invalid category');
                }
                jsonResponse($transaction);
            }

            // Support both category_id (new) and category (legacy)
            $hasCategoryId = isset($data['category_id']) && !empty($data['category_id']);
            $hasCategory = isset($data['category']) && !empty($data['category']);

            if (empty($data['description']) || !isset($data['amount']) ||
                (!$hasCategoryId && !$hasCategory) || empty($data['type']) || empty($data['date'])) {
                errorResponse('Description, amount, category_id (or category), type, and date are required');
            }

            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            // Check for optional savings bucket
            $savingsBucketId = isset($data['savings_bucket_id']) ? intval($data['savings_bucket_id']) : null;
            if ($savingsBucketId === 0) $savingsBucketId = null;

            // Account is required in the ledger model — default to the user's
            // first account when the client doesn't send one.
            $accountId = isset($data['account_id']) ? intval($data['account_id']) : null;
            if ($accountId === 0) $accountId = null;
            if ($accountId === null) $accountId = getDefaultAccountId($userId);

            if ($hasCategoryId) {
                // New flow with category_id (and optional savings bucket and account)
                $transaction = updateTransactionWithAccount(
                    $userId,
                    $id,
                    trim($data['description']),
                    floatval($data['amount']),
                    intval($data['category_id']),
                    $data['type'],
                    $data['date'],
                    $savingsBucketId,
                    $accountId
                );

                if (!$transaction) {
                    errorResponse('Transaction not found or invalid category');
                }
            } else {
                // Legacy flow with category string
                $transaction = updateTransaction(
                    $userId,
                    $id,
                    trim($data['description']),
                    floatval($data['amount']),
                    trim($data['category']),
                    $data['type'],
                    $data['date']
                );

                if (!$transaction) {
                    errorResponse('Transaction not found', 404);
                }
            }

            jsonResponse($transaction);
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Transaction ID is required');
            }

            $deleted = deleteTransactionWithAccount($userId, $id);
            if (!$deleted) {
                errorResponse('Transaction not found', 404);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// CSV Import Handler
// ========================================

function handleImport($method) {
    if ($method !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $userId = $user['id'];

    $data = json_decode(file_get_contents('php://input'), true);
    $accountId = (isset($data['account_id']) && !empty($data['account_id'])) ? intval($data['account_id']) : null;
    if ($accountId === null) $accountId = getDefaultAccountId($userId);
    $items = $data['transactions'] ?? null;

    if (!is_array($items) || count($items) === 0) {
        errorResponse('No transactions to import');
    }
    if (count($items) > 5000) {
        errorResponse('Too many rows in a single import (max 5000)');
    }

    $count = importTransactions($userId, $accountId, $items);
    if ($count === null) {
        errorResponse('Invalid account', 400);
    }

    jsonResponse(['success' => true, 'imported' => $count], 201);
}

// ========================================
// Recurring Transaction Handlers
// ========================================

function handleRecurring($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    switch ($method) {
        case 'GET':
            // Check for upcoming filter
            if (isset($_GET['upcoming'])) {
                $days = isset($_GET['days']) ? intval($_GET['days']) : 7;
                $days = max(1, min($days, 365)); // Clamp between 1 and 365 days
                $upcoming = getUpcomingRecurringTransactions($userId, $days);
                jsonResponse($upcoming);
                break;
            }

            if ($id) {
                $recurring = getRecurringTransaction($userId, $id);
                if (!$recurring) {
                    errorResponse('Recurring transaction not found', 404);
                }
                jsonResponse($recurring);
            } else {
                $recurring = getRecurringTransactions($userId);
                jsonResponse($recurring);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            // Check for generate action
            if (isset($data['action']) && $data['action'] === 'generate') {
                $generated = generatePendingRecurringTransactions($userId);
                jsonResponse(['generated' => $generated, 'count' => count($generated)]);
                break;
            }

            // Validate required fields
            if (empty($data['description']) || !isset($data['amount']) || empty($data['category_id']) ||
                empty($data['type']) || empty($data['frequency']) || empty($data['start_date'])) {
                errorResponse('Description, amount, category_id, type, frequency, and start_date are required');
            }

            // Validate type
            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            // Validate frequency
            if (!in_array($data['frequency'], ['monthly', 'yearly'])) {
                errorResponse('Frequency must be "monthly" or "yearly"');
            }

            // Validate category belongs to user and matches type
            $category = getCategory($userId, $data['category_id']);
            if (!$category) {
                errorResponse('Invalid category');
            }
            if ($category['type'] !== $data['type']) {
                errorResponse('Category type must match transaction type');
            }

            $endDate = isset($data['end_date']) && !empty($data['end_date']) ? $data['end_date'] : null;
            $skipFirst = isset($data['skip_first']) && $data['skip_first'] === true;

            // Validate end_date >= start_date
            if ($endDate !== null && $endDate < $data['start_date']) {
                errorResponse('End date must be on or after start date');
            }

            $recurring = createRecurringTransaction(
                $userId,
                trim($data['description']),
                floatval($data['amount']),
                intval($data['category_id']),
                $data['type'],
                $data['frequency'],
                $data['start_date'],
                $endDate,
                $skipFirst
            );

            if (!$recurring) {
                errorResponse('Failed to create recurring transaction');
            }

            jsonResponse($recurring, 201);
            break;

        case 'PUT':
            if (!$id) {
                errorResponse('Recurring transaction ID is required');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Check for action (pause/resume)
            if (isset($data['action'])) {
                switch ($data['action']) {
                    case 'pause':
                        $recurring = pauseRecurringTransaction($userId, $id);
                        if (!$recurring) {
                            errorResponse('Recurring transaction not found', 404);
                        }
                        jsonResponse($recurring);
                        break;

                    case 'resume':
                        $recurring = resumeRecurringTransaction($userId, $id);
                        if (!$recurring) {
                            errorResponse('Recurring transaction not found', 404);
                        }
                        jsonResponse($recurring);
                        break;

                    default:
                        errorResponse('Invalid action. Use "pause" or "resume"');
                }
                break;
            }

            // Regular update
            if (empty($data['description']) || !isset($data['amount']) || empty($data['category_id']) ||
                empty($data['type']) || empty($data['frequency']) || empty($data['start_date'])) {
                errorResponse('Description, amount, category_id, type, frequency, and start_date are required');
            }

            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            if (!in_array($data['frequency'], ['monthly', 'yearly'])) {
                errorResponse('Frequency must be "monthly" or "yearly"');
            }

            $category = getCategory($userId, $data['category_id']);
            if (!$category) {
                errorResponse('Invalid category');
            }
            if ($category['type'] !== $data['type']) {
                errorResponse('Category type must match transaction type');
            }

            $endDate = isset($data['end_date']) && !empty($data['end_date']) ? $data['end_date'] : null;

            if ($endDate !== null && $endDate < $data['start_date']) {
                errorResponse('End date must be on or after start date');
            }

            $recurring = updateRecurringTransaction(
                $userId,
                $id,
                trim($data['description']),
                floatval($data['amount']),
                intval($data['category_id']),
                $data['type'],
                $data['frequency'],
                $data['start_date'],
                $endDate
            );

            if (!$recurring) {
                errorResponse('Failed to update recurring transaction or not found', 404);
            }

            jsonResponse($recurring);
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Recurring transaction ID is required');
            }

            $deleted = deleteRecurringTransaction($userId, $id);
            if (!$deleted) {
                errorResponse('Recurring transaction not found', 404);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// Summary Handler
// ========================================

function handleSummary($method) {
    if ($method !== 'GET') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $userId = $user['id'];

    // Support period parameter: this-month, last-month, this-year, last-year, all-time, custom
    $period = $_GET['period'] ?? 'this-month';

    $now = new DateTime();
    $periodLabel = '';

    switch ($period) {
        case 'this-month':
            $yearMonth = $now->format('Y-m');
            $totals = getMonthlyTotals($userId, $yearMonth);
            $categoryTotals = getCategoryTotalsWithDetails($userId, $yearMonth);
            $periodLabel = $now->format('F Y');
            break;

        case 'last-month':
            $lastMonth = (clone $now)->modify('-1 month');
            $yearMonth = $lastMonth->format('Y-m');
            $totals = getMonthlyTotals($userId, $yearMonth);
            $categoryTotals = getCategoryTotalsWithDetails($userId, $yearMonth);
            $periodLabel = $lastMonth->format('F Y');
            break;

        case 'this-year':
            $year = $now->format('Y');
            $totals = getYearlyTotals($userId, $year);
            $categoryTotals = getCategoryTotalsForYear($userId, $year);
            $periodLabel = $year;
            break;

        case 'last-year':
            $lastYear = (clone $now)->modify('-1 year');
            $year = $lastYear->format('Y');
            $totals = getYearlyTotals($userId, $year);
            $categoryTotals = getCategoryTotalsForYear($userId, $year);
            $periodLabel = $year;
            break;

        case 'all-time':
            $totals = getAllTimeTotals($userId);
            $categoryTotals = getCategoryTotalsAllTime($userId);
            $periodLabel = 'All Time';
            break;

        case 'custom':
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;

            if (!$startDate || !$endDate) {
                errorResponse('Custom period requires start_date and end_date parameters');
            }

            // Validate date format
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
                errorResponse('Invalid date format. Use YYYY-MM-DD');
            }

            $totals = getCustomRangeTotals($userId, $startDate, $endDate);
            $categoryTotals = getCategoryTotalsForDateRange($userId, $startDate, $endDate);

            $startDt = new DateTime($startDate);
            $endDt = new DateTime($endDate);
            $periodLabel = $startDt->format('M j, Y') . ' - ' . $endDt->format('M j, Y');
            break;

        default:
            // Fallback: treat as month format (YYYY-MM) for backward compatibility
            if (preg_match('/^\d{4}-\d{2}$/', $period)) {
                $totals = getMonthlyTotals($userId, $period);
                $categoryTotals = getCategoryTotalsWithDetails($userId, $period);
                $periodLabel = $period;
            } else {
                errorResponse('Invalid period. Use: this-month, last-month, this-year, last-year, all-time, custom');
            }
    }

    // Include savings summary
    $savingsSummary = getSavingsSummary($userId);

    jsonResponse([
        'period' => $period,
        'periodLabel' => $periodLabel,
        'income' => $totals['income'],
        'expense' => $totals['expense'],
        'balance' => $totals['income'] - $totals['expense'],
        'categories' => $categoryTotals,
        'savings' => $savingsSummary
    ]);
}

// ========================================
// Trends Handler
// ========================================

function handleTrends($method) {
    if ($method !== 'GET') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $userId = $user['id'];

    $type = $_GET['type'] ?? 'both';
    $granularity = $_GET['granularity'] ?? 'monthly';
    $months = isset($_GET['months']) ? intval($_GET['months']) : 12;
    $categoryId = isset($_GET['category_id']) ? intval($_GET['category_id']) : null;

    // Validate type
    if (!in_array($type, ['income', 'expense', 'both'])) {
        errorResponse('Type must be income, expense, or both');
    }

    // Clamp months
    $months = max(1, min($months, 24));

    $trends = getTrends($userId, $type, $granularity, $months, $categoryId);

    jsonResponse([
        'type' => $type,
        'granularity' => $granularity,
        'months' => $months,
        'data' => $trends
    ]);
}

// ========================================
// Budget Comparison Handler
// ========================================

function handleBudgetComparison($method) {
    if ($method !== 'GET') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $userId = $user['id'];

    $period = $_GET['period'] ?? 'this-month';

    $now = new DateTime();

    switch ($period) {
        case 'this-month':
            $yearMonth = $now->format('Y-m');
            $categories = getCategoryTotalsWithDetails($userId, $yearMonth);
            $multiplier = 1;
            break;

        case 'last-month':
            $lastMonth = (clone $now)->modify('-1 month');
            $yearMonth = $lastMonth->format('Y-m');
            $categories = getCategoryTotalsWithDetails($userId, $yearMonth);
            $multiplier = 1;
            break;

        case 'this-year':
            $year = $now->format('Y');
            $categories = getCategoryTotalsForYear($userId, $year);
            $multiplier = 12;
            break;

        case 'last-year':
            $lastYear = (clone $now)->modify('-1 year');
            $year = $lastYear->format('Y');
            $categories = getCategoryTotalsForYear($userId, $year);
            $multiplier = 12;
            break;

        case 'custom':
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;

            if (!$startDate || !$endDate) {
                errorResponse('Custom period requires start_date and end_date parameters');
            }

            $categories = getCategoryTotalsForDateRange($userId, $startDate, $endDate);

            // Calculate months for budget comparison
            $start = new DateTime($startDate);
            $end = new DateTime($endDate);
            $interval = $start->diff($end);
            $multiplier = max(1, ($interval->y * 12) + $interval->m + ($interval->d > 0 ? 1 : 0));
            break;

        default:
            $categories = getCategoryTotalsWithDetails($userId, $now->format('Y-m'));
            $multiplier = 1;
    }

    // Calculate comparison data
    $comparison = [];
    foreach ($categories as $cat) {
        $budget = (float) ($cat['monthly_budget'] ?? 0) * $multiplier;
        $spent = (float) ($cat['spent'] ?? 0);
        $variance = $budget - $spent;
        $percentage = $budget > 0 ? round(($spent / $budget) * 100, 1) : 0;

        $comparison[] = [
            'id' => $cat['id'],
            'name' => $cat['name'],
            'icon' => $cat['icon'],
            'color' => $cat['color'],
            'budget' => $budget,
            'spent' => $spent,
            'variance' => $variance,
            'percentage' => $percentage
        ];
    }

    jsonResponse([
        'period' => $period,
        'categories' => $comparison
    ]);
}

// ========================================
// Savings Buckets Handler
// ========================================

function handleSavingsBuckets($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    // Check if monthly allocations are needed (on GET requests)
    if ($method === 'GET') {
        $today = date('Y-m-d');
        $currentMonth = date('Y-m');
        $lastAllocationDate = getLastAllocationDate($userId);

        // If it's a new month and allocations haven't been generated
        if (!$lastAllocationDate || strpos($lastAllocationDate, $currentMonth) !== 0) {
            // Only auto-allocate on or after the 1st of the month
            if (date('d') >= 1) {
                generateMonthlyAllocations($userId);
            }
        }
    }

    switch ($method) {
        case 'GET':
            if ($id) {
                $bucket = getSavingsBucket($userId, $id);
                if (!$bucket) {
                    errorResponse('Savings bucket not found', 404);
                }
                // Include recent transactions for this bucket
                $bucket['transactions'] = getSavingsTransactions($userId, $id, 20);
                jsonResponse($bucket);
            } else {
                $buckets = getSavingsBuckets($userId);
                // Also return savings summary
                $summary = getSavingsSummary($userId);
                jsonResponse([
                    'buckets' => $buckets,
                    'summary' => $summary
                ]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            // Check for manual allocation action
            if (isset($data['action']) && $data['action'] === 'allocate') {
                $generated = generateMonthlyAllocations($userId);
                jsonResponse(['generated' => $generated, 'count' => count($generated)]);
                break;
            }

            if (empty($data['name'])) {
                errorResponse('Name is required');
            }

            $icon = isset($data['icon']) ? trim($data['icon']) : '💰';
            $color = isset($data['color']) ? $data['color'] : null;
            $monthlyTarget = isset($data['monthly_target']) ? floatval($data['monthly_target']) : 0;

            try {
                $bucket = createSavingsBucket($userId, $data['name'], $icon, $color, $monthlyTarget);
                jsonResponse($bucket, 201);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'UNIQUE constraint') !== false) {
                    errorResponse('A savings bucket with this name already exists');
                }
                throw $e;
            }
            break;

        case 'PUT':
            if (!$id) {
                errorResponse('Bucket ID is required');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            // Check for toggle action
            if (isset($data['action'])) {
                switch ($data['action']) {
                    case 'activate':
                        $bucket = toggleSavingsBucket($userId, $id, true);
                        if (!$bucket) {
                            errorResponse('Savings bucket not found', 404);
                        }
                        jsonResponse($bucket);
                        break;

                    case 'deactivate':
                        $bucket = toggleSavingsBucket($userId, $id, false);
                        if (!$bucket) {
                            errorResponse('Savings bucket not found', 404);
                        }
                        jsonResponse($bucket);
                        break;

                    default:
                        errorResponse('Invalid action. Use "activate" or "deactivate"');
                }
                break;
            }

            if (empty($data['name'])) {
                errorResponse('Name is required');
            }

            $icon = isset($data['icon']) ? trim($data['icon']) : '💰';
            $monthlyTarget = isset($data['monthly_target']) ? floatval($data['monthly_target']) : 0;

            try {
                $bucket = updateSavingsBucket($userId, $id, $data['name'], $icon, $monthlyTarget);
                if (!$bucket) {
                    errorResponse('Savings bucket not found', 404);
                }
                jsonResponse($bucket);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'UNIQUE constraint') !== false) {
                    errorResponse('A savings bucket with this name already exists');
                }
                throw $e;
            }
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Bucket ID is required');
            }

            $bucket = getSavingsBucket($userId, $id);
            if (!$bucket) {
                errorResponse('Savings bucket not found', 404);
            }

            $deleted = deleteSavingsBucket($userId, $id);
            if (!$deleted) {
                errorResponse('Failed to delete savings bucket', 500);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// Savings Transactions Handler
// ========================================

function handleSavingsTransactions($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    switch ($method) {
        case 'GET':
            if ($id) {
                $transaction = getSavingsTransaction($userId, $id);
                if (!$transaction) {
                    errorResponse('Savings transaction not found', 404);
                }
                jsonResponse($transaction);
            } else {
                $bucketId = isset($_GET['bucket_id']) ? intval($_GET['bucket_id']) : null;
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $transactions = getSavingsTransactions($userId, $bucketId, $limit);
                jsonResponse($transactions);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['bucket_id']) || !isset($data['amount']) || empty($data['type'])) {
                errorResponse('bucket_id, amount, and type are required');
            }

            if (!in_array($data['type'], ['allocation', 'withdrawal', 'adjustment'])) {
                errorResponse('Type must be "allocation", "withdrawal", or "adjustment"');
            }

            $amount = floatval($data['amount']);
            if ($amount <= 0) {
                errorResponse('Amount must be greater than 0');
            }

            $description = isset($data['description']) ? trim($data['description']) : null;
            $date = isset($data['date']) ? $data['date'] : date('Y-m-d');
            $linkedTransactionId = isset($data['linked_transaction_id']) ? intval($data['linked_transaction_id']) : null;

            $transaction = addSavingsTransaction(
                $userId,
                intval($data['bucket_id']),
                $amount,
                $data['type'],
                $description,
                $date,
                $linkedTransactionId
            );

            if (!$transaction) {
                errorResponse('Invalid bucket or failed to create transaction');
            }

            jsonResponse($transaction, 201);
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Transaction ID is required');
            }

            $deleted = deleteSavingsTransaction($userId, $id);
            if (!$deleted) {
                errorResponse('Savings transaction not found', 404);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// Accounts Handler
// ========================================

function handleAccounts($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    switch ($method) {
        case 'GET':
            if ($id) {
                $account = getAccount($userId, $id);
                if (!$account) {
                    errorResponse('Account not found', 404);
                }
                jsonResponse($account);
            } else {
                $accounts = getAccounts($userId);
                $totalBalance = getTotalAccountsBalance($userId);
                $moduleEnabled = isAccountsModuleEnabled($userId);
                jsonResponse([
                    'accounts' => $accounts,
                    'total_balance' => $totalBalance,
                    'module_enabled' => $moduleEnabled
                ]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['name']) || empty($data['type'])) {
                errorResponse('Name and type are required');
            }

            $validTypes = ['bank', 'credit_card', 'cash', 'savings', 'ewallet', 'investment', 'other'];
            if (!in_array($data['type'], $validTypes)) {
                errorResponse('Invalid account type');
            }

            $icon = isset($data['icon']) ? trim($data['icon']) : '🏦';
            $color = isset($data['color']) ? $data['color'] : null;
            $startingBalance = isset($data['starting_balance']) ? floatval($data['starting_balance']) : 0;

            try {
                $account = createAccount($userId, $data['name'], $data['type'], $icon, $color, $startingBalance);
                jsonResponse($account, 201);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'UNIQUE constraint') !== false) {
                    errorResponse('An account with this name already exists');
                }
                throw $e;
            }
            break;

        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);

            // Check for module toggle action (no ID required)
            if (isset($data['action'])) {
                switch ($data['action']) {
                    case 'enable':
                        enableAccountsModule($userId);
                        jsonResponse(['success' => true, 'module_enabled' => true]);
                        break;
                    case 'disable':
                        disableAccountsModule($userId);
                        jsonResponse(['success' => true, 'module_enabled' => false]);
                        break;
                    case 'activate':
                        if (!$id) {
                            errorResponse('Account ID is required');
                        }
                        $account = updateAccount($userId, $id, ['is_active' => true]);
                        if (!$account) {
                            errorResponse('Account not found', 404);
                        }
                        jsonResponse($account);
                        break;
                    case 'deactivate':
                        if (!$id) {
                            errorResponse('Account ID is required');
                        }
                        $account = updateAccount($userId, $id, ['is_active' => false]);
                        if (!$account) {
                            errorResponse('Account not found', 404);
                        }
                        jsonResponse($account);
                        break;
                    default:
                        errorResponse('Invalid action');
                }
                break;
            }

            if (!$id) {
                errorResponse('Account ID is required');
            }

            if (empty($data['name'])) {
                errorResponse('Name is required');
            }

            if (isset($data['type'])) {
                $validTypes = ['bank', 'credit_card', 'cash', 'savings', 'ewallet', 'investment', 'other'];
                if (!in_array($data['type'], $validTypes)) {
                    errorResponse('Invalid account type');
                }
            }

            try {
                $account = updateAccount($userId, $id, $data);
                if (!$account) {
                    errorResponse('Account not found', 404);
                }
                jsonResponse($account);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'UNIQUE constraint') !== false) {
                    errorResponse('An account with this name already exists');
                }
                throw $e;
            }
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Account ID is required');
            }

            $account = getAccount($userId, $id);
            if (!$account) {
                errorResponse('Account not found', 404);
            }

            if (accountHasTransactions($userId, $id)) {
                errorResponse('Cannot delete account with linked transactions. Remove or reassign transactions first.', 409);
            }

            $deleted = deleteAccount($userId, $id);
            if (!$deleted) {
                errorResponse('Failed to delete account', 500);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}

// ========================================
// Account Transfers Handler
// ========================================

function handleAccountTransfers($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];

    switch ($method) {
        case 'GET':
            if ($id) {
                $transfer = getAccountTransfer($userId, $id);
                if (!$transfer) {
                    errorResponse('Transfer not found', 404);
                }
                jsonResponse($transfer);
            } else {
                $accountId = isset($_GET['account_id']) ? intval($_GET['account_id']) : null;
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $transfers = getAccountTransfers($userId, $accountId, $limit);
                jsonResponse($transfers);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['from_account_id']) || empty($data['to_account_id']) || !isset($data['amount']) || empty($data['date'])) {
                errorResponse('from_account_id, to_account_id, amount, and date are required');
            }

            $amount = floatval($data['amount']);
            if ($amount <= 0) {
                errorResponse('Amount must be greater than 0');
            }

            if ($data['from_account_id'] == $data['to_account_id']) {
                errorResponse('Cannot transfer to the same account');
            }

            $description = isset($data['description']) ? trim($data['description']) : null;

            $transfer = createAccountTransfer(
                $userId,
                intval($data['from_account_id']),
                intval($data['to_account_id']),
                $amount,
                $description,
                $data['date']
            );

            if (!$transfer) {
                errorResponse('Invalid account(s) or failed to create transfer');
            }

            jsonResponse($transfer, 201);
            break;

        case 'DELETE':
            if (!$id) {
                errorResponse('Transfer ID is required');
            }

            $deleted = deleteAccountTransfer($userId, $id);
            if (!$deleted) {
                errorResponse('Transfer not found', 404);
            }

            jsonResponse(['success' => true]);
            break;

        default:
            errorResponse('Method not allowed', 405);
    }
}
