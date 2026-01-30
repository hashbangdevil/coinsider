<?php
// ========================================
// Budget Manager - REST API
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
    case '':
        jsonResponse(['message' => 'Budget Manager API', 'version' => '1.0']);
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

                // Use filtered query if any filter params are provided
                if ($categoryId !== null || $startDate !== null || $endDate !== null) {
                    $transactions = getTransactionsFiltered($userId, $limit, $categoryId, $startDate, $endDate);
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

            if ($hasCategoryId) {
                // New flow with category_id
                $transaction = createTransactionWithCategoryId(
                    $userId,
                    trim($data['description']),
                    floatval($data['amount']),
                    intval($data['category_id']),
                    $data['type'],
                    $data['date']
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

            if ($hasCategoryId) {
                // New flow with category_id
                $transaction = updateTransactionWithCategoryId(
                    $userId,
                    $id,
                    trim($data['description']),
                    floatval($data['amount']),
                    intval($data['category_id']),
                    $data['type'],
                    $data['date']
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

            $deleted = deleteTransaction($userId, $id);
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

    jsonResponse([
        'period' => $period,
        'periodLabel' => $periodLabel,
        'income' => $totals['income'],
        'expense' => $totals['expense'],
        'balance' => $totals['income'] - $totals['expense'],
        'categories' => $categoryTotals
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
