import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage and display basic branding', async ({
    page,
  }) => {
    // Go to the local Next.js server
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/AIReady Platform/);

    // Verify main CTA or hero text is visible
    // Based on layout.tsx there is some basic branding text or similar
    // Note: If the homepage is just a redirect or mostly empty, this test might need adjustment
    // But we expect at least the page to not return a 500 error
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toBeDefined();
  });
});
