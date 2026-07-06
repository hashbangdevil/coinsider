<?php

/**
 * HTTP-level tests for the mandatory-account ledger model: signup provisions a
 * default account, and creating/importing a transaction without an account falls
 * back to it (no account-less transactions).
 */
final class AccountsLedgerApiTest extends HttpTestCase
{
    private function firstExpenseCategoryId($client): int
    {
        foreach ($this->json($client->get('/api/api.php?resource=categories')) as $c) {
            if ($c['type'] === 'expense') {
                return (int) $c['id'];
            }
        }
        $this->fail('No seeded expense category');
    }

    private function defaultAccountId($client): int
    {
        $body = $this->json($client->get('/api/api.php?resource=accounts'));
        $accounts = $body['accounts'] ?? [];
        $this->assertNotEmpty($accounts);
        return (int) $accounts[0]['id'];
    }

    public function testSignupProvisionsADefaultAccount(): void
    {
        $client = $this->client();
        $this->signup($client);

        $body = $this->json($client->get('/api/api.php?resource=accounts'));
        $this->assertContains('Default account', array_column($body['accounts'] ?? [], 'name'));
    }

    public function testCreatingATransactionWithoutAnAccountUsesTheDefault(): void
    {
        $client = $this->client();
        $this->signup($client);
        $defaultId = $this->defaultAccountId($client);
        $categoryId = $this->firstExpenseCategoryId($client);

        $res = $client->post('/api/api.php?resource=transactions', [
            'json' => [
                'description' => 'No account given',
                'amount' => 25,
                'category_id' => $categoryId,
                'type' => 'expense',
                'date' => '2026-07-01',
            ],
        ]);

        $this->assertSame(201, $res->getStatusCode());
        $this->assertSame($defaultId, (int) $this->json($res)['account_id']);
    }

    public function testImportingWithoutAnAccountUsesTheDefault(): void
    {
        $client = $this->client();
        $this->signup($client);
        $defaultId = $this->defaultAccountId($client);

        $client->post('/api/api.php?resource=import', [
            'json' => ['transactions' => [
                ['description' => 'x', 'amount' => 10, 'type' => 'expense', 'date' => '2026-07-01'],
            ]],
        ]);

        $queue = $this->json($client->get('/api/api.php?resource=transactions&needs_review=1'));
        $this->assertSame($defaultId, (int) $queue[0]['account_id']);
    }

    public function testDeletingAnAccountWithTransactionsRequiresReassign(): void
    {
        $client = $this->client();
        $this->signup($client);
        $defaultId = $this->defaultAccountId($client);
        $categoryId = $this->firstExpenseCategoryId($client);

        // Second account with a transaction on it.
        $credit = $this->json($client->post('/api/api.php?resource=accounts', [
            'json' => ['name' => 'Credit', 'type' => 'credit_card'],
        ]));
        $creditId = (int) $credit['id'];
        $client->post('/api/api.php?resource=transactions', [
            'json' => ['description' => 'on credit', 'amount' => 20, 'category_id' => $categoryId, 'type' => 'expense', 'date' => '2026-07-01', 'account_id' => $creditId],
        ]);

        // Without a reassign target → blocked.
        $res = $client->delete("/api/api.php?resource=accounts&id={$creditId}");
        $this->assertSame(409, $res->getStatusCode());

        // With a reassign target → deleted, and the transaction moves to it.
        $res = $client->delete("/api/api.php?resource=accounts&id={$creditId}&reassign_to={$defaultId}");
        $this->assertSame(200, $res->getStatusCode());

        $txns = $this->json($client->get('/api/api.php?resource=transactions'));
        $this->assertSame($defaultId, (int) $txns[0]['account_id']);

        $names = array_column($this->json($client->get('/api/api.php?resource=accounts'))['accounts'], 'name');
        $this->assertNotContains('Credit', $names);
    }
}
