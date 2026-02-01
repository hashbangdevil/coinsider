<?php
// ========================================
// Coinsider - Configuration
// ========================================

// Error reporting (set to 0 in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Ensure JSON error responses
set_exception_handler(function($e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    exit;
});

set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.gc_maxlifetime', 60 * 60 * 24 * 30); // 30 days
// Set secure cookie if on HTTPS
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', 1);
}

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ========================================
// DATABASE CONFIGURATION  
// ========================================

// Path to SQLite database file
define('DB_PATH', __DIR__ . '/../data/budget.db');

// ========================================
// APP CONFIGURATION
// ========================================

// App name
define('APP_NAME', 'Coinsider');

// Base URL of your app (no trailing slash)
define('APP_URL', 'http://localhost:8888');

// Session lifetime in seconds (default: 30 days)
define('SESSION_LIFETIME', 60 * 60 * 24 * 30);

// Password reset token expiry (default: 1 hour)
define('RESET_TOKEN_EXPIRY', 60 * 60);

// Minimum password length
define('MIN_PASSWORD_LENGTH', 6);

// ========================================
// EMAIL CONFIGURATION (for password reset)
// ========================================

// Set to true to enable email sending
// When false, reset links are shown directly (for development)
define('EMAIL_ENABLED', false);

// Email settings (configure for production)
define('MAIL_FROM', 'noreply@example.com');
define('MAIL_FROM_NAME', APP_NAME);

// ========================================
// SECURITY - CORS
// ========================================

$allowed_origins = [
    'http://localhost:8000',
    'http://localhost',
    // Add your production domain:
    // 'https://yourdomain.com',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function errorResponse($message, $statusCode = 400) {
    jsonResponse(['error' => $message], $statusCode);
}

function getCurrentUser() {
    return $_SESSION['user'] ?? null;
}

function requireAuth() {
    $user = getCurrentUser();
    if (!$user) {
        errorResponse('Unauthorized', 401);
    }
    return $user;
}

function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function generateToken($length = 32) {
    return bin2hex(random_bytes($length));
}
