import type { FastifyInstance } from 'fastify';

/**
 * Creates a test user and returns user data with auth token.
 *
 * @param app - The Fastify test app instance.
 * @param overrides - Optional field overrides.
 * @returns User data and JWT access token.
 */
export async function createTestUser(
  app: FastifyInstance,
  overrides?: { firstName?: string; phoneNumber?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/users?expand=call_settings,bot,bot_settings',
    payload: {
      user: {
        first_name: overrides?.firstName ?? 'Test',
        last_name: 'User',
        phone_number: overrides?.phoneNumber ?? `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
      },
    },
  });

  const body = response.json();
  return {
    user: body.user,
    accessToken: body.auth.access_token.jwt as string,
    refreshToken: body.auth.refresh_token.jwt as string,
  };
}
