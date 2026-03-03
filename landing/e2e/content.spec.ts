import { test, expect } from '@playwright/test';

test.describe('Page Content', () => {
  test('homepage displays key sections', async ({ page }) => {
    await page.goto('/');

    // Hero section
    await expect(page.getByText('Make Your Codebase')).toBeVisible();

    // Agent Prompt (default tab)
    await expect(
      page.getByText('agent prompt', { exact: false })
    ).toBeVisible();

    // Navigation links
    await expect(
      page.getByRole('link', { name: 'Docs', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Blog', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Unified CLI', exact: true })
    ).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');

    // Click Blog
    await page.getByRole('link', { name: 'Blog', exact: true }).click();
    await expect(page).toHaveURL(/\/blog/);
    await expect(page.getByText('Latest Insights')).toBeVisible();

    // Click a post
    await page.getByText('The Agentic Wall').first().click();
    await expect(page).toHaveURL(/\/blog\/the-agentic-wall/);
  });
});
