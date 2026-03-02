import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseLocalBusinessData,
} from '../../../../../src/workflows/company-onboarding/parsers/local-business-parser.js';

const mockB = vi.hoisted(() => ({ ParseOperationHours: vi.fn() }));
vi.mock('../../../../../src/baml_client/index.js', () => ({ b: mockB }));

function htmlWith(entity: object): string {
  return `<script type="application/ld+json">${JSON.stringify(entity)}</script>`;
}

const malcoElectric = {
  '@type': 'Electrician',
  legalName: 'Malco Electric LLC',
  name: 'Malco Electric — Austin TX',
  email: 'info@malcoelectric.com',
  telephone: '+15125550100',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '123 Main St',
    addressLocality: 'Austin',
    addressRegion: 'TX',
    postalCode: '78701',
    addressCountry: 'US',
  },
  openingHoursSpecification: [
    { dayOfWeek: 'Monday', opens: '08:00', closes: '17:00' },
    { dayOfWeek: 'Tuesday', opens: '08:00', closes: '17:00' },
    { dayOfWeek: 'Wednesday', opens: '08:00', closes: '17:00' },
    { dayOfWeek: 'Thursday', opens: '08:00', closes: '17:00' },
    { dayOfWeek: 'Friday', opens: '08:00', closes: '17:00' },
  ],
};

describe('parseLocalBusinessData', () => {
  it('extracts all 5 fields from a full LocalBusiness entity', async () => {
    const result = await parseLocalBusinessData(htmlWith(malcoElectric));
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Malco Electric — Austin TX');
    expect(result!.email).toBe('info@malcoelectric.com');
    expect(result!.address?.streetAddress).toBe('123 Main St');
    expect(result!.operationHours).toHaveLength(5);
    expect(result!.phoneNumbers).toHaveLength(1);
  });

  it('returns null when no LocalBusiness entity is present', async () => {
    const html = htmlWith({ '@type': 'WebPage', name: 'Home' })
      + htmlWith({ '@type': 'Organization', name: 'Acme Corp' });
    expect(await parseLocalBusinessData(html)).toBeNull();
  });

  it('returns null for html with no JSON-LD', async () => {
    expect(await parseLocalBusinessData('<html><body><p>No structured data</p></body></html>')).toBeNull();
  });

  it('returns the first LocalBusiness entity when multiple blocks are present', async () => {
    const html = htmlWith(malcoElectric) + htmlWith({ '@type': 'LocalBusiness', name: 'Second Location' });
    expect((await parseLocalBusinessData(html))!.name).toBe('Malco Electric — Austin TX');
  });

  it('handles a JSON-LD array block', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify([
      { '@type': 'WebPage', name: 'Home' },
      malcoElectric,
    ])}</script>`;
    expect((await parseLocalBusinessData(html))!.name).toBe('Malco Electric — Austin TX');
  });

  it('handles a @graph container block', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'FAQPage' }, malcoElectric],
    })}</script>`;
    expect((await parseLocalBusinessData(html))!.name).toBe('Malco Electric — Austin TX');
  });

  it('skips malformed JSON blocks and continues', async () => {
    const html = '<script type="application/ld+json">{ bad json }</script>'
      + htmlWith(malcoElectric);
    expect((await parseLocalBusinessData(html))!.name).toBe('Malco Electric — Austin TX');
  });
});

describe('name extraction', () => {
  it('prefers name over legalName', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', legalName: 'Acme LLC', name: 'Acme — Downtown' }));
    expect(result!.name).toBe('Acme — Downtown');
  });

  it('falls back to legalName when name is absent', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', name: 'Acme Plumbing' }));
    expect(result!.name).toBe('Acme Plumbing');
  });

  it('strips HTML tags from the name field', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', name: '<b>Acme Plumbing</b>' }));
    expect(result!.name).toBe('Acme Plumbing');
  });

  it('returns null when neither legalName nor name is present', async () => {
    expect((await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness' })))!.name).toBeNull();
  });
});

describe('subtype detection', () => {
  it('recognizes an HVACBusiness subtype', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'HVACBusiness', name: 'Cool Air HVAC' }));
    expect(result!.name).toBe('Cool Air HVAC');
  });

  it('recognizes array @type containing a LocalBusiness subtype', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': ['LocalBusiness', 'CleaningService'], name: 'Sparkle Clean' }));
    expect(result!.name).toBe('Sparkle Clean');
  });
});

describe('email extraction', () => {
  it('uses the top-level email when valid', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', email: 'hello@example.com' }));
    expect(result!.email).toBe('hello@example.com');
  });

  it('returns null for an invalid email format', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', email: 'not-an-email' }));
    expect(result!.email).toBeNull();
  });

  it('falls back to contactPoint email when top-level email is absent', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', email: 'support@example.com' }],
    }));
    expect(result!.email).toBe('support@example.com');
  });

  it('returns null when no email is found', async () => {
    expect((await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', name: 'No Email Biz' })))!.email).toBeNull();
  });
});

describe('address extraction', () => {
  it('extracts a full PostalAddress', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      address: { '@type': 'PostalAddress', streetAddress: '123 Main St', addressLocality: 'Austin', addressRegion: 'TX', postalCode: '78701', addressCountry: 'US' },
    }));
    expect(result!.address).toEqual({ streetAddress: '123 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US', label: 'main' });
  });

  it('stores a plain string address in streetAddress with other fields null', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', address: '456 Oak Ave, Dallas, TX' }));
    expect(result!.address!.streetAddress).toBe('456 Oak Ave, Dallas, TX');
    expect(result!.address!.city).toBeNull();
    expect(result!.address!.label).toBe('main');
  });

  it('accepts a partial address with only city and state', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX' },
    }));
    expect(result!.address!.streetAddress).toBeNull();
    expect(result!.address!.city).toBe('Austin');
    expect(result!.address!.state).toBe('TX');
  });

  it('returns null when all PostalAddress fields are empty strings', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      address: { '@type': 'PostalAddress', streetAddress: '', addressLocality: '', addressRegion: '' },
    }));
    expect(result!.address).toBeNull();
  });

  it('returns null for an empty string address', async () => {
    expect((await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', address: '' })))!.address).toBeNull();
  });

  it('extracts country name from a Country object', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressCountry: { '@type': 'Country', name: 'United States' } },
    }));
    expect(result!.address!.country).toBe('United States');
  });
});

describe('operation hours extraction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses openingHoursSpecification and ignores openingHours text when both present', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      openingHoursSpecification: [
        { dayOfWeek: 'Monday', opens: '09:00', closes: '17:00' },
        { dayOfWeek: 'Friday', opens: '09:00', closes: '17:00' },
      ],
      openingHours: 'Mo-Fr 08:00-18:00',
    }));
    expect(result!.operationHours).toHaveLength(2);
    expect(result!.operationHours[0]).toEqual({ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' });
  });

  it('falls back to openingHours text when specification is absent', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', openingHours: 'Mo-Fr 09:00-17:00, Sa 10:00-14:00' }));
    expect(result!.operationHours).toHaveLength(6);
  });

  it('handles schema.org URL-style dayOfWeek values', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      openingHoursSpecification: [{ dayOfWeek: 'https://schema.org/Monday', opens: '09:00', closes: '17:00' }],
    }));
    expect(result!.operationHours[0]?.dayOfWeek).toBe(1);
  });

  it('skips specification entries with missing opens or closes', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      openingHoursSpecification: [
        { dayOfWeek: 'Monday', opens: '09:00', closes: '17:00' },
        { dayOfWeek: 'Tuesday', opens: '', closes: '' },
      ],
    }));
    expect(result!.operationHours).toHaveLength(1);
  });

  it('returns empty array when no hours properties exist', async () => {
    expect((await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness' })))!.operationHours).toEqual([]);
  });

  it('parses 24/7 openingHours text into 7 rows', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', openingHours: 'Mo-Su 00:00-23:59' }));
    expect(result!.operationHours).toHaveLength(7);
  });

  it('falls back to BAML when text parser cannot parse the format', async () => {
    mockB.ParseOperationHours.mockResolvedValue([{ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' }]);
    const result = await parseLocalBusinessData(
      htmlWith({ '@type': 'LocalBusiness', openingHours: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday 09:00-17:00' }),
    );
    expect(mockB.ParseOperationHours).toHaveBeenCalledTimes(1);
    expect(result!.operationHours).toHaveLength(1);
  });

  it('does not call BAML when text parser succeeds', async () => {
    await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', openingHours: 'Mo-Fr 09:00-17:00' }));
    expect(mockB.ParseOperationHours).not.toHaveBeenCalled();
  });
});

describe('phone number extraction', () => {
  it('extracts the top-level telephone with label "main"', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', telephone: '+15125550100' }));
    expect(result!.phoneNumbers).toEqual([{ phoneNumberE164: '+15125550100', label: 'main' }]);
  });

  it('extracts multiple contactPoint entries with their labels', async () => {
    const result = await parseLocalBusinessData(htmlWith({
      '@type': 'LocalBusiness',
      contactPoint: [
        { '@type': 'ContactPoint', contactType: 'customer service', telephone: '+15125550101' },
        { '@type': 'ContactPoint', contactType: 'sales', telephone: '+15125550102' },
      ],
    }));
    expect(result!.phoneNumbers).toHaveLength(2);
    expect(result!.phoneNumbers[0]).toEqual({ phoneNumberE164: '+15125550101', label: 'customer service' });
    expect(result!.phoneNumbers[1]).toEqual({ phoneNumberE164: '+15125550102', label: 'sales' });
  });

  it('skips entries that cannot be normalized to E.164', async () => {
    const result = await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness', telephone: 'not-a-phone' }));
    expect(result!.phoneNumbers).toHaveLength(0);
  });

  it('returns empty array when no telephone fields are present', async () => {
    expect((await parseLocalBusinessData(htmlWith({ '@type': 'LocalBusiness' })))!.phoneNumbers).toHaveLength(0);
  });
});
