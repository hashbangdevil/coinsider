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
    case 'budgets':
        handleBudgets($method, $id);
        break;
    case 'transactions':
        handleTransactions($method, $id);
        break;
    case 'summary':
        handleSummary($method);
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

            if (empty($data['name']) || empty($data['type']) ||
                empty($data['icon']) || empty($data['color'])) {
                errorResponse('Name, type, icon, and color are required');
            }

            if (!in_array($data['type'], ['income', 'expense'])) {
                errorResponse('Type must be "income" or "expense"');
            }

            $monthlyBudget = isset($data['monthly_budget']) ? floatval($data['monthly_budget']) : 0;

            try {
                $category = createCategory(
                    $userId,
                    trim($data['name']),
                    $data['type'],
                    trim($data['icon']),
                    trim($data['color']),
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

            if (empty($data['name']) || empty($data['icon']) || empty($data['color'])) {
                errorResponse('Name, icon, and color are required');
            }

            $monthlyBudget = isset($data['monthly_budget']) ? floatval($data['monthly_budget']) : 0;

            $category = updateCategory(
                $userId,
                $id,
                trim($data['name']),
                trim($data['icon']),
                trim($data['color']),
                $monthlyBudget
            );

            if (!$category) {
                errorResponse('Category not found', 404);
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
// Budget Handlers
// ========================================

function handleBudgets($method, $id) {
    $user = requireAuth();
    $userId = $user['id'];
    
    switch ($method) {
        case 'GET':
            if ($id) {
                $budget = getBudget($userId, $id);
                if (!$budget) {
                    errorResponse('Budget not found', 404);
                }
                $yearMonth = date('Y-m');
                $budget['spent'] = getBudgetSpent($userId, $budget['category'], $yearMonth);
                jsonResponse($budget);
            } else {
                $budgets = getBudgets($userId);
                $yearMonth = date('Y-m');
                
                foreach ($budgets as &$budget) {
                    $budget['spent'] = getBudgetSpent($userId, $budget['category'], $yearMonth);
                }
                
                jsonResponse($budgets);
            }
            break;
            
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name']) || !isset($data['amount']) || empty($data['category'])) {
                errorResponse('Name, amount, and category are required');
            }
            
            $budget = createBudget(
                $userId,
                trim($data['name']),
                floatval($data['amount']),
                trim($data['category'])
            );
            
            $budget['spent'] = 0;
            jsonResponse($budget, 201);
            break;
            
        case 'PUT':
            if (!$id) {
                errorResponse('Budget ID is required');
            }
            
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name']) || !isset($data['amount']) || empty($data['category'])) {
                errorResponse('Name, amount, and category are required');
            }
            
            $budget = updateBudget(
                $userId,
                $id,
                trim($data['name']),
                floatval($data['amount']),
                trim($data['category'])
            );
            
            if (!$budget) {
                errorResponse('Budget not found', 404);
            }
            
            $yearMonth = date('Y-m');
            $budget['spent'] = getBudgetSpent($userId, $budget['category'], $yearMonth);
            jsonResponse($budget);
            break;
            
        case 'DELETE':
            if (!$id) {
                errorResponse('Budget ID is required');
            }
            
            $deleted = deleteBudget($userId, $id);
            if (!$deleted) {
                errorResponse('Budget not found', 404);
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
            if ($id) {
                $transaction = getTransaction($userId, $id);
                if (!$transaction) {
                    errorResponse('Transaction not found', 404);
                }
                jsonResponse($transaction);
            } else {
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $transactions = getTransactions($userId, $limit);
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
// Summary Handler
// ========================================

function handleSummary($method) {
    if ($method !== 'GET') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $userId = $user['id'];

    $yearMonth = $_GET['month'] ?? date('Y-m');

    if (!preg_match('/^\d{4}-\d{2}$/', $yearMonth)) {
        errorResponse('Invalid month format. Use YYYY-MM');
    }

    $totals = getMonthlyTotals($userId, $yearMonth);

    // Use new function that includes category details with budget info
    $categoryTotals = getCategoryTotalsWithDetails($userId, $yearMonth);

    jsonResponse([
        'month' => $yearMonth,
        'income' => $totals['income'],
        'expense' => $totals['expense'],
        'balance' => $totals['income'] - $totals['expense'],
        'categories' => $categoryTotals
    ]);
}
