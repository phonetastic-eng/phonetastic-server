import { describe, it, expect } from 'vitest';
import { parseWebPageData } from '../../../../../src/workflows/company-onboarding/parsers/webpage-parser.js';

function htmlWithLdJson(data: object): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;
}

describe('parseWebPageData', () => {
  it('returns null when no JSON-LD is present', async () => {
    expect(await parseWebPageData('<html></html>')).toBeNull();
  });

  it('returns null when JSON-LD contains no WebPage entity', async () => {
    expect(await parseWebPageData(htmlWithLdJson({ '@type': 'Product', name: 'Widget' }))).toBeNull();
  });

  it('returns null for LocalBusiness (subtype not matched)', async () => {
    expect(await parseWebPageData(htmlWithLdJson({ '@type': 'AboutPage', name: 'About Us' }))).toBeNull();
  });

  it('extracts name', async () => {
    const result = await parseWebPageData(htmlWithLdJson({ '@type': 'WebPage', name: 'Acme Home' }));
    expect(result?.name).toBe('Acme Home');
  });

  it('returns null name when name field is absent', async () => {
    const result = await parseWebPageData(htmlWithLdJson({ '@type': 'WebPage' }));
    expect(result).not.toBeNull();
    expect(result?.name).toBeNull();
  });

  it('always returns null email, null address, empty operationHours, and empty phoneNumbers', async () => {
    const result = await parseWebPageData(htmlWithLdJson({ '@type': 'WebPage', name: 'Acme Home' }));
    expect(result?.email).toBeNull();
    expect(result?.address).toBeNull();
    expect(result?.operationHours).toEqual([]);
    expect(result?.phoneNumbers).toEqual([]);
  });

  it('finds WebPage inside a @graph container', async () => {
    const html = htmlWithLdJson({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Acme Corp' },
        { '@type': 'WebPage', name: 'Acme Home' },
      ],
    });
    expect((await parseWebPageData(html))?.name).toBe('Acme Home');
  });

  it('skips malformed JSON blocks and continues', async () => {
    const html = `
      <script type="application/ld+json">{ bad json }</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'WebPage', name: 'Acme Home' })}</script>
    `;
    expect((await parseWebPageData(html))?.name).toBe('Acme Home');
  });
});
