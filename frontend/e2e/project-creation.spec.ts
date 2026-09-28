import { test, expect } from '@playwright/test';

test.describe('Project Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in first
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill('cocaine1013@gmail.com');
    await page.getByLabel(/password/i).fill('Test1234!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('should open new project modal', async ({ page }) => {
    await page.getByRole('button', { name: /\+ new/i }).click();
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();
  });

  test('should create project with multiple columns', async ({ page }) => {
    // Open new project modal
    await page.getByRole('button', { name: /\+ new/i }).click();

    // Fill project name
    await page.getByLabel(/project name/i).fill('Test Project');

    // Add first column
    await page
      .getByPlaceholder(/field name/i)
      .first()
      .fill('Hypothesis');
    await page.getByRole('combobox').first().selectOption('markdown');

    // Add second column
    await page.getByRole('button', { name: /\+ add another project column/i }).click();
    await page
      .getByPlaceholder(/field name/i)
      .nth(1)
      .fill('Method');
    await page.getByRole('combobox').nth(1).selectOption('markdown');

    // Add third column
    await page.getByRole('button', { name: /\+ add another project column/i }).click();
    await page
      .getByPlaceholder(/field name/i)
      .nth(2)
      .fill('Results');
    await page.getByRole('combobox').nth(2).selectOption('text');

    // Create project
    await page.getByRole('button', { name: /create/i }).click();

    // Should navigate to project page
    await page.waitForURL('**/project/Test%20Project');
    await expect(page.getByRole('heading', { name: /test project/i })).toBeVisible();
  });

  test('should show template picker', async ({ page }) => {
    await page.getByRole('button', { name: /\+ new/i }).click();

    // Click template picker button
    await page.getByRole('button', { name: /choose a template/i }).click();
    await expect(page.getByRole('heading', { name: /choose a template/i })).toBeVisible();

    // Should have tabs
    await expect(page.getByRole('button', { name: /built-in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /personal/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /global/i })).toBeVisible();
  });
});
