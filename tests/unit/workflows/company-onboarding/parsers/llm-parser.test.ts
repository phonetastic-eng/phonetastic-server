import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseLlmData } from '../../../../../src/workflows/company-onboarding/parsers/llm-parser.js';

const mockB = vi.hoisted(() => ({
  ParseCompanyInfo: vi.fn(),
}));

vi.mock('../../../../../src/baml_client/index.js', () => ({ b: mockB }));

const emptyInfo = { name: null, email: null, address: null, phone: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseLlmData', () => {
  it('returns null when LLM finds nothing', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue(emptyInfo);
    expect(await parseLlmData('<html><body>no info</body></html>')).toBeNull();
  });

  it('strips HTML tags before calling LLM', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue(emptyInfo);
    await parseLlmData('<html><body><h1>Acme</h1><p>Contact us</p></body></html>');
    const calledWith: string = mockB.ParseCompanyInfo.mock.calls[0][0];
    expect(calledWith).not.toMatch(/<[^>]+>/);
    expect(calledWith).toContain('Acme');
  });

  it('maps name and email', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue({ ...emptyInfo, name: 'Acme Corp', email: 'hi@acme.com' });
    const result = await parseLlmData('<html></html>');
    expect(result?.name).toBe('Acme Corp');
    expect(result?.email).toBe('hi@acme.com');
  });

  it('maps a structured address', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue({
      ...emptyInfo,
      name: 'Acme',
      address: { streetAddress: '123 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    });
    const result = await parseLlmData('<html></html>');
    expect(result?.address).toEqual({
      streetAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      label: 'main',
    });
  });

  it('normalizes a valid phone number to E.164', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue({ ...emptyInfo, name: 'Acme', phone: '+15125550100' });
    const result = await parseLlmData('<html></html>');
    expect(result?.phoneNumbers).toEqual([{ phoneNumberE164: '+15125550100', label: 'main' }]);
  });

  it('skips an unparseable phone number', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue({ ...emptyInfo, name: 'Acme', phone: 'not-a-phone' });
    const result = await parseLlmData('<html></html>');
    expect(result?.phoneNumbers).toEqual([]);
  });

  it('always returns empty operationHours', async () => {
    mockB.ParseCompanyInfo.mockResolvedValue({ ...emptyInfo, name: 'Acme' });
    const result = await parseLlmData('<html></html>');
    expect(result?.operationHours).toEqual([]);
  });
});
