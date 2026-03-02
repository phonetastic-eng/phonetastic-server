import { describe, it, expect } from 'vitest';
import { findContactUrl } from '../../../../src/workflows/company-onboarding/site-map.js';

describe('findContactUrl', () => {
  it('returns the /contact-us URL when present', () => {
    const siteMap = ['https://example.com/', 'https://example.com/contact-us', 'https://example.com/about'];
    expect(findContactUrl(siteMap)).toBe('https://example.com/contact-us');
  });

  it('returns the /contact URL when /contact-us is absent', () => {
    const siteMap = ['https://example.com/', 'https://example.com/contact', 'https://example.com/about'];
    expect(findContactUrl(siteMap)).toBe('https://example.com/contact');
  });

  it('prefers /contact-us over /contact', () => {
    const siteMap = ['https://example.com/contact', 'https://example.com/contact-us'];
    expect(findContactUrl(siteMap)).toBe('https://example.com/contact-us');
  });

  it('returns null when no contact URL is found', () => {
    const siteMap = ['https://example.com/', 'https://example.com/about'];
    expect(findContactUrl(siteMap)).toBeNull();
  });

  it('returns null for an empty site map', () => {
    expect(findContactUrl([])).toBeNull();
  });
});
