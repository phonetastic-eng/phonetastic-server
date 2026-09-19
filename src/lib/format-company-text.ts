const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface OperationHourRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

interface OfferingRow {
  name: string;
  priceAmount?: string | null;
  priceCurrency?: string | null;
}

/**
 * Formats structured operation hours into human-readable text.
 * Groups consecutive days with identical times into ranges.
 *
 * @param hours - Array of operation hour rows sorted by dayOfWeek.
 * @returns Multi-line string, e.g. "Mon-Fri: 9:00 AM - 5:00 PM\nSat: 10:00 AM - 2:00 PM".
 */
export function formatOperationHoursText(hours: OperationHourRow[]): string {
  if (hours.length === 0) return '';

  const groups = groupConsecutiveDays(hours);

  return groups.map((g) => {
    const dayLabel = g.days.length === 1
      ? DAY_NAMES[g.days[0]]
      : `${DAY_NAMES[g.days[0]]}-${DAY_NAMES[g.days[g.days.length - 1]]}`;
    return `${dayLabel}: ${to12Hour(g.open)} - ${to12Hour(g.close)}`;
  }).join('\n');
}

/**
 * Groups operation hours into runs of consecutive days sharing the same times.
 *
 * @param hours - Array of operation hour rows in any order.
 * @returns One group per run of consecutive days, ordered by day of week.
 */
function groupConsecutiveDays(hours: OperationHourRow[]): Array<{ days: number[]; open: string; close: string }> {
  const sorted = [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const groups: Array<{ days: number[]; open: string; close: string }> = [];

  for (const hour of sorted) {
    const last = groups[groups.length - 1];
    const isConsecutive = last
      && last.open === hour.openTime
      && last.close === hour.closeTime
      && last.days[last.days.length - 1] === hour.dayOfWeek - 1;

    if (isConsecutive) last.days.push(hour.dayOfWeek);
    else groups.push({ days: [hour.dayOfWeek], open: hour.openTime, close: hour.closeTime });
  }

  return groups;
}

/**
 * Formats structured offerings into human-readable text.
 * One offering per line with optional price.
 *
 * @param offerings - Array of offering rows.
 * @returns Multi-line string, e.g. "Haircut - $30.00\nColor - $80.00".
 */
export function formatOfferingsText(offerings: OfferingRow[]): string {
  if (offerings.length === 0) return '';

  return offerings.map((o) => {
    if (o.priceAmount != null && o.priceAmount !== '') {
      const symbol = currencySymbol(o.priceCurrency ?? 'USD');
      return `${o.name} - ${symbol}${o.priceAmount}`;
    }
    return o.name;
  }).join('\n');
}

/**
 * Converts 24-hour "HH:MM" to 12-hour "H:MM AM/PM".
 */
function to12Hour(time: string): string {
  const [hStr, min] = time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min} ${ampm}`;
}

function currencySymbol(code: string): string {
  switch (code.toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '\u20AC';
    case 'GBP': return '\u00A3';
    default: return `${code} `;
  }
}
