import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test('Vite refuses Wasm probing of the public fictional environment example', async ({
  request,
}) => {
  // GHSA-vfpm-58rq-9qcg: use only a committed placeholder fixture, never the real .env.
  const fixture = resolve('.env.example').replaceAll('\\', '/');
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  const response = await request.get(`/@fs${fixture}?vite-wasm-instance`);
  expect(response.status()).toBe(403);
  const body = await response.text();
  expect(body).not.toMatch(/4e[ ,]?4f[ ,]?44[ ,]?45/i);
  expect(body).not.toContain('NODE_ENV=development');
  expect(body).not.toContain('expected magic word');
});
