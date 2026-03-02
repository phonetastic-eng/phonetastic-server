const CONTACT_PATHS = ['/contact-us', '/contact'];

/**
 * Finds the contact page URL from a site map.
 *
 * @param siteMap - Array of URLs discovered from the site.
 * @returns The contact page URL, or null if none is found.
 * @boundary Prioritizes `/contact-us` over `/contact`.
 */
export function findContactUrl(siteMap: string[]): string | null {
  for (const path of CONTACT_PATHS) {
    const match = siteMap.find((url) => new URL(url).pathname === path);
    if (match) return match;
  }
  return null;
}
