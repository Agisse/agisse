// Run: npx tsx worker/lib/interview.check.ts
import { finalizeOfferBrief, finalizePayCheck } from './interview.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const real = 'https://www.levels.fyi/companies/acme/salaries'
const other = 'https://www.glassdoor.com/Salary/acme'
const fake = 'https://made-up.example/acme-pay'
const range = { low: 50000, high: 60000, currency: ' EUR ', basis: 'base salary per year', sourceUrl: real }
const raw = {
  range,
  levers: [
    { lever: 'Start date', why: 'The posting is flexible' },
    { lever: '  ', why: 'empty' },
  ],
  script: '  Thank you for the offer.  ',
  sources: [real, fake, real, other],
}

const out = finalizeOfferBrief(raw, [real, other])
eq(out.range, { ...range, currency: 'EUR' }, 'range from a search result kept')
eq(out.sources, [real, other], 'sources deduped, fake dropped')
eq(out.levers.map((l) => l.lever), ['Start date'], 'empty lever dropped')
eq(out.script, 'Thank you for the offer.', 'script trimmed')
eq(finalizeOfferBrief({ ...raw, range: { ...range, sourceUrl: fake } }, [real, other]).range, null, 'range citing a non-result URL nulled')
eq(finalizeOfferBrief({ ...raw, range: { ...range, low: 70000 } }, [real]).range, null, 'inverted range nulled')
eq(finalizeOfferBrief({ ...raw, range: { ...range, low: 60000 } }, [real]).range, null, 'single figure (low == high) is not a range')
eq(finalizeOfferBrief({ ...raw, range: null }, []).sources, [], 'no results: no sources')

const news = 'https://news.example/acme-series-b'
const signal = { kind: 'funding' as const, text: ' Raised €40M Series B ', date: '2026-03-01', sourceUrl: news }
const pay = { range, ask: 'I am targeting 50,000–60,000 EUR.', health: { verdict: 'healthy' as const, signals: [signal, { ...signal, sourceUrl: fake }] }, sources: [real, news, fake] }
const pc = finalizePayCheck(pay, [real, news], 'T')
eq(pc.health.signals, [{ ...signal, text: 'Raised €40M Series B' }], 'signal citing a non-result URL dropped')
eq(pc.health.verdict, 'healthy', 'verdict kept with signals')
eq(pc.sources, [real, news], 'pay sources filtered')
eq(finalizePayCheck(pay, [real], 'T').health.verdict, 'unknown', 'no surviving signals: unknown')
const noRange = finalizePayCheck({ ...pay, range: { ...range, sourceUrl: fake } }, [real, news], 'T')
eq([noRange.range, noRange.ask], [null, ''], 'no range: figures in the ask dropped')
eq(finalizePayCheck({ ...pay, range: null, ask: ' What band do you have in mind? ' }, [], 'T').ask, 'What band do you have in mind?', 'figure-free ask kept')
for (const junk of ['range is null', 'salary range', 'My expectation is undefined for this role.']) eq(finalizePayCheck({ ...pay, ask: junk }, [real, news], 'T').ask, '', `placeholder ask dropped: ${junk}`)
console.log('interview ok')
