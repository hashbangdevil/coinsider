<?php

/**
 * HTTP-level tests for api/api.php data resources — the full path through
 * routing, requireAuth, the handlers, and the JSON contract the frontend reads.
 * Includes cross-user isolation checks at the HTTP boundary.
 */
final class DataApiTest extends HttpTestCase
{
    public function testSignupSeedsDefaultCategories(): void
    {
        $client = $this->client();
        $this->signup($client);

        $categories = $this->json($client->get('/api/api.php?resource=categories'));

        $this->assertNotEmpty($categories);
        $types = array_column($categories, 'type');
        $this->assertContains('expense', $types);
        $this->assertContains('income', $types);
    }

    public function testCreatedTransactionIsReflectedInSummary(): void
    {
        $client = $this->client();
        $this->signup($client);

        $categoryId = $this->firstExpenseCategoryId($client);
        $today = date('Y-m-d');

        $create = $client->post('/api/api.php?resource=transactions', [
            'json' => [
                'description' => 'Groceries',
                'amount' => 100,
                'category_id' => $categoryId,
                'type' => 'expense',
                'date' => $today,
            ],
        ]);
        $this->assertSame(201, $create->getStatusCode());

        $summary = $this->json($client->get('/api/api.php?resource=summary&period=this-month'));
        $this->assertSame(100.0, (float) $summary['expense']);
        $this->assertSame(-100.0, (float) $summary['balance']);
    }

    public function testTransactionRejectsAnotherUsersCategory(): void
    {
        // User A owns a category.
        $userA = $this->client();
        $this->signup($userA, 'a@example.com');
        $foreignCategoryId = $this->firstExpenseCategoryId($userA);

        // User B tries to file a transaction against user A's category id.
        $userB = $this->client();
        $this->signup($userB, 'b@example.com');

        $res = $userB->post('/api/api.php?resource=transactions', [
            'json' => [
                'description' => 'Sneaky',
                'amount' => 50,
                'category_id' => $foreignCategoryId,
                'type' => 'expense',
                'date' => date('Y-m-d'),
            ],
        ]);

        $this->assertSame(400, $res->getStatusCode());
    }

    public function testUsersDoNotSeeEachOthersTransactions(): void
    {
        $userA = $this->client();
        $this->signup($userA, 'a@example.com');
        $userA->post('/api/api.php?resource=transactions', [
            'json' => [
                'description' => 'A private spend',
                'amount' => 75,
                'category_id' => $this->firstExpenseCategoryId($userA),
                'type' => 'expense',
                'date' => date('Y-m-d'),
            ],
        ]);

        $userB = $this->client();
        $this->signup($userB, 'b@example.com');
        $transactions = $this->json($userB->get('/api/api.php?resource=transactions'));

        $this->assertSame([], $transactions);
    }

    /** Fetch the authenticated user's categories and return the first expense one's id. */
    private function firstExpenseCategoryId($client): int
    {
        $categories = $this->json($client->get('/api/api.php?resource=categories'));
        foreach ($categories as $category) {
            if ($category['type'] === 'expense') {
                return (int) $category['id'];
            }
        }
        $this->fail('No seeded expense category found');
    }
}
