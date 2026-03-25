import { describe, it, expect } from 'vitest';
import { buildPromptData } from '../../../src/agent/prompt.js';

describe('buildPromptData', () => {
  describe('with no data', () => {
    it('uses unknown defaults for all entity fields', () => {
      const data = buildPromptData();
      expect(data.company).toEqual({ id: 'unknown', name: 'unknown', businessType: 'unknown', emails: [], website: 'unknown' });
      expect(data.caller).toEqual({ id: 'unknown', firstName: 'unknown', lastName: 'unknown' });
      expect(data.assistant).toEqual({ id: 'unknown', name: 'unknown' });
    });

    it('includes a lowercase day-of-week string', () => {
      const data = buildPromptData();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      expect(days).toContain(data.dow);
    });

    it('includes an ISO 8601 timestamp', () => {
      const data = buildPromptData();
      expect(() => new Date(data.time)).not.toThrow();
      expect(new Date(data.time).toISOString()).toBe(data.time);
    });
  });

  describe('with full entity data', () => {
    const company = { id: 1, name: 'Acme', businessType: 'retail', emails: ['a@acme.com'], website: 'acme.com' };
    const bot = { id: 2, name: 'Aria' };
    const endUser = { id: 3, firstName: 'Jane', lastName: 'Doe' };

    it('maps company to the company field', () => {
      expect(buildPromptData({ company }).company).toEqual(company);
    });

    it('maps endUser to the caller field', () => {
      expect(buildPromptData({ endUser }).caller).toEqual(endUser);
    });

    it('maps bot to the assistant field', () => {
      expect(buildPromptData({ bot }).assistant).toEqual(bot);
    });

    it('passes null DB fields through for the template to handle', () => {
      const nullCompany = { id: 1, name: 'Acme', businessType: null, emails: null, website: null };
      expect(buildPromptData({ company: nullCompany }).company).toEqual(nullCompany);
    });
  });

  describe('with partial data', () => {
    it('defaults caller and assistant when only company is supplied', () => {
      const company = { id: 1, name: 'Acme', businessType: null, emails: null, website: null };
      const data = buildPromptData({ company });
      expect(data.caller).toEqual({ id: 'unknown', firstName: 'unknown', lastName: 'unknown' });
      expect(data.assistant).toEqual({ id: 'unknown', name: 'unknown' });
    });
  });
});
