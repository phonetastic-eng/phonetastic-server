import { describe, it, expect, vi } from 'vitest';
import { StubFirecrawlService, RealFirecrawlService } from '../../../src/services/firecrawl-service.js';

vi.mock('@mendable/firecrawl-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    map: vi.fn().mockResolvedValue({ links: [{ url: 'https://acme.com/about' }, { url: 'https://acme.com/services' }] }),
    scrape: vi.fn().mockResolvedValue({
      markdown: 'Page content here.',
      html: '<p>Page content here.</p>',
      rawHtml: '<html><head><script type="application/ld+json">{}</script></head><body><p>Page content here.</p></body></html>',
      json: { name: 'Acme', industry: 'Software' },
    }),
  })),
}));

describe('StubFirecrawlService', () => {
  const service = new StubFirecrawlService();

  it('maps a site and returns discovered URLs', async () => {
    const urls = await service.mapSite('https://acme.com');
    expect(urls).toContain('https://acme.com/about');
    expect(service.mappedSites).toContain('https://acme.com');
  });

  it('scrapes a page and returns markdown by default', async () => {
    const content = await service.scrapePage('https://acme.com/about');
    expect(content).toContain('Stub content for');
    expect(service.scrapedPages).toContain('https://acme.com/about');
  });

  it('scrapes a page and returns html content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'html');
    expect(content).toContain('Stub content for');
  });

  it('scrapes a page and returns rawHtml content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'rawHtml');
    expect(content).toContain('Stub content for');
  });

  it('scrapes a page and returns json content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'json');
    expect(content).toEqual({ stub: true, url: 'https://acme.com/about' });
  });
});

describe('RealFirecrawlService', () => {
  const service = new RealFirecrawlService('test-api-key');

  it('maps a site and returns URLs from the client', async () => {
    const urls = await service.mapSite('https://acme.com');
    expect(urls).toEqual(['https://acme.com/about', 'https://acme.com/services']);
  });

  it('scrapes a page and returns markdown by default', async () => {
    const content = await service.scrapePage('https://acme.com/about');
    expect(content).toBe('Page content here.');
  });

  it('scrapes a page and returns html content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'html');
    expect(content).toBe('<p>Page content here.</p>');
  });

  it('scrapes a page and returns rawHtml content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'rawHtml');
    expect(content).toContain('<head>');
  });

  it('scrapes a page and returns json content', async () => {
    const content = await service.scrapePage('https://acme.com/about', 'json');
    expect(content).toEqual({ name: 'Acme', industry: 'Software' });
  });
});
