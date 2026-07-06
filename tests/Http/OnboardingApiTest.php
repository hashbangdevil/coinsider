<?php

/**
 * HTTP-level tests for the accounts onboarding flag: new signups need onboarding,
 * complete-onboarding clears it, and the endpoint requires auth.
 */
final class OnboardingApiTest extends HttpTestCase
{
    public function testNewSignupNeedsOnboarding(): void
    {
        $body = $this->signup($this->client());
        $this->assertFalse($body['user']['onboarding_completed']);
    }

    public function testCompleteOnboardingSetsTheFlag(): void
    {
        $client = $this->client();
        $this->signup($client);

        $res = $client->post('/api/auth.php?action=complete-onboarding');
        $this->assertSame(200, $res->getStatusCode());
        $this->assertTrue($this->json($res)['user']['onboarding_completed']);

        // Persisted — reflected in the status response.
        $status = $this->json($client->get('/api/auth.php?action=status'));
        $this->assertTrue($status['user']['onboarding_completed']);
    }

    public function testCompleteOnboardingRequiresAuth(): void
    {
        $res = $this->client()->post('/api/auth.php?action=complete-onboarding');
        $this->assertSame(401, $res->getStatusCode());
    }
}
