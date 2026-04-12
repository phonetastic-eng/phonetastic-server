import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@dbos-inc/dbos-sdk', () => ({
  DBOS: {
    step: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
    workflow: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
  },
}));

const mockContainer = vi.hoisted(() => ({
  container: { resolve: vi.fn() },
}));
vi.mock('tsyringe', () => mockContainer);

const mockB = vi.hoisted(() => ({
  ExtractFAQs: vi.fn(),
  ExtractOfferings: vi.fn(),
  RankPages: vi.fn(),
}));
vi.mock('../../../src/baml_client/index.js', () => ({ b: mockB }));

import { ExtractOffersAndFAQs } from '../../../src/workflows/extract-offers-and-faqs.js';

const htmlWithMeta = (title: string, description: string) =>
  `<html><head><title>${title}</title><meta name="description" content="${description}"></head></html>`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExtractOffersAndFAQs.fetchPageMetadata', () => {
  it('returns title and description for successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(htmlWithMeta('Pest Control FAQ', 'Answers to common pest questions')),
    }));

    const result = await ExtractOffersAndFAQs.fetchPageMetadata(['https://example.com/faq']);

    expect(result).toEqual([
      { url: 'https://example.com/faq', title: 'Pest Control FAQ', description: 'Answers to common pest questions' },
    ]);
  });

  it('skips non-200 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await ExtractOffersAndFAQs.fetchPageMetadata(['https://example.com/missing']);

    expect(result).toEqual([]);
  });

  it('skips pages that throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const result = await ExtractOffersAndFAQs.fetchPageMetadata(['https://example.com/slow']);

    expect(result).toEqual([]);
  });

  it('processes multiple URLs in parallel and filters failures', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue(htmlWithMeta('Page A', 'Desc A')) })
      .mockRejectedValueOnce(new Error('timeout')));

    const result = await ExtractOffersAndFAQs.fetchPageMetadata([
      'https://example.com/a',
      'https://example.com/b',
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Page A');
  });
});

describe('ExtractOffersAndFAQs.rankPages', () => {
  it('returns empty arrays when no candidates', async () => {
    const result = await ExtractOffersAndFAQs.rankPages([], 'PestControl');

    expect(result).toEqual({ faqUrls: [], offeringUrls: [] });
    expect(mockB.RankPages).not.toHaveBeenCalled();
  });

  it('returns ranked URLs from the LLM', async () => {
    mockB.RankPages.mockResolvedValue({
      faq_urls: ['https://example.com/faq'],
      offering_urls: ['https://example.com/services'],
    });

    const result = await ExtractOffersAndFAQs.rankPages(
      [{ url: 'https://example.com/faq', title: 'FAQ', description: 'questions' }],
      'PestControl',
    );

    expect(result).toEqual({
      faqUrls: ['https://example.com/faq'],
      offeringUrls: ['https://example.com/services'],
    });
    expect(mockB.RankPages).toHaveBeenCalledWith(
      [{ url: 'https://example.com/faq', title: 'FAQ', description: 'questions' }],
      'PestControl',
    );
  });
});

describe('ExtractOffersAndFAQs.extractFaqsFromPage', () => {
  it('scrapes the page and returns FAQs from BAML', async () => {
    const mockFirecrawl = { scrapePage: vi.fn().mockResolvedValue('page content') };
    mockContainer.container.resolve.mockReturnValue(mockFirecrawl);
    mockB.ExtractFAQs.mockResolvedValue([{ question: 'Q?', answer: 'A.' }]);

    const result = await ExtractOffersAndFAQs.extractFaqsFromPage('https://example.com/faq');

    expect(mockFirecrawl.scrapePage).toHaveBeenCalledWith('https://example.com/faq', 'html');
    expect(mockB.ExtractFAQs).toHaveBeenCalledWith('page content');
    expect(result).toEqual([{ question: 'Q?', answer: 'A.' }]);
  });
});

describe('ExtractOffersAndFAQs.extractOfferingsFromPage', () => {
  it('scrapes the page and returns offerings from BAML', async () => {
    const mockFirecrawl = { scrapePage: vi.fn().mockResolvedValue('services content') };
    mockContainer.container.resolve.mockReturnValue(mockFirecrawl);
    mockB.ExtractOfferings.mockResolvedValue([{ type: 'service', name: 'Pest Inspection', description: null, price: null }]);

    const result = await ExtractOffersAndFAQs.extractOfferingsFromPage('https://example.com/services');

    expect(mockFirecrawl.scrapePage).toHaveBeenCalledWith('https://example.com/services', 'html');
    expect(mockB.ExtractOfferings).toHaveBeenCalledWith('services content');
    expect(result).toEqual([{ type: 'service', name: 'Pest Inspection', description: null, price: null }]);
  });
});
