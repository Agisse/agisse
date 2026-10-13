// Recognised visa sponsors: the Dutch IND register (highly skilled migrants) and the UK register of licensed sponsors
// (Skilled Worker). Europe's answer to Jobright's H1B filter: a public fact, matched on the employer's name.
// The same normalisation runs in JS (the importer) and in SQL (the feed), so both sides build the same key.

export const SPONSOR_COUNTRIES = { NL: 'Netherlands', GB: 'UK' } as const
export type SponsorCountry = keyof typeof SPONSOR_COUNTRIES

// Legal forms and filler words dropped from a name before matching. Dots are removed first, so "B.V." is "bv".
export const SPONSOR_DROP = ['bv', 'nv', 'vof', 'ltd', 'limited', 'plc', 'llp', 'llc', 'lp', 'inc', 'gmbh', 'ag', 'se', 'sa', 'sas', 'sarl', 'srl', 'spa', 'co', 'company', 'holding', 'holdings', 'group', 'the', 'uk', 'nederland', 'netherlands', 'europe', 'emea', 'international']
const DROP = new Set(SPONSOR_DROP)

/** "Booking.com B.V." → "bookingcom". Empty when nothing but legal forms is left (never matched). */
export function sponsorKey(name: string) {
  return name
    .toLowerCase()
    .replaceAll('.', '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !DROP.has(t))
    .join('')
}
