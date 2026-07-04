<?php

/**
 * HTTP-level tests for api/auth.php — the auth actions and the session/cookie
 * plumbing that gates every data endpoint.
 */
final class AuthApiTest extends HttpTestCase
{
    public function testSignupCreatesAccountAndStartsSession(): void
    {
        $client = $this->client();

        $res = $client->post('/api/auth.php?action=signup', [
            'json' => ['email' => 'new@example.com', 'name' => 'New User', 'password' => 'password123'],
        ]);

        $this->assertSame(201, $res->getStatusCode());
        $body = $this->json($res);
        $this->assertTrue($body['success']);
        $this->assertSame('new@example.com', $body['user']['email']);

        // The session cookie should now authenticate follow-up requests.
        $status = $this->json($client->get('/api/auth.php?action=status'));
        $this->assertTrue($status['authenticated']);
        $this->assertSame('new@example.com', $status['user']['email']);
    }

    public function testSignupRejectsShortPassword(): void
    {
        $res = $this->client()->post('/api/auth.php?action=signup', [
            'json' => ['email' => 'x@example.com', 'name' => 'X', 'password' => '123'],
        ]);

        $this->assertSame(400, $res->getStatusCode());
        $this->assertArrayHasKey('error', $this->json($res));
    }

    public function testSignupRejectsInvalidEmail(): void
    {
        $res = $this->client()->post('/api/auth.php?action=signup', [
            'json' => ['email' => 'not-an-email', 'name' => 'X', 'password' => 'password123'],
        ]);

        $this->assertSame(400, $res->getStatusCode());
    }

    public function testSignupRejectsDuplicateEmail(): void
    {
        $this->signup($this->client(), 'dup@example.com');

        $res = $this->client()->post('/api/auth.php?action=signup', [
            'json' => ['email' => 'dup@example.com', 'name' => 'Other', 'password' => 'password123'],
        ]);

        $this->assertSame(400, $res->getStatusCode());
    }

    public function testLoginWithValidCredentials(): void
    {
        $this->signup($this->client(), 'log@example.com', 'password123');

        // A brand-new client (no cookies) logs in from scratch.
        $fresh = $this->client();
        $res = $fresh->post('/api/auth.php?action=login', [
            'json' => ['email' => 'log@example.com', 'password' => 'password123'],
        ]);

        $this->assertSame(200, $res->getStatusCode());
        $this->assertTrue($this->json($res)['success']);
        $this->assertTrue($this->json($fresh->get('/api/auth.php?action=status'))['authenticated']);
    }

    public function testLoginWithWrongPasswordReturns401(): void
    {
        $this->signup($this->client(), 'log@example.com', 'password123');

        $res = $this->client()->post('/api/auth.php?action=login', [
            'json' => ['email' => 'log@example.com', 'password' => 'wrongpass'],
        ]);

        $this->assertSame(401, $res->getStatusCode());
    }

    public function testLoginUnknownUserReturns401(): void
    {
        $res = $this->client()->post('/api/auth.php?action=login', [
            'json' => ['email' => 'ghost@example.com', 'password' => 'password123'],
        ]);

        $this->assertSame(401, $res->getStatusCode());
    }

    public function testProtectedResourceRequiresAuth(): void
    {
        // No signup/login → no session.
        $res = $this->client()->get('/api/api.php?resource=categories');

        $this->assertSame(401, $res->getStatusCode());
        $this->assertArrayHasKey('error', $this->json($res));
    }

    public function testLogoutEndsSession(): void
    {
        $client = $this->client();
        $this->signup($client, 'bye@example.com');

        // Authenticated before logout.
        $this->assertSame(200, $client->get('/api/api.php?resource=categories')->getStatusCode());

        $client->post('/api/auth.php?action=logout');

        // Session gone → protected resource is now 401.
        $this->assertSame(401, $client->get('/api/api.php?resource=categories')->getStatusCode());
    }
}
