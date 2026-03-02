import { describe, it, expect } from 'vitest';
import { getTestApp } from '../helpers/test-app.js';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
