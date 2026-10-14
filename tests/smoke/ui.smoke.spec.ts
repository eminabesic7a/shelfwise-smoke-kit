import { test, expect } from '@playwright/test';

test.describe('UI smoke', { tag: '@smoke' }, () => {
  test('dashboard shows the bookshelf', async ({ page }) => {
    await test.step('open the dashboard', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: 'The shelf today' })).toBeVisible();
    });
    await test.step('the shelf contains at least one book', async () => {
      await expect(page.getByTestId('shelf-book').first()).toBeVisible();
    });
  });

  test('book catalogue lists books and opens a book', async ({ page }) => {
    await test.step('open the catalogue', async () => {
      await page.goto('/books');
      await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
    });

    const firstTitle = page.getByTestId('book-row').first().getByTestId('book-title');
    let title = '';
    await test.step('the catalogue shows at least one book', async () => {
      await expect(firstTitle).toBeVisible();
      title = (await firstTitle.textContent()) ?? '';
    });

    await test.step('clicking a title opens its details page', async () => {
      await firstTitle.click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    });
  });

  test('members page lists members', async ({ page }) => {
    await page.goto('/members');
    await expect(page.getByTestId('member-row').first()).toBeVisible();
  });

  test('loans page loads', async ({ page }) => {
    await page.goto('/loans');
    await expect(page.getByRole('heading', { level: 1, name: 'Loans' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });
});
