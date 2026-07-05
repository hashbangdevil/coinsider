<?php

/**
 * HTTP-level tests for the CSV import endpoint (resource=import), the
 * needs_review GET filter, and the confirm path on the transactions PUT.
 */
final class ImportApiTest extends HttpTestCase
{
    /** Fetch the authenticated user's first expense category id. */
    private function firstExpenseCategoryId($client): int
    {
        $categories = $this->json($client->get('/api/api.php?resource=categories'));
        foreach ($categories as $c) {
            if ($c['type'] === 'expense') {
                return (int) $c['id'];
            }
        }
        $this->fail('No seeded expense category');
    }

    private function importPayload(): array
    {
        return [
            'transactions' => [
                ['description' => 'CSV Coffee', 'amount' => 30, 'type' => 'expense', 'date' => '2026-07-01'],
                ['description' => 'CSV Salary', 'amount' => 1000, 'type' => 'income', 'date' => '2026-07-02'],
            ],
        ];
    }

    public function testImportRequiresAuth(): void
    {
        $res = $this->client()->post('/api/api.php?resource=import', ['json' => $this->importPayload()]);
        $this->assertSame(401, $res->getStatusCode());
    }

    public function testImportRejectsEmptyPayload(): void
    {
        $client = $this->client();
        $this->signup($client);
        $res = $client->post('/api/api.php?resource=import', ['json' => ['transactions' => []]]);
        $this->assertSame(400, $res->getStatusCode());
    }

    public function testImportCreatesReviewableTransactions(): void
    {
        $client = $this->client();
        $this->signup($client);

        $res = $client->post('/api/api.php?resource=import', ['json' => $this->importPayload()]);
        $this->assertSame(201, $res->getStatusCode());
        $this->assertSame(2, $this->json($res)['imported']);

        $queue = $this->json($client->get('/api/api.php?resource=transactions&needs_review=1'));
        $this->assertCount(2, $queue);
        foreach ($queue as $t) {
            $this->assertSame(1, (int) $t['needs_review']);
        }
    }

    public function testConfirmClearsTheReviewFlag(): void
    {
        $client = $this->client();
        $this->signup($client);
        $client->post('/api/api.php?resource=import', ['json' => [
            'transactions' => [
                ['description' => 'Uncategorised', 'amount' => 12, 'type' => 'expense', 'date' => '2026-07-01'],
            ],
        ]]);

        $queue = $this->json($client->get('/api/api.php?resource=transactions&needs_review=1'));
        $txId = $queue[0]['id'];
        $categoryId = $this->firstExpenseCategoryId($client);

        $res = $client->put("/api/api.php?resource=transactions&id={$txId}", [
            'json' => ['confirm' => true, 'category_id' => $categoryId],
        ]);
        $this->assertSame(200, $res->getStatusCode());
        $this->assertSame(0, (int) $this->json($res)['needs_review']);

        // Review queue is now empty.
        $this->assertCount(0, $this->json($client->get('/api/api.php?resource=transactions&needs_review=1')));
    }

    public function testImportedRowsDoNotLeakBetweenUsers(): void
    {
        $userA = $this->client();
        $this->signup($userA, 'a@example.com');
        $userA->post('/api/api.php?resource=import', ['json' => $this->importPayload()]);

        $userB = $this->client();
        $this->signup($userB, 'b@example.com');
        $this->assertCount(0, $this->json($userB->get('/api/api.php?resource=transactions&needs_review=1')));
    }

    public function testUserCannotConfirmAnotherUsersTransaction(): void
    {
        $userA = $this->client();
        $this->signup($userA, 'a@example.com');
        $userA->post('/api/api.php?resource=import', ['json' => [
            'transactions' => [['description' => 'A row', 'amount' => 5, 'type' => 'expense', 'date' => '2026-07-01']],
        ]]);
        $txId = $this->json($userA->get('/api/api.php?resource=transactions&needs_review=1'))[0]['id'];

        $userB = $this->client();
        $this->signup($userB, 'b@example.com');
        $catB = $this->firstExpenseCategoryId($userB);

        $res = $userB->put("/api/api.php?resource=transactions&id={$txId}", [
            'json' => ['confirm' => true, 'category_id' => $catB],
        ]);
        $this->assertSame(400, $res->getStatusCode());
    }
}
