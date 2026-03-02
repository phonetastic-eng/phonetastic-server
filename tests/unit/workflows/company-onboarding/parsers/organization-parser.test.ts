import { describe, it, expect } from 'vitest';
import { parseOrganizationData } from '../../../../../src/workflows/company-onboarding/parsers/organization-parser.js';

function htmlWithLdJson(data: object): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;
}

describe('parseOrganizationData', () => {
  it('returns null when no JSON-LD is present', async () => {
    expect(await parseOrganizationData('<html></html>')).toBeNull();
  });

  it('returns null when JSON-LD contains no Organization entity', async () => {
    const html = htmlWithLdJson({ '@type': 'Product', name: 'Widget' });
    expect(await parseOrganizationData(html)).toBeNull();
  });

  it('returns null for LocalBusiness (subtype not matched)', async () => {
    const html = htmlWithLdJson({ '@type': 'LocalBusiness', name: 'Acme' });
    expect(await parseOrganizationData(html)).toBeNull();
  });

  it('extracts name from name field', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme Corp' });
    const result = await parseOrganizationData(html);
    expect(result?.name).toBe('Acme Corp');
  });

  it('prefers legalName over name', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme', legalName: 'Acme Incorporated' });
    const result = await parseOrganizationData(html);
    expect(result?.name).toBe('Acme Incorporated');
  });

  it('extracts top-level email', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme', email: 'info@acme.com' });
    const result = await parseOrganizationData(html);
    expect(result?.email).toBe('info@acme.com');
  });

  it('extracts email from contactPoint when top-level is absent', async () => {
    const html = htmlWithLdJson({
      '@type': 'Organization',
      name: 'Acme',
      contactPoint: { '@type': 'ContactPoint', email: 'support@acme.com' },
    });
    const result = await parseOrganizationData(html);
    expect(result?.email).toBe('support@acme.com');
  });

  it('extracts a structured PostalAddress', async () => {
    const html = htmlWithLdJson({
      '@type': 'Organization',
      name: 'Acme',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '123 Main St',
        addressLocality: 'Springfield',
        addressRegion: 'IL',
        postalCode: '62701',
        addressCountry: 'US',
      },
    });
    const result = await parseOrganizationData(html);
    expect(result?.address).toEqual({
      streetAddress: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
      label: 'main',
    });
  });

  it('extracts a plain-string address', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme', address: '123 Main St' });
    const result = await parseOrganizationData(html);
    expect(result?.address).toEqual({
      streetAddress: '123 Main St',
      city: null,
      state: null,
      postalCode: null,
      country: null,
      label: 'main',
    });
  });

  it('extracts a top-level telephone as E.164', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme', telephone: '+15125550100' });
    const result = await parseOrganizationData(html);
    expect(result?.phoneNumbers).toEqual([{ phoneNumberE164: '+15125550100', label: 'main' }]);
  });

  it('extracts phone numbers from contactPoint', async () => {
    const html = htmlWithLdJson({
      '@type': 'Organization',
      name: 'Acme',
      contactPoint: { '@type': 'ContactPoint', telephone: '+15125550101', contactType: 'customer service' },
    });
    const result = await parseOrganizationData(html);
    expect(result?.phoneNumbers).toEqual([{ phoneNumberE164: '+15125550101', label: 'customer service' }]);
  });

  it('always returns empty operationHours', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization', name: 'Acme' });
    const result = await parseOrganizationData(html);
    expect(result?.operationHours).toEqual([]);
  });

  it('finds Organization inside a @graph container', async () => {
    const html = htmlWithLdJson({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Acme Site' },
        { '@type': 'Organization', name: 'Acme Corp', email: 'hi@acme.com' },
      ],
    });
    const result = await parseOrganizationData(html);
    expect(result?.name).toBe('Acme Corp');
    expect(result?.email).toBe('hi@acme.com');
  });

  it('skips malformed JSON blocks and continues', async () => {
    const html = `
      <script type="application/ld+json">{ bad json }</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: 'Acme' })}</script>
    `;
    const result = await parseOrganizationData(html);
    expect(result?.name).toBe('Acme');
  });

  it('returns null when all fields are empty', async () => {
    const html = htmlWithLdJson({ '@type': 'Organization' });
    const result = await parseOrganizationData(html);
    expect(result).not.toBeNull();
    expect(result?.name).toBeNull();
    expect(result?.email).toBeNull();
    expect(result?.address).toBeNull();
    expect(result?.phoneNumbers).toEqual([]);
  });
});
