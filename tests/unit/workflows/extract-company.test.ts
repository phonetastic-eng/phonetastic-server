import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompanyData } from '../../../src/workflows/company-onboarding/parsers/parser-utils.js';

/* ------------------------------------------------------------------ */
/*  Stub DBOS decorators so the class loads without a runtime.        */
/* ------------------------------------------------------------------ */
vi.mock('@dbos-inc/dbos-sdk', () => ({
  DBOS: {
    workflow: () => (_t: unknown, _k: string, desc: PropertyDescriptor) => desc,
    step: () => (_t: unknown, _k: string, desc: PropertyDescriptor) => desc,
  },
}));

/* ------------------------------------------------------------------ */
/*  Hoisted mocks for ExtractCompany static step methods.             */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  scrapeHomePage: vi.fn(),
  parseStructuredData: vi.fn(),
  scrapePage: vi.fn(),
  parseLlmData: vi.fn(),
}));

vi.mock('../../../src/workflows/extract-company.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/workflows/extract-company.js')>();
  original.ExtractCompany.scrapeHomePage = mocks.scrapeHomePage;
  original.ExtractCompany.parseStructuredData = mocks.parseStructuredData;
  original.ExtractCompany.scrapePage = mocks.scrapePage;
  original.ExtractCompany.parseLlmData = mocks.parseLlmData;
  return original;
});

import { ExtractCompany } from '../../../src/workflows/extract-company.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Fixtures based on real Sibby's Cupcakery crawl (2026-03-24)       */
/* ------------------------------------------------------------------ */
const SIBBYS_URL = 'https://sibbyscupcakery.com';
const SIBBYS_HOME_HTML = '<html>Sibby\'s Cupcakery home</html>';
const SIBBYS_CONTACT_HTML = '<html>Sibby\'s Cupcakery contact</html>';
const SIBBYS_SITE_MAP = [
  'https://sibbyscupcakery.com',
  'https://sibbyscupcakery.com/index.php',
  'https://sibbyscupcakery.com/contact.php',
  'https://sibbyscupcakery.com/about.php',
  'https://sibbyscupcakery.com/order.php',
  'https://sibbyscupcakery.com/classic-themes.php',
  'https://sibbyscupcakery.com/custom-themes.php',
  'https://sibbyscupcakery.com/signature-designs.php',
  'https://sibbyscupcakery.com/questions.php',
  'https://sibbyscupcakery.com/philanthropy-donations.php',
];

/** What the LLM returned for sibbyscupcakery.com (from server logs). */
const SIBBYS_LLM_DATA: CompanyData = {
  name: "Sibby's Cupcakery",
  email: 'cupcakes@sibbyscupcakery.com',
  address: {
    streetAddress: '716 South Railroad Ave.',
    city: 'San Mateo',
    state: 'CA',
    postalCode: '94401',
    country: 'United States',
    label: 'main',
  },
  operationHours: [],
  phoneNumbers: [{ phoneNumberE164: '+14156134373', label: 'main' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scrapeHomePage.mockResolvedValue(SIBBYS_HOME_HTML);
  mocks.scrapePage.mockResolvedValue(SIBBYS_CONTACT_HTML);
});

describe('ExtractCompany.run', () => {
  describe('no structured data (Sibby\'s Cupcakery scenario)', () => {
    it('extracts company data via LLM using the contact page', async () => {
      mocks.parseStructuredData.mockResolvedValue(null);
      mocks.parseLlmData.mockResolvedValue(SIBBYS_LLM_DATA);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result).toEqual(SIBBYS_LLM_DATA);
      expect(result?.name).toBe("Sibby's Cupcakery");
      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
      expect(result?.address?.city).toBe('San Mateo');
      expect(result?.phoneNumbers[0]?.phoneNumberE164).toBe('+14156134373');
    });

    it('uses home HTML because /contact.php does not match findContactUrl', async () => {
      // Note: findContactUrl (site-map.ts) only matches exact /contact-us and
      // /contact paths. If that contract changes, these assertions will need updating.
      mocks.parseStructuredData.mockResolvedValue(null);
      mocks.parseLlmData.mockResolvedValue(SIBBYS_LLM_DATA);

      await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(mocks.scrapePage).not.toHaveBeenCalled();
      expect(mocks.parseLlmData).toHaveBeenCalledWith(SIBBYS_HOME_HTML);
    });
  });

  describe('incomplete structured data (gap-fill merge)', () => {
    it('fills missing email from LLM when JSON-LD has name but no email', async () => {
      const structured = makeCompanyData({
        name: "Sibby's Cupcakery",
        address: SIBBYS_LLM_DATA.address,
        phoneNumbers: [{ phoneNumberE164: '+14156134373', label: 'main' }],
        operationHours: [{ dayOfWeek: 3, openTime: '10:00', closeTime: '17:00' }],
      });
      const llmData = makeCompanyData({ email: 'cupcakes@sibbyscupcakery.com' });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(llmData);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result?.name).toBe("Sibby's Cupcakery");
      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
      expect(result?.operationHours).toEqual(structured.operationHours);
    });

    it('fills missing hours from LLM when JSON-LD has email but no hours', async () => {
      const structured = makeCompanyData({
        name: "Sibby's Cupcakery",
        email: 'cupcakes@sibbyscupcakery.com',
      });
      const hours = [
        { dayOfWeek: 3, openTime: '10:00', closeTime: '17:00' },
        { dayOfWeek: 4, openTime: '10:00', closeTime: '17:00' },
        { dayOfWeek: 5, openTime: '10:00', closeTime: '17:00' },
        { dayOfWeek: 6, openTime: '10:00', closeTime: '17:00' },
        { dayOfWeek: 0, openTime: '10:00', closeTime: '17:00' },
      ];
      const llmData = makeCompanyData({ operationHours: hours });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(llmData);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
      expect(result?.operationHours).toEqual(hours);
    });

    it('fills both email and hours when JSON-LD has only name and address', async () => {
      const structured = makeCompanyData({
        name: "Sibby's Cupcakery",
        address: SIBBYS_LLM_DATA.address,
      });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(SIBBYS_LLM_DATA);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result?.name).toBe("Sibby's Cupcakery");
      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
      expect(result?.address?.city).toBe('San Mateo');
      expect(result?.phoneNumbers[0]?.phoneNumberE164).toBe('+14156134373');
    });

    it('fills missing address from LLM when JSON-LD has no address', async () => {
      const structured = makeCompanyData({
        name: "Sibby's Cupcakery",
        email: 'cupcakes@sibbyscupcakery.com',
        operationHours: [{ dayOfWeek: 3, openTime: '10:00', closeTime: '17:00' }],
        phoneNumbers: [{ phoneNumberE164: '+14156134373', label: 'main' }],
      });
      const llmData = makeCompanyData({ address: SIBBYS_LLM_DATA.address });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(llmData);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result?.address?.city).toBe('San Mateo');
      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
    });

    it('fills missing phoneNumbers from LLM when JSON-LD has no phones', async () => {
      const structured = makeCompanyData({
        name: "Sibby's Cupcakery",
        email: 'cupcakes@sibbyscupcakery.com',
        address: SIBBYS_LLM_DATA.address,
        operationHours: [{ dayOfWeek: 3, openTime: '10:00', closeTime: '17:00' }],
      });
      const llmData = makeCompanyData({ phoneNumbers: [{ phoneNumberE164: '+14156134373', label: 'main' }] });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(llmData);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result?.phoneNumbers[0]?.phoneNumberE164).toBe('+14156134373');
      expect(result?.email).toBe('cupcakes@sibbyscupcakery.com');
    });

    it('returns structured as-is when LLM fails to fill gaps', async () => {
      const structured = makeCompanyData({ name: "Sibby's Cupcakery" });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(null);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result).toEqual(structured);
    });

    it('uses home HTML for gap-fill when site map has no /contact path', async () => {
      const structured = makeCompanyData({ name: "Sibby's Cupcakery" });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(SIBBYS_LLM_DATA);

      await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      // /contact.php doesn't match findContactUrl, so falls back to home HTML
      expect(mocks.scrapePage).not.toHaveBeenCalled();
      expect(mocks.parseLlmData).toHaveBeenCalledWith(SIBBYS_HOME_HTML);
    });

    it('scrapes contact page for gap-fill when /contact-us exists', async () => {
      const structured = makeCompanyData({ name: "Sibby's Cupcakery" });
      mocks.parseStructuredData.mockResolvedValue(structured);
      mocks.parseLlmData.mockResolvedValue(SIBBYS_LLM_DATA);
      const mapWithContact = [...SIBBYS_SITE_MAP, 'https://sibbyscupcakery.com/contact-us'];

      await ExtractCompany.run(SIBBYS_URL, mapWithContact);

      expect(mocks.scrapePage).toHaveBeenCalledWith('https://sibbyscupcakery.com/contact-us');
      expect(mocks.parseLlmData).toHaveBeenCalledWith(SIBBYS_CONTACT_HTML);
    });
  });

  describe('complete structured data', () => {
    it('skips LLM when JSON-LD has all fields', async () => {
      const complete = makeCompanyData({
        name: "Sibby's Cupcakery",
        email: 'cupcakes@sibbyscupcakery.com',
        address: SIBBYS_LLM_DATA.address,
        operationHours: [{ dayOfWeek: 3, openTime: '10:00', closeTime: '17:00' }],
        phoneNumbers: [{ phoneNumberE164: '+14156134373', label: 'main' }],
      });
      mocks.parseStructuredData.mockResolvedValue(complete);

      const result = await ExtractCompany.run(SIBBYS_URL, SIBBYS_SITE_MAP);

      expect(result).toEqual(complete);
      expect(mocks.parseLlmData).not.toHaveBeenCalled();
      expect(mocks.scrapePage).not.toHaveBeenCalled();
    });
  });
});
