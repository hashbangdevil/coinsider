<?php

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use PHPUnit\Framework\TestCase;

/**
 * Base class for HTTP-level tests of the handler layer (api/api.php, api/auth.php).
 *
 * Unlike the DB-layer tests, these exercise the full request path: query-string
 * routing, requireAuth(), PHP session cookies, and the JSON contracts the
 * frontend actually consumes. It boots PHP's built-in web server (one per test
 * class) pointed at a throwaway on-disk SQLite database, and drives it with a
 * real HTTP client that carries cookies — so login/session behaviour is genuine.
 *
 * A file-based DB (not :memory:) is required here because the server runs in a
 * separate process from the test and must persist data across requests. The DB
 * file is deleted before each test, so the next request recreates a fresh schema.
 */
abstract class HttpTestCase extends TestCase
{
    private const HOST = '127.0.0.1';
    private const PORT = 8899;

    /** @var resource|null proc_open handle for the server */
    private static $server = null;
    private static ?string $dbPath = null;
    private static ?string $logPath = null;
    protected static string $baseUri = '';

    public static function setUpBeforeClass(): void
    {
        self::$baseUri = 'http://' . self::HOST . ':' . self::PORT;
        self::$dbPath = tempnam(sys_get_temp_dir(), 'coinsider_http_') . '.db';
        self::$logPath = tempnam(sys_get_temp_dir(), 'coinsider_srv_');

        $docroot = dirname(__DIR__, 2); // project root
        $cmd = sprintf(
            'exec %s -S %s:%d -t %s',
            escapeshellarg(PHP_BINARY),
            self::HOST,
            self::PORT,
            escapeshellarg($docroot)
        );

        // Route the server's DB at our throwaway file (config.php honors this).
        $env = getenv();
        $env['COINSIDER_DB_PATH'] = self::$dbPath;

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['file', self::$logPath, 'a'],
            2 => ['file', self::$logPath, 'a'],
        ];

        self::$server = proc_open($cmd, $descriptors, $pipes, $docroot, $env);
        if (!is_resource(self::$server)) {
            self::fail('Could not start PHP built-in server');
        }

        self::waitUntilReady();
    }

    public static function tearDownAfterClass(): void
    {
        if (is_resource(self::$server)) {
            proc_terminate(self::$server);
            proc_close(self::$server);
            self::$server = null;
        }
        foreach ([self::$dbPath, self::$logPath] as $path) {
            if ($path && file_exists($path)) {
                @unlink($path);
            }
        }
    }

    protected function setUp(): void
    {
        // Fresh database per test: delete the file so the next request rebuilds
        // an empty schema. The server holds no open connection between requests.
        if (self::$dbPath && file_exists(self::$dbPath)) {
            unlink(self::$dbPath);
        }
    }

    /** A client with an isolated cookie jar → its own session (call once per "user"). */
    protected function client(): Client
    {
        return new Client([
            'base_uri' => self::$baseUri,
            'cookies' => new CookieJar(),
            'http_errors' => false, // assert on status codes ourselves
            'timeout' => 10,
        ]);
    }

    /** Sign up a fresh user on the given client and return the decoded response body. */
    protected function signup(Client $client, string $email = 'user@example.com', string $password = 'password123'): array
    {
        $res = $client->post('/api/auth.php?action=signup', [
            'json' => ['email' => $email, 'name' => 'Test User', 'password' => $password],
        ]);
        return $this->json($res);
    }

    /** Decode a JSON response body to an array. */
    protected function json($response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }

    private static function waitUntilReady(): void
    {
        for ($i = 0; $i < 100; $i++) {
            try {
                $conn = @fsockopen(self::HOST, self::PORT, $errno, $errstr, 0.2);
            } catch (\Throwable $e) {
                $conn = false; // connection refused while the server boots — keep polling
            }
            if (is_resource($conn)) {
                fclose($conn);
                return;
            }
            usleep(100_000); // 100ms
        }
        $log = self::$logPath && file_exists(self::$logPath) ? file_get_contents(self::$logPath) : '';
        self::fail("PHP built-in server did not become ready on port " . self::PORT . "\n" . $log);
    }
}
