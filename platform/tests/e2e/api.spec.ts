import { test, expect } from '@playwright/test';

test.describe('Public API endpoints', () => {
  test('Badge API should return SVG content', async ({ request }) => {
    // Assuming 'test-repo' might not exist, but it should still return a 404 or 400 SVG/JSON
    // The main goal is to ensure it doesn't return a 307 redirect to /login
    const response = await request.get('/api/repos/test-repo/badge');

    // We expect it to NOT redirect (307).
    // It might be 404 (Repo not found) or 200 (if we mock it).
    // Let's just make sure it's not a redirect.
    expect(response.status()).not.toBe(307);

    // If it's 404, we expect a JSON error, or an SVG error badge.
    // We just ensure the endpoint is accessible.
    expect([200, 400, 404]).toContain(response.status());
  });

  test('Partner config API should return 400 if repoId is missing', async ({
    request,
  }) => {
    const response = await request.get('/api/agent/partner-config');

    // Expected to return 400 since repoId is missing, meaning it's reachable and not redirecting.
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'repoId is required');
  });
});
