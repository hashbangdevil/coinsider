<?php

/**
 * Tests for the money-aggregation functions in api/db.php.
 *
 * These are the highest-value functions to protect: amounts are intentionally
 * stored in plaintext precisely so this SQL can aggregate them (see the
 * encryption notes in CLAUDE.md), and the summary/trends/budget screens all
 * depend on these numbers being correct and correctly scoped per user.
 */
final class AggregationTest extends DatabaseTestCase
{
    // ---------------------------------------------------------------
    // getCategorySpent
    // ---------------------------------------------------------------

    public function testCategorySpentSumsTransactionsInTheGivenMonth(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id']);

        createTransactionWithCategoryId($user['id'], 'Lunch', 30.50, $cat['id'], 'expense', '2026-07-02');
        createTransactionWithCategoryId($user['id'], 'Dinner', 19.50, $cat['id'], 'expense', '2026-07-20');
        // Different month — must be excluded.
        createTransactionWithCategoryId($user['id'], 'June meal', 99.00, $cat['id'], 'expense', '2026-06-15');

        $this->assertSame(50.0, getCategorySpent($user['id'], $cat['id'], '2026-07'));
    }

    public function testCategorySpentIsZeroWhenNoTransactions(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id']);

        $this->assertSame(0.0, getCategorySpent($user['id'], $cat['id'], '2026-07'));
    }

    public function testCategorySpentIsScopedToTheOwningUser(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catA = $this->makeCategory($userA['id']);

        createTransactionWithCategoryId($userA['id'], 'Lunch', 40.00, $catA['id'], 'expense', '2026-07-02');

        // User B asking about user A's category must see nothing.
        $this->assertSame(0.0, getCategorySpent($userB['id'], $catA['id'], '2026-07'));
    }

    // ---------------------------------------------------------------
    // getMonthlyTotals
    // ---------------------------------------------------------------

    public function testMonthlyTotalsGroupIncomeAndExpenseSeparately(): void
    {
        $user = $this->makeUser();
        $salary = $this->makeCategory($user['id'], 'Salary', 'income');
        $food = $this->makeCategory($user['id'], 'Food', 'expense');

        createTransactionWithCategoryId($user['id'], 'Paycheck', 1000.00, $salary['id'], 'income', '2026-07-01');
        createTransactionWithCategoryId($user['id'], 'Groceries', 250.00, $food['id'], 'expense', '2026-07-10');
        createTransactionWithCategoryId($user['id'], 'Snacks', 50.00, $food['id'], 'expense', '2026-07-11');

        $totals = getMonthlyTotals($user['id'], '2026-07');

        $this->assertSame(1000.0, $totals['income']);
        $this->assertSame(300.0, $totals['expense']);
    }

    public function testMonthlyTotalsDefaultToZeroWithNoData(): void
    {
        $user = $this->makeUser();

        $totals = getMonthlyTotals($user['id'], '2026-07');

        $this->assertSame(['income' => 0, 'expense' => 0], $totals);
    }

    public function testMonthlyTotalsDoNotLeakBetweenUsers(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catA = $this->makeCategory($userA['id'], 'Salary', 'income');

        createTransactionWithCategoryId($userA['id'], 'Paycheck', 5000.00, $catA['id'], 'income', '2026-07-01');

        $this->assertSame(['income' => 0, 'expense' => 0], getMonthlyTotals($userB['id'], '2026-07'));
    }

    // ---------------------------------------------------------------
    // getCategoryTotalsWithDetails (budget comparison)
    // ---------------------------------------------------------------

    public function testCategoryTotalsComputeBudgetPercentage(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense', 1000.00);

        createTransactionWithCategoryId($user['id'], 'Groceries', 250.00, $cat['id'], 'expense', '2026-07-10');

        $rows = getCategoryTotalsWithDetails($user['id'], '2026-07');
        $row = $this->rowForCategory($rows, $cat['id']);

        $this->assertSame(250.0, $row['spent']);
        $this->assertSame(1000.0, $row['monthly_budget']);
        $this->assertSame(25.0, $row['percentage']);
    }

    public function testCategoryTotalsPercentageIsZeroWithoutABudget(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense', 0);

        createTransactionWithCategoryId($user['id'], 'Groceries', 250.00, $cat['id'], 'expense', '2026-07-10');

        $row = $this->rowForCategory(getCategoryTotalsWithDetails($user['id'], '2026-07'), $cat['id']);

        $this->assertSame(250.0, $row['spent']);
        $this->assertSame(0, $row['percentage']);
    }

    public function testCategoryTotalsIgnoreOtherMonths(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense', 1000.00);

        createTransactionWithCategoryId($user['id'], 'June spend', 400.00, $cat['id'], 'expense', '2026-06-10');

        $row = $this->rowForCategory(getCategoryTotalsWithDetails($user['id'], '2026-07'), $cat['id']);

        $this->assertSame(0.0, $row['spent']);
    }

    // ---------------------------------------------------------------
    // Per-user scoping on the plain lookups
    // ---------------------------------------------------------------

    public function testGetCategoryDoesNotReturnAnotherUsersCategory(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catA = $this->makeCategory($userA['id']);

        $this->assertFalse(getCategory($userB['id'], $catA['id']));
    }

    public function testGetCategoriesReturnsOnlyTheOwnUsersCategories(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $this->makeCategory($userA['id'], 'A-only', 'expense');
        $this->makeCategory($userB['id'], 'B-only', 'expense');

        $names = array_column(getCategories($userB['id']), 'name');

        $this->assertContains('B-only', $names);
        $this->assertNotContains('A-only', $names);
    }

    // ---------------------------------------------------------------
    // createTransactionWithCategoryId validation
    // ---------------------------------------------------------------

    public function testTransactionRejectsTypeMismatchWithCategory(): void
    {
        $user = $this->makeUser();
        $expenseCat = $this->makeCategory($user['id'], 'Food', 'expense');

        // Category is 'expense' but the transaction claims to be 'income'.
        $result = createTransactionWithCategoryId(
            $user['id'], 'Bad', 10.00, $expenseCat['id'], 'income', '2026-07-01'
        );

        $this->assertNull($result);
        $this->assertSame(0.0, getCategorySpent($user['id'], $expenseCat['id'], '2026-07'));
    }

    public function testTransactionRejectsAnotherUsersCategory(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catA = $this->makeCategory($userA['id']);

        // User B cannot file a transaction against user A's category.
        $result = createTransactionWithCategoryId(
            $userB['id'], 'Sneaky', 10.00, $catA['id'], 'expense', '2026-07-01'
        );

        $this->assertNull($result);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    /** Find the aggregation row for a given category id. */
    private function rowForCategory(array $rows, int $categoryId): array
    {
        foreach ($rows as $row) {
            if ((int) $row['id'] === $categoryId) {
                return $row;
            }
        }
        $this->fail("No aggregation row found for category $categoryId");
    }
}
