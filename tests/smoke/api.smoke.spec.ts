import { test, expect } from '@playwright/test';

// Smoke tests are READ-ONLY so they are safe to run against any environment.
test.describe('API smoke', { tag: '@smoke' }, () => {
  test('health endpoint reports ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  test('books endpoint returns a non-empty catalogue', async ({ request }) => {
    const res = await request.get('/api/books');
    expect(res.status(), 'GET /api/books status').toBe(200);

    const body = await res.json();
    expect(body.total, 'total number of books in the catalogue').toBeGreaterThan(0);
    expect(body.items.length, 'number of books on the first page').toBeGreaterThan(0);
    expect(body.items[0]).toEqual(
      expect.objectContaining({ id: expect.any(Number), title: expect.any(String), availableCopies: expect.any(Number) }),
    );
  });

  test('members endpoint returns members', async ({ request }) => {
    const res = await request.get('/api/members');
    expect(res.status()).toBe(200);
    expect((await res.json()).length, 'number of members').toBeGreaterThan(0);
  });

  test('loans endpoint responds with a list', async ({ request }) => {
    const res = await request.get('/api/loans');
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
