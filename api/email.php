<?php
/**
 * Coinsider - Email Class
 * Uses PHPMailer with SMTP configuration
 *
 * Note: All templates use inline styles for Outlook compatibility
 * Brand colors: Primary #10b981 (emerald), Dark #064e3b
 */

require_once __DIR__ . '/smtp_config.php';

// Composer autoload for PHPMailer
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require __DIR__ . '/../vendor/autoload.php';
} else {
    // PHPMailer not installed - email will be disabled
    return;
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Email {

    /**
     * Build a URL for email links
     */
    private static function buildUrl($params = []) {
        $baseUrl = SMTPConfig::get('APP_URL', APP_URL ?? 'http://localhost:8888');
        $url = rtrim($baseUrl, '/') . '/index.html';

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        return $url;
    }

    /**
     * Send email verification email
     */
    public static function sendVerificationEmail($to, $name, $token) {
        $verifyLink = self::buildUrl(['verify' => $token]);

        $subject = 'Verify your email - Coinsider';
        $body = self::getVerificationTemplate($name, $verifyLink);

        return self::send($to, $subject, $body);
    }

    /**
     * Send password reset email
     */
    public static function sendPasswordReset($to, $name, $token) {
        $resetLink = self::buildUrl(['reset' => $token]);

        $subject = 'Password Reset - Coinsider';
        $body = self::getPasswordResetTemplate($name, $resetLink);

        return self::send($to, $subject, $body);
    }

    /**
     * Send email using PHPMailer
     */
    private static function send($to, $subject, $body, $isHTML = true) {
        try {
            if (!SMTPConfig::isConfigured()) {
                return ['success' => false, 'error' => 'SMTP not configured'];
            }

            $config = SMTPConfig::load();

            $mail = new PHPMailer(true);

            // SMTP Configuration
            $mail->isSMTP();
            $mail->Host = $config['SMTP_HOST'];
            $mail->SMTPAuth = true;
            $mail->Username = $config['SMTP_USERNAME'];
            $mail->Password = $config['SMTP_PASSWORD'];
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $config['SMTP_PORT'];
            $mail->Helo = $config['SMTP_HELO'];

            // Timeout settings
            $mail->Timeout = 30;
            $mail->SMTPKeepAlive = false;

            // Recipients
            $mail->setFrom($config['SMTP_FROM_EMAIL'], $config['SMTP_FROM_NAME']);
            $mail->addAddress($to);
            $mail->addReplyTo($config['SMTP_FROM_EMAIL'], $config['SMTP_FROM_NAME']);

            // Content
            $mail->isHTML($isHTML);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body = $body;

            // Plain text alternative
            if ($isHTML) {
                $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $body));
            }

            $mail->send();
            return ['success' => true];

        } catch (Exception $e) {
            error_log("[Coinsider Email] Failed to send to $to: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to send email: ' . $e->getMessage()
            ];
        }
    }

    /**
     * HTML template for email verification
     */
    private static function getVerificationTemplate($name, $verifyLink) {
        $greeting = $name ? "Hi $name," : "Hello,";

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f7fa;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Coinsider</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Think. Track. Thrive.</p>
                        </td>
                    </tr>

                    <!-- Title -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center;">
                            <h2 style="margin: 0; color: #111827; font-size: 24px; font-weight: 600;">Verify Your Email</h2>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">$greeting</p>

                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">Thanks for signing up for Coinsider! Please verify your email address by clicking the button below.</p>
                        </td>
                    </tr>

                    <!-- Button -->
                    <tr>
                        <td style="padding: 0 40px 24px 40px; text-align: center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="background-color: #10b981; border-radius: 8px;">
                                        <a href="$verifyLink" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Verify Email Address</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Info Box -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; padding: 16px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">This link will expire in 7 days. If you didn't create an account, you can safely ignore this email.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Link fallback -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">If the button doesn't work, copy and paste this link:<br><a href="$verifyLink" style="color: #10b981; word-break: break-all;">$verifyLink</a></p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">This is an automated message from Coinsider.<br>Please do not reply to this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }

    /**
     * HTML template for password reset
     */
    private static function getPasswordResetTemplate($name, $resetLink) {
        $greeting = $name ? "Hi $name," : "Hello,";

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f7fa;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Coinsider</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Think. Track. Thrive.</p>
                        </td>
                    </tr>

                    <!-- Title -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center;">
                            <h2 style="margin: 0; color: #111827; font-size: 24px; font-weight: 600;">Password Reset</h2>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">$greeting</p>

                            <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">You requested to reset your password. Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.</p>
                        </td>
                    </tr>

                    <!-- Button -->
                    <tr>
                        <td style="padding: 0 40px 24px 40px; text-align: center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="background-color: #10b981; border-radius: 8px;">
                                        <a href="$resetLink" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Reset Password</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Security Notice -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; padding: 16px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #065f46;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Link fallback -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">If the button doesn't work, copy and paste this link:<br><a href="$resetLink" style="color: #10b981; word-break: break-all;">$resetLink</a></p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">This is an automated message from Coinsider.<br>Please do not reply to this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }
}
?>
