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
    case 'get-encryption':
        handleGetEncryption();
        break;
    case 'enable-encryption':
        handleEnableEncryption();
        break;
    case 'update-encryption-key':
        handleUpdateEncryptionKey();
        break;
    case 'disable-encryption':
        handleDisableEncryption();
        break;
    case 'update-recovery-key':
        handleUpdateRecoveryKey();
        break;
    case 'verify-password':
        handleVerifyPassword();
        break;
    case 'get-encryption-by-token':
        handleGetEncryptionByToken();
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

    // If encryption data is provided, update encryption keys
    // This happens when user had encryption enabled and used recovery phrase
    $encryptionSalt = $input['encryption_salt'] ?? null;
    $encryptedMek = $input['encrypted_mek'] ?? null;

    if ($encryptionSalt && $encryptedMek) {
        $pdo = Database::getInstance()->getPdo();
        $stmt = $pdo->prepare("
            UPDATE users SET
                encryption_salt = ?,
                encrypted_mek = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$encryptionSalt, $encryptedMek, $user['id']]);
    }

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
// Get Encryption Settings
// ========================================

function handleGetEncryption() {
    $user = requireAuth();
    $settings = getEncryptionSettings($user['id']);

    jsonResponse([
        'encryption_enabled' => (bool) $settings['encryption_enabled'],
        'encryption_salt' => $settings['encryption_salt'],
        'encrypted_mek' => $settings['encrypted_mek'],
        'recovery_salt' => $settings['recovery_salt'],
        'recovery_encrypted_mek' => $settings['recovery_encrypted_mek']
    ]);
}

// ========================================
// Enable Encryption
// ========================================

function handleEnableEncryption() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $required = ['encryption_salt', 'encrypted_mek', 'recovery_salt', 'recovery_encrypted_mek'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            errorResponse("Missing required field: $field");
        }
    }

    $result = enableEncryption(
        $user['id'],
        $input['encryption_salt'],
        $input['encrypted_mek'],
        $input['recovery_salt'],
        $input['recovery_encrypted_mek']
    );

    // Update session to reflect the new encryption status
    if (isset($_SESSION['user'])) {
        $_SESSION['user']['encryption_enabled'] = true;
    }

    jsonResponse([
        'success' => true,
        'message' => 'Encryption enabled successfully',
        'encryption_enabled' => true
    ]);
}

// ========================================
// Update Encryption Key (after password change)
// ========================================

function handleUpdateEncryptionKey() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (empty($input['encryption_salt']) || empty($input['encrypted_mek'])) {
        errorResponse('Missing required fields: encryption_salt, encrypted_mek');
    }

    $result = updateEncryptionKey(
        $user['id'],
        $input['encryption_salt'],
        $input['encrypted_mek']
    );

    jsonResponse([
        'success' => true,
        'message' => 'Encryption key updated successfully'
    ]);
}

// ========================================
// Disable Encryption
// ========================================

function handleDisableEncryption() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();

    disableEncryption($user['id']);

    // Update session to reflect the new encryption status
    if (isset($_SESSION['user'])) {
        $_SESSION['user']['encryption_enabled'] = false;
    }

    jsonResponse([
        'success' => true,
        'message' => 'Encryption disabled'
    ]);
}

// ========================================
// Update Recovery Key
// ========================================

function handleUpdateRecoveryKey() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (empty($input['recovery_salt']) || empty($input['recovery_encrypted_mek'])) {
        errorResponse('Missing required fields: recovery_salt, recovery_encrypted_mek');
    }

    $pdo = Database::getInstance()->getPdo();
    $stmt = $pdo->prepare("
        UPDATE users SET
            recovery_salt = ?,
            recovery_encrypted_mek = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([
        $input['recovery_salt'],
        $input['recovery_encrypted_mek'],
        $user['id']
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'Recovery key updated successfully'
    ]);
}

// ========================================
// Verify Password
// ========================================

function handleVerifyPassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    $user = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';

    $fullUser = findUserById($user['id']);
    if (!$fullUser || !verifyPassword($fullUser, $password)) {
        errorResponse('Incorrect password', 401);
    }

    jsonResponse(['success' => true]);
}

// ========================================
// Get Encryption Settings by Reset Token
// ========================================

function handleGetEncryptionByToken() {
    $token = $_GET['token'] ?? '';

    if (empty($token)) {
        errorResponse('Token is required');
    }

    $user = findUserByResetToken($token);
    if (!$user) {
        errorResponse('Invalid or expired token', 400);
    }

    jsonResponse([
        'encryption_enabled' => (bool) ($user['encryption_enabled'] ?? false),
        'recovery_salt' => $user['recovery_salt'] ?? null,
        'recovery_encrypted_mek' => $user['recovery_encrypted_mek'] ?? null
    ]);
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
        'currency' => $user['currency'] ?? 'ZAR',
        'encryption_enabled' => (bool) ($user['encryption_enabled'] ?? false)
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
