<?php

/**
 * Tests for the CSV-import DB layer: importTransactions() (batch insert flagged
 * for review, account-balance updates, per-user scoping) and confirmTransaction()
 * (assign category + clear the flag). Descriptions arrive already-encrypted from
 * the client, so these tests treat them as opaque strings.
 */
final class ImportTest extends DatabaseTestCase
{
    private function reviewQueue(int $userId): array
    {
        return getTransactionsFiltered($userId, 100, null, null, null, true);
    }

    private function makeAccount(int $userId, float $startingBalance = 0): array
    {
        return createAccount($userId, 'Cheque', 'bank', '🏦', '#000000', $startingBalance);
    }

    public function testImportInsertsRowsFlaggedForReview(): void
    {
        $user = $this->makeUser();

        $count = importTransactions($user['id'], null, [
            ['description' => 'Coffee', 'amount' => 30, 'type' => 'expense', 'date' => '2026-07-01'],
            ['description' => 'Salary', 'amount' => 1000, 'type' => 'income', 'date' => '2026-07-02'],
        ]);

        $this->assertSame(2, $count);
        $queue = $this->reviewQueue($user['id']);
        $this->assertCount(2, $queue);
        foreach ($queue as $t) {
            $this->assertSame(1, (int) $t['needs_review']);
        }
    }

    public function testImportedRowsAreExcludedFromTheNormalReviewFilter(): void
    {
        $user = $this->makeUser();
        importTransactions($user['id'], null, [
            ['description' => 'X', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);

        // Explicitly-not-review filter returns nothing yet.
        $confirmed = getTransactionsFiltered($user['id'], 100, null, null, null, false);
        $this->assertCount(0, $confirmed);
    }

    public function testImportWithoutCategoryLeavesRowUncategorised(): void
    {
        $user = $this->makeUser();
        importTransactions($user['id'], null, [
            ['description' => 'X', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);

        $t = $this->reviewQueue($user['id'])[0];
        $this->assertNull($t['category_id']);
    }

    public function testImportKeepsAValidSuggestedCategory(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');

        importTransactions($user['id'], null, [
            ['description' => 'Lunch', 'amount' => 20, 'type' => 'expense', 'date' => '2026-07-01', 'category_id' => $cat['id']],
        ]);

        $t = $this->reviewQueue($user['id'])[0];
        $this->assertSame((int) $cat['id'], (int) $t['category_id']);
    }

    public function testImportDropsAForeignCategorySuggestion(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catA = $this->makeCategory($userA['id'], 'Food', 'expense');

        importTransactions($userB['id'], null, [
            ['description' => 'x', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01', 'category_id' => $catA['id']],
        ]);

        $t = $this->reviewQueue($userB['id'])[0];
        $this->assertNull($t['category_id']);
    }

    public function testImportDropsATypeMismatchedCategorySuggestion(): void
    {
        $user = $this->makeUser();
        $incomeCat = $this->makeCategory($user['id'], 'Salary', 'income');

        importTransactions($user['id'], null, [
            ['description' => 'Lunch', 'amount' => 20, 'type' => 'expense', 'date' => '2026-07-01', 'category_id' => $incomeCat['id']],
        ]);

        $this->assertNull($this->reviewQueue($user['id'])[0]['category_id']);
    }

    public function testImportRejectsAForeignAccount(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $accA = $this->makeAccount($userA['id']);

        $result = importTransactions($userB['id'], $accA['id'], [
            ['description' => 'x', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);

        $this->assertNull($result);
        // Nothing was inserted for user B.
        $this->assertCount(0, $this->reviewQueue($userB['id']));
    }

    public function testImportUpdatesTheAccountBalance(): void
    {
        $user = $this->makeUser();
        $acc = $this->makeAccount($user['id'], 100);

        importTransactions($user['id'], $acc['id'], [
            ['description' => 'in', 'amount' => 50, 'type' => 'income', 'date' => '2026-07-01'],
            ['description' => 'out', 'amount' => 30, 'type' => 'expense', 'date' => '2026-07-02'],
        ]);

        $after = getAccount($user['id'], $acc['id']);
        $this->assertEqualsWithDelta(120.0, (float) $after['current_balance'], 0.001); // 100 + 50 - 30
    }

    public function testImportSkipsMalformedRows(): void
    {
        $user = $this->makeUser();
        $count = importTransactions($user['id'], null, [
            ['description' => 'ok', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
            ['description' => 'bad type', 'amount' => 10, 'type' => 'transfer', 'date' => '2026-07-01'],
        ]);

        $this->assertSame(1, $count);
    }

    public function testConfirmAssignsCategoryAndClearsTheFlag(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');
        importTransactions($user['id'], null, [
            ['description' => 'Lunch', 'amount' => 20, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);
        $t = $this->reviewQueue($user['id'])[0];

        $confirmed = confirmTransaction($user['id'], $t['id'], $cat['id']);

        $this->assertNotNull($confirmed);
        $this->assertSame(0, (int) $confirmed['needs_review']);
        $this->assertSame((int) $cat['id'], (int) $confirmed['category_id']);
        $this->assertCount(0, $this->reviewQueue($user['id']));
    }

    public function testConfirmRejectsATypeMismatchedCategory(): void
    {
        $user = $this->makeUser();
        $incomeCat = $this->makeCategory($user['id'], 'Salary', 'income');
        importTransactions($user['id'], null, [
            ['description' => 'Lunch', 'amount' => 20, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);
        $t = $this->reviewQueue($user['id'])[0];

        $this->assertNull(confirmTransaction($user['id'], $t['id'], $incomeCat['id']));
        // Still pending.
        $this->assertCount(1, $this->reviewQueue($user['id']));
    }

    public function testConfirmIsScopedToTheOwningUser(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $catB = $this->makeCategory($userB['id'], 'Food', 'expense');
        importTransactions($userA['id'], null, [
            ['description' => 'x', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
        ]);
        $tA = $this->reviewQueue($userA['id'])[0];

        // User B must not be able to confirm user A's imported transaction.
        $this->assertNull(confirmTransaction($userB['id'], $tA['id'], $catB['id']));
    }
}
