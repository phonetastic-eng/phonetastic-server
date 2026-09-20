/**
 * Cursor-based pagination helpers shared by list endpoints.
 *
 * Every list API paginates on an opaque `page_token` that carries the id of
 * the last row on the current page.
 */

/** Raw pagination query string as received by Fastify. */
export interface PageQuery {
  page_token?: string;
  limit?: string;
}

/** Parsed pagination options accepted by service and repository methods. */
export interface PageParams {
  pageToken?: number;
  limit?: number;
}

/**
 * Parses the `page_token` and `limit` query parameters into numbers.
 *
 * @param query - The request query string.
 * @returns Parsed options, with each field undefined when its parameter is absent.
 */
export function parsePageParams(query: PageQuery): PageParams {
  return {
    pageToken: query.page_token ? Number(query.page_token) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  };
}

/**
 * Builds the `page_token` for the next page from a page of rows.
 *
 * @param rows - The rows returned for the current page, in page order.
 * @returns The id of the last row, or null when the page is empty.
 */
export function nextPageToken(rows: { id: number }[]): number | null {
  return rows.length > 0 ? rows[rows.length - 1].id : null;
}
