<?php
/**
 * Coinsider - SMTP Configuration
 * Loads SMTP credentials from env file
 */

class SMTPConfig {
    private static $config = null;

    /**
     * Load SMTP configuration from env file
     */
    public static function load() {
        if (self::$config !== null) {
            return self::$config;
        }

        // Search for credentials file in multiple locations (in order of security preference)
        $searchPaths = [
            __DIR__ . '/../../smtpcreds.env',    // One level above project (most secure)
            __DIR__ . '/../smtpcreds.env',       // Project root
            __DIR__ . '/smtpcreds.env',          // API folder (least secure, for dev)
        ];

        $envFile = null;
        foreach ($searchPaths as $path) {
            if (file_exists($path)) {
                $envFile = $path;
                break;
            }
        }

        if (!$envFile) {
            throw new Exception("SMTP credentials file not found. Searched: " . implode(', ', $searchPaths));
        }

        $config = [];
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            // Parse KEY=VALUE format
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $config[trim($key)] = trim($value);
            }
        }

        // Validate required fields
        $required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME', 'SMTP_HELO'];
        foreach ($required as $field) {
            if (!isset($config[$field]) || empty($config[$field])) {
                throw new Exception("Missing required SMTP config: $field");
            }
        }

        self::$config = $config;
        return $config;
    }

    /**
     * Get specific config value
     */
    public static function get($key, $default = null) {
        $config = self::load();
        return $config[$key] ?? $default;
    }

    /**
     * Check if SMTP is configured
     */
    public static function isConfigured() {
        try {
            self::load();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}
?>
