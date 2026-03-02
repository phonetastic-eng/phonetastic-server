import Firecrawl from '@mendable/firecrawl-js';

/** The output format to request from Firecrawl when scraping a page. */
export type ScrapeFormat = 'markdown' | 'html' | 'rawHtml' | 'json';

/**
 * Interface for Firecrawl web scraping operations.
 * Implementations interact with the Firecrawl API for site mapping and page scraping.
 */
export interface FirecrawlService {
  /**
   * Maps a website to discover reachable URLs.
   *
   * @param siteUrl - The root URL to map.
   * @returns An array of discovered URLs.
   */
  mapSite(siteUrl: string): Promise<string[]>;

  /**
   * Scrapes the content of a single page in the requested format.
   *
   * @param url - The URL to scrape.
   * @param format - `'json'` to extract structured data as an object.
   * @returns The structured data extracted from the page.
   */
  scrapePage(url: string, format: 'json'): Promise<Record<string, unknown>>;

  /**
   * Scrapes the content of a single page in the requested format.
   *
   * @param url - The URL to scrape.
   * @param format - `'markdown'` (default), `'html'`, or `'rawHtml'` to get the page as a string.
   *   Use `'rawHtml'` to retrieve the full unprocessed document including `<head>`, which is
   *   required when the page embeds JSON-LD structured data.
   * @returns The page content as a string.
   */
  scrapePage(url: string, format?: 'markdown' | 'html' | 'rawHtml'): Promise<string>;
}

/**
 * Stub Firecrawl service for development and testing.
 */
export class StubFirecrawlService implements FirecrawlService {
  public readonly mappedSites: string[] = [];
  public readonly scrapedPages: string[] = [];

  async mapSite(siteUrl: string): Promise<string[]> {
    this.mappedSites.push(siteUrl);
    return [
      `${siteUrl}/about`,
      `${siteUrl}/services`,
      `${siteUrl}/products`,
      `${siteUrl}/contact`,
    ];
  }

  scrapePage(url: string, format: 'json'): Promise<Record<string, unknown>>;
  scrapePage(url: string, format?: 'markdown' | 'html' | 'rawHtml'): Promise<string>;
  async scrapePage(url: string, format: ScrapeFormat = 'markdown'): Promise<string | Record<string, unknown>> {
    this.scrapedPages.push(url);
    if (format === 'json') return { stub: true, url };
    return `Stub content for ${url}. We offer premium services and products.`;
  }
}

/**
 * Firecrawl-backed web scraping service for production use.
 *
 * @precondition A valid Firecrawl API key.
 * @postcondition Site mapping returns discovered URLs; page scraping returns markdown content.
 */
export class RealFirecrawlService implements FirecrawlService {
  private readonly client: Firecrawl;

  /**
   * @param apiKey - Firecrawl API key.
   */
  constructor(apiKey: string) {
    this.client = new Firecrawl({ apiKey });
  }

  /** {@inheritDoc FirecrawlService.mapSite} */
  async mapSite(siteUrl: string): Promise<string[]> {
    const response = await this.client.map(siteUrl);
    return response.links.map((link) => link.url);
  }

  /** {@inheritDoc FirecrawlService.scrapePage} */
  scrapePage(url: string, format: 'json'): Promise<Record<string, unknown>>;
  scrapePage(url: string, format?: 'markdown' | 'html' | 'rawHtml'): Promise<string>;
  async scrapePage(url: string, format: ScrapeFormat = 'markdown'): Promise<string | Record<string, unknown>> {
    const doc = await this.client.scrape(url, { formats: [format] });
    if (format === 'json') return ((doc as { json?: Record<string, unknown> }).json) ?? {};
    if (format === 'html') return doc.html ?? '';
    if (format === 'rawHtml') return (doc as { rawHtml?: string }).rawHtml ?? '';
    return doc.markdown ?? '';
  }
}
