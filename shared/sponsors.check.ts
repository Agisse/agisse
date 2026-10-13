// Run: npx tsx shared/sponsors.check.ts
import { sponsorKey } from './sponsors.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(sponsorKey('Booking.com B.V.'), 'bookingcom', 'dots and B.V.')
eq(sponsorKey('Booking.com'), 'bookingcom', 'same key without the legal form')
eq(sponsorKey('ASML Netherlands B.V.'), 'asml', 'country word dropped')
eq(sponsorKey('Deloitte LLP'), 'deloitte', 'LLP')
eq(sponsorKey('The Boston Consulting Group UK LLP'), 'bostonconsulting', 'filler words')
eq(sponsorKey('Holding B.V.'), '', 'nothing left')
eq(sponsorKey(' AaruvikA Limited'), 'aaruvika', 'leading space')
console.log('sponsors ok')
