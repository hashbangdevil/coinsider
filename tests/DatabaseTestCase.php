<?php

use PHPUnit\Framework\TestCase;

/**
 * Base class for tests that hit the database layer.
 *
 * setUp() discards any cached connection and forces a brand-new in-memory
 * SQLite database (with a freshly created schema) before every test, so tests
 * are fully isolated and order-independent.
 */
abstract class DatabaseTestCase extends TestCase
{
    protected function setUp(): void
    {
        Database::reset();
        // Constructing the instance runs initializeTables() → fresh schema.
        Database::getInstance();
    }

    protected function tearDown(): void
    {
        Database::reset();
    }

    /** Create a user and return its row (['id' => ..., 'email' => ..., ...]). */
    protected function makeUser(string $email = 'a@example.com'): array
    {
        return createUser($email, 'Test User', 'password123');
    }

    /** Create a category and return its row. */
    protected function makeCategory(
        int $userId,
        string $name = 'Groceries',
        string $type = 'expense',
        float $monthlyBudget = 0
    ): array {
        return createCategory($userId, $name, $type, '🛒', null, $monthlyBudget);
    }
}
