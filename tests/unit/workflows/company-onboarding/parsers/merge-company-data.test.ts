import { describe, it, expect } from 'vitest';
import {
  mergeCompanyData,
  type CompanyData,
} from '../../../../../src/workflows/company-onboarding/parsers/parser-utils.js';

function makeCompanyData(overrides: Partial<CompanyData> = {}): CompanyData {
  return {
    name: null,
    email: null,
    address: null,
    operationHours: [],
    phoneNumbers: [],
    ...overrides,
  };
}

describe('mergeCompanyData', () => {
  it('returns primary when both sources are complete', () => {
    const primary = makeCompanyData({ name: 'Primary', email: 'a@p.com' });
    const fallback = makeCompanyData({ name: 'Fallback', email: 'b@f.com' });

    const result = mergeCompanyData(primary, fallback);

    expect(result.name).toBe('Primary');
    expect(result.email).toBe('a@p.com');
  });

  it('fills null scalar fields from fallback', () => {
    const primary = makeCompanyData({ name: 'Acme' });
    const fallback = makeCompanyData({ email: 'hi@acme.com', address: { streetAddress: '1 Main', city: null, state: null, postalCode: null, country: null, label: 'main' } });

    const result = mergeCompanyData(primary, fallback);

    expect(result.name).toBe('Acme');
    expect(result.email).toBe('hi@acme.com');
    expect(result.address?.streetAddress).toBe('1 Main');
  });

  it('fills empty operationHours from fallback', () => {
    const hours = [{ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' }];
    const primary = makeCompanyData({ name: 'Acme' });
    const fallback = makeCompanyData({ operationHours: hours });

    const result = mergeCompanyData(primary, fallback);

    expect(result.operationHours).toEqual(hours);
  });

  it('keeps primary operationHours when non-empty', () => {
    const primaryHours = [{ dayOfWeek: 1, openTime: '08:00', closeTime: '16:00' }];
    const fallbackHours = [{ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' }];
    const primary = makeCompanyData({ operationHours: primaryHours });
    const fallback = makeCompanyData({ operationHours: fallbackHours });

    const result = mergeCompanyData(primary, fallback);

    expect(result.operationHours).toEqual(primaryHours);
  });

  it('fills empty phoneNumbers from fallback', () => {
    const phones = [{ phoneNumberE164: '+15125550100', label: 'main' }];
    const primary = makeCompanyData();
    const fallback = makeCompanyData({ phoneNumbers: phones });

    const result = mergeCompanyData(primary, fallback);

    expect(result.phoneNumbers).toEqual(phones);
  });

  it('keeps primary phoneNumbers when non-empty', () => {
    const primaryPhones = [{ phoneNumberE164: '+15125550100', label: 'main' }];
    const fallbackPhones = [{ phoneNumberE164: '+15125550200', label: 'sales' }];
    const primary = makeCompanyData({ phoneNumbers: primaryPhones });
    const fallback = makeCompanyData({ phoneNumbers: fallbackPhones });

    const result = mergeCompanyData(primary, fallback);

    expect(result.phoneNumbers).toEqual(primaryPhones);
  });

  it('fills empty-string name from fallback', () => {
    const primary = makeCompanyData({ name: '', email: 'a@p.com' });
    const fallback = makeCompanyData({ name: 'Fallback' });

    const result = mergeCompanyData(primary, fallback);

    expect(result.name).toBe('Fallback');
  });

  it('fills empty-string email from fallback', () => {
    const primary = makeCompanyData({ email: '' });
    const fallback = makeCompanyData({ email: 'real@example.com' });

    const result = mergeCompanyData(primary, fallback);

    expect(result.email).toBe('real@example.com');
  });

  it('returns all-fallback values when primary is entirely empty', () => {
    const fallback = makeCompanyData({
      name: 'Fallback Co',
      email: 'info@fallback.com',
      operationHours: [{ dayOfWeek: 0, openTime: '10:00', closeTime: '14:00' }],
      phoneNumbers: [{ phoneNumberE164: '+15125550300', label: 'main' }],
    });

    const result = mergeCompanyData(makeCompanyData(), fallback);

    expect(result).toEqual(fallback);
  });
});
