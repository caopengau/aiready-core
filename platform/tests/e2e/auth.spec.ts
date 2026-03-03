import { test, expect } from '@playwright/test';

test.describe('Authentication and Routing', () => {
  test('should redirect unauthenticated users from /dashboard to /login', async ({
    page,
  }) => {
    // Attempt to access a protected route
    await page.goto('/dashboard');

    // Check if the URL changed to the login page
    await expect(page).toHaveURL(/.*\/login/);

    // Verify the login page renders
    const loginHeader = page.locator('h1', { hasText: 'Welcome to AIReady' });
    await expect(loginHeader).toBeVisible();
  });

  test('should load the login page directly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*\/login/);
    const loginHeader = page.locator('h1', { hasText: 'Welcome to AIReady' });
    await expect(loginHeader).toBeVisible();
  });
});
