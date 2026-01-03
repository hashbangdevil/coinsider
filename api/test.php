<?php
// Simple test endpoint
header('Content-Type: application/json');

echo json_encode([
    'status' => 'ok',
    'php_version' => PHP_VERSION,
    'pdo_sqlite' => extension_loaded('pdo_sqlite'),
    'session_status' => session_status(),
    'data_dir_exists' => is_dir(__DIR__ . '/../data'),
    'data_dir_writable' => is_writable(__DIR__ . '/../data') || is_writable(__DIR__ . '/..'),
    'timestamp' => date('Y-m-d H:i:s')
]);
