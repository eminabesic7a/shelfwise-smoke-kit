import { test, expect } from '@playwright/test';

// Regular (non-smoke) tests: they change data, so they reset it first and run serially.
// They need POST /api/test/reset, so run them against a local or test environment only.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/test/reset')).ok()).toBe(true);
});

test('adding a book shows it on its details page', async ({ page }) => {
  await page.goto('/books/new');
  await page.getByLabel('Title').fill('Test Driven Development');
  await page.getByLabel('Author').fill('Kent Beck');
  await page.getByLabel('ISBN').fill('978-0-321-14653-3');
  await page.getByLabel('Genre').selectOption('Non-Fiction');
  await page.getByLabel('Year published').fill('2002');
  await page.getByRole('button', { name: 'Add book' }).click();

  await expect(page.getByTestId('toast-success')).toContainText('Added "Test Driven Development"');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test Driven Development');
});

test('a member with an overdue loan cannot borrow', async ({ page }) => {
  await page.goto('/books/1');
  await page.getByLabel('Member').selectOption({ label: 'Bob Smith (2/3 on loan)' });
  await page.getByRole('button', { name: 'Lend book' }).click();
  await expect(page.getByTestId('lend-error')).toContainText('overdue loans');
});


test('the add book form displays its required fields', async ({ page }) => {
  await page.goto('/books/new');

  await expect(page.getByLabel('Title')).toBeVisible();
  await expect(page.getByLabel('Author')).toBeVisible();
  await expect(page.getByLabel('ISBN')).toBeVisible();
  await expect(page.getByLabel('Genre')).toBeVisible();
  await expect(page.getByLabel('Year published')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add book' })).toBeVisible();
});
