import { test, expect } from '@playwright/test';

test.describe('Sign In', () => {
  test('should display sign in page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveTitle(/Digital Logbook/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should show email input and password input', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
