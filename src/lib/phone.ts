import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Parses a phone number string and formats it as E.164.
 *
 * @param value - The raw phone number string (any common format).
 * @param defaultRegion - ISO 3166-1 alpha-2 region code, defaults to 'US'.
 * @returns The E.164-formatted phone number (e.g. "+14155552671").
 * @throws {Error} If the value cannot be parsed as a valid phone number.
 */
export function toE164(value: string, defaultRegion = 'US'): string {
  const parsed = phoneUtil.parse(value, defaultRegion);
  if (!phoneUtil.isValidNumber(parsed)) {
    throw new Error(`Invalid phone number: ${value}`);
  }
  return phoneUtil.format(parsed, PhoneNumberFormat.E164);
}
