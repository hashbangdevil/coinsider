<?php

/**
 * Tests for the mandatory-account ("ledger") model: ensureUserHasAccount()
 * (auto-create a default account + fold legacy account-less transactions in,
 * idempotently), the default-account lookup, and the last-account delete guard.
 */
final class AccountsLedgerTest extends DatabaseTestCase
{
    public function testEnsureCreatesADefaultAccount(): void
    {
        $user = $this->makeUser();
        $this->assertNull(getDefaultAccountId($user['id']));

        $id = ensureUserHasAccount($user['id']);

        $accounts = getAccounts($user['id']);
        $this->assertCount(1, $accounts);
        $this->assertSame('Default account', $accounts[0]['name']);
        $this->assertSame((int) $accounts[0]['id'], (int) $id);
    }

    public function testEnsureIsIdempotent(): void
    {
        $user = $this->makeUser();
        $first = ensureUserHasAccount($user['id']);
        $second = ensureUserHasAccount($user['id']);

        $this->assertSame((int) $first, (int) $second);
        $this->assertCount(1, getAccounts($user['id'])); // no duplicate
    }

    public function testEnsureFoldsAccountLessTransactionsAndBalance(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');
        // Account-less transactions (createTransactionWithCategoryId leaves account_id null).
        createTransactionWithCategoryId($user['id'], 'A', 100, $cat['id'], 'expense', '2026-07-01');
        createTransactionWithCategoryId($user['id'], 'B', 50, $cat['id'], 'expense', '2026-07-02');

        $defaultId = ensureUserHasAccount($user['id']);

        // Every transaction is now attached to the default account.
        foreach (getTransactions($user['id']) as $t) {
            $this->assertSame($defaultId, (int) $t['account_id']);
        }
        // And its balance reflects the folded net (two expenses).
        $account = getAccount($user['id'], $defaultId);
        $this->assertEqualsWithDelta(-150.0, (float) $account['current_balance'], 0.001);
    }

    public function testFoldingDoesNotDoubleCountOnReRun(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');
        createTransactionWithCategoryId($user['id'], 'A', 100, $cat['id'], 'expense', '2026-07-01');

        $defaultId = ensureUserHasAccount($user['id']);
        ensureUserHasAccount($user['id']); // re-run

        $account = getAccount($user['id'], $defaultId);
        $this->assertEqualsWithDelta(-100.0, (float) $account['current_balance'], 0.001);
    }

    public function testGetDefaultAccountId(): void
    {
        $user = $this->makeUser();
        $this->assertNull(getDefaultAccountId($user['id']));
        $id = ensureUserHasAccount($user['id']);
        $this->assertSame((int) $id, getDefaultAccountId($user['id']));
    }

    public function testCannotDeleteTheLastAccount(): void
    {
        $user = $this->makeUser();
        $defaultId = ensureUserHasAccount($user['id']); // single, empty account

        $this->assertFalse(deleteAccount($user['id'], $defaultId));
        $this->assertCount(1, getAccounts($user['id']));
    }

    public function testCanDeleteANonLastEmptyAccount(): void
    {
        $user = $this->makeUser();
        ensureUserHasAccount($user['id']);
        $second = createAccount($user['id'], 'Savings', 'bank', '🏦', null, 0);

        $this->assertTrue(deleteAccount($user['id'], $second['id']));
        $this->assertCount(1, getAccounts($user['id']));
    }

    public function testReassignMovesTransactionsAndMergesBalance(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');
        $a = createAccount($user['id'], 'A', 'bank', '🏦', null, 100);
        $b = createAccount($user['id'], 'B', 'bank', '🏦', null, 50);
        createTransactionWithAccount($user['id'], 'x', 30, $cat['id'], 'expense', '2026-07-01', null, $a['id']);

        $this->assertTrue(reassignAndDeleteAccount($user['id'], $a['id'], $b['id']));

        $this->assertFalse(getAccount($user['id'], $a['id'])); // source gone
        $txns = getTransactions($user['id']);
        $this->assertSame((int) $b['id'], (int) $txns[0]['account_id']); // moved to target
        // Target balance = its opening (50) + source's whole balance (100 - 30 = 70).
        $this->assertEqualsWithDelta(120.0, (float) getAccount($user['id'], $b['id'])['current_balance'], 0.001);
    }

    public function testReassignRejectsTheSameAccount(): void
    {
        $user = $this->makeUser();
        $a = createAccount($user['id'], 'A', 'bank', '🏦', null, 0);
        createAccount($user['id'], 'B', 'bank', '🏦', null, 0);

        $this->assertFalse(reassignAndDeleteAccount($user['id'], $a['id'], $a['id']));
    }

    public function testReassignRejectsAForeignTarget(): void
    {
        $userA = $this->makeUser('a@example.com');
        $userB = $this->makeUser('b@example.com');
        $a1 = createAccount($userA['id'], 'A1', 'bank', '🏦', null, 0);
        createAccount($userA['id'], 'A2', 'bank', '🏦', null, 0);
        $foreign = createAccount($userB['id'], 'B', 'bank', '🏦', null, 0);

        $this->assertFalse(reassignAndDeleteAccount($userA['id'], $a1['id'], $foreign['id']));
        $this->assertNotFalse(getAccount($userA['id'], $a1['id'])); // source untouched
    }

    public function testExistingUserWithTransactionsSkipsOnboarding(): void
    {
        $user = $this->makeUser();
        $cat = $this->makeCategory($user['id'], 'Food', 'expense');
        createTransactionWithCategoryId($user['id'], 'x', 10, $cat['id'], 'expense', '2026-07-01');

        ensureUserHasAccount($user['id']);

        $this->assertSame(1, (int) findUserById($user['id'])['onboarding_completed']);
    }

    public function testNewUserWithoutTransactionsStillNeedsOnboarding(): void
    {
        $user = $this->makeUser();
        ensureUserHasAccount($user['id']);
        $this->assertSame(0, (int) findUserById($user['id'])['onboarding_completed']);
    }
}
