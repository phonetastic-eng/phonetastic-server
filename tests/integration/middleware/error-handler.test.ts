import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from '../../../src/middleware/error-handler.js';

describe('Error handler middleware', () => {
  let app: FastifyInstance;

  afterAll(async () => {
    await app.close();
  });

  it('returns 500 and logs the error for non-AppError exceptions', async () => {
    app = Fastify({ logger: true });
    registerErrorHandler(app);

    app.get('/test-throw', async () => {
      throw new TypeError('something broke');
    });

    await app.ready();

    const logSpy = vi.spyOn(app.log, 'error');

    const response = await app.inject({
      method: 'GET',
      url: '/test-throw',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 500, message: 'Internal server error' },
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'something broke' }),
      'Unhandled error',
    );

    logSpy.mockRestore();
  });
});
