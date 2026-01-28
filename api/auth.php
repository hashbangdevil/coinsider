<?php
// ========================================
// Budget Manager - Authentication Handler
// ========================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Get action from request
$action = $_GET['action'] ?? $_POST['action'] ?? 'status';

switch ($action) {
    case 'signup':
        handleSignup();
        break;
    case 'login':
        handleLogin();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'forgot-password':
        handleForgotPassword();
        break;
    case 'reset-password':
        handleResetPassword();
        break;
    case 'change-password':
        handleChangePassword();
        break;
    case 'update-settings':
        handleUpdateSettings();
        break;
    case 'status':
    default:
        handleStatus();
        break;
}

// ========================================
// Sign Up
// ========================================

function handleSignup() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? '';
    $name = $input['name'] ?? '';
    $password = $input['password'] ?? '';
    
    // Validate email
    if (empty($email) || !isValidEmail($email)) {
        errorResponse('Please enter a valid email address');
    }
    
    // Validate name
    if (empty($name) || strlen(trim($name)) < 2) {
        errorResponse('Please enter your name (at least 2 characters)');
    }
    
    // Validate password
    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        errorResponse('Password must be at least ' . MIN_PASSWORD_LENGTH . ' characters');
    }
    
    // Check if email already exists
    $existingUser = findUserByEmail($email);
    if ($existingUser) {
        errorResponse('An account with this email already exists');
    }
    
    // Create user
    $user = createUser($email, $name, $password);

    if (!$user) {
        errorResponse('Failed to create account', 500);
    }

    // Seed default categories for new user
    seedDefaultCategories($user['id']);

    // Log them in
    setUserSession($user);
    
    jsonResponse([
        'success' => true,
        'message' => 'Account created successfully',
        'user' => sanitizeUser($user)
    ], 201);
}

// ========================================
// Login
// ========================================

function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    
    // Validate input
    if (empty($email) || empty($password)) {
        errorResponse('Email and password are required');
    }
    
    // Find user
    $user = findUserByEmail($email);
    
    if (!$user) {
        // Use generic message to prevent email enumeration
        errorResponse('Invalid email or password', 401);
    }
    
    // Verify password
    if (!verifyPassword($user, $password)) {
        errorResponse('Invalid email or password', 401);
    }

    // Migrate user categories if needed (for existing users)
    migrateUserCategories($user['id']);

    // Set session
    setUserSession($user);
    
    jsonResponse([
        'success' => true,
        'message' => 'Login successful',
        'user' => sanitizeUser($user)
    ]);
}

// ========================================
// Logout
// ========================================

function handleLogout() {
    $_SESSION = [];
    
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => isset($_SERVER['HTTPS'])
        ]);
    }
    
    session_destroy();
    
    jsonResponse(['success' => true, 'message' => 'Logged out successfully']);
}

// ========================================
// Forgot Password
// ========================================

function handleForgotPassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
    
    if (empty($email) || !isValidEmail($email)) {
        errorResponse('Please enter a valid email address');
    }
    
    $user = findUserByEmail($email);
    
    // Always return success to prevent email enumeration
    $response = [
        'success' => true,
        'message' => 'If an account exists with this email, you will receive password reset instructions.'
    ];
    
    if ($user) {
        // Generate reset token
        $token = generateToken();
        $expires = date('Y-m-d H:i:s', time() + RESET_TOKEN_EXPIRY);
        
        setResetToken($user['id'], $token, $expires);
        
        $resetLink = APP_URL . '/index.html?reset=' . $token;
        
        if (EMAIL_ENABLED) {
            // Send email (implement your email sending here)
            sendResetEmail($user['email'], $user['name'], $resetLink);
        } else {
            // For development: include the link in response
            $response['reset_link'] = $resetLink;
            $response['dev_note'] = 'Email is disabled. Use this link to reset password.';
        }
    }
    
    jsonResponse($response);
}

// ========================================
// Reset Password
// ========================================

function handleResetPassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $token = $input['token'] ?? '';
    $password = $input['password'] ?? '';
    
    if (empty($token)) {
        errorResponse('Reset token is required');
    }
    
    if (strlen($password) < 10) {
        errorResponse('Password must be at least 10 characters');
    }

    // Find user by token
    $user = findUserByResetToken($token);
    
    if (!$user) {
        errorResponse('Invalid or expired reset token', 400);
    }
    
    // Update password
    updatePassword($user['id'], $password);
    
    jsonResponse([
        'success' => true,
        'message' => 'Password has been reset successfully. You can now log in.'
    ]);
}

// ========================================
// Change Password
// ========================================

function handleChangePassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);

    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';

    // Verify current password
    $fullUser = findUserById($user['id']);
    if (!$fullUser || !verifyPassword($fullUser, $currentPassword)) {
        errorResponse('Current password is incorrect');
    }

    // Validate new password length (require 10 chars for password changes)
    if (strlen($newPassword) < 10) {
        errorResponse('Password must be at least 10 characters');
    }

    // Update password
    updatePassword($user['id'], $newPassword);

    jsonResponse([
        'success' => true,
        'message' => 'Password changed successfully'
    ]);
}

// ========================================
// Update Settings
// ========================================

function handleUpdateSettings() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Update currency if provided
    if (isset($input['currency'])) {
        $validCurrencies = ['ZAR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'KES', 'NGN'];
        
        if (!in_array($input['currency'], $validCurrencies)) {
            errorResponse('Invalid currency');
        }
        
        $updatedUser = updateUserCurrency($user['id'], $input['currency']);
        setUserSession($updatedUser);
        
        jsonResponse([
            'success' => true,
            'message' => 'Settings updated',
            'user' => sanitizeUser($updatedUser)
        ]);
    }
    
    errorResponse('No settings to update');
}

// ========================================
// Check Status
// ========================================

function handleStatus() {
    $user = getCurrentUser();
    
    if ($user) {
        jsonResponse([
            'authenticated' => true,
            'user' => $user
        ]);
    } else {
        jsonResponse([
            'authenticated' => false,
            'user' => null
        ]);
    }
}

// ========================================
// Helper Functions
// ========================================

function setUserSession($user) {
    $_SESSION['user'] = sanitizeUser($user);
    
    // Extend session cookie
    setcookie(session_name(), session_id(), [
        'expires' => time() + SESSION_LIFETIME,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => isset($_SERVER['HTTPS'])
    ]);
}

function sanitizeUser($user) {
    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'name' => $user['name'],
        'currency' => $user['currency'] ?? 'ZAR'
    ];
}

function sendResetEmail($email, $name, $resetLink) {
    // Basic PHP mail (for production, use PHPMailer or similar)
    $subject = APP_NAME . ' - Password Reset Request';
    
    $message = "Hi $name,\n\n";
    $message .= "You requested to reset your password.\n\n";
    $message .= "Click the link below to reset your password:\n";
    $message .= "$resetLink\n\n";
    $message .= "This link will expire in 1 hour.\n\n";
    $message .= "If you didn't request this, you can safely ignore this email.\n\n";
    $message .= "- " . APP_NAME;
    
    $headers = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . MAIL_FROM . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    
    return mail($email, $subject, $message, $headers);
}
