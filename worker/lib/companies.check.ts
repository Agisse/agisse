// Run: npx tsx worker/lib/companies.check.ts
import { MAX_KNOWLEDGE, finalizeScout, siteVariants, toCandidates, toSimilar, finalizeSimilar, firstSentence, MAX_SIMILAR_KNOWLEDGE } from './companies.ts'
import type { ScoutInput } from '../../shared/types.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(siteVariants('a.com'), ['https://a.com/', 'https://a.com', 'https://www.a.com/', 'https://www.a.com', 'http://a.com/', 'http://a.com', 'http://www.a.com/', 'http://www.a.com'], 'siteVariants')

const candidates = toCandidates([
  { url: 'https://www.mollie.com/en', title: 'Mollie | Payments for Europe', text: '' },
  { url: 'https://mollie.com/', title: 'Mollie again', text: '' },
  { url: 'https://www.linkedin.com/company/x', title: 'X on LinkedIn', text: '' },
  { url: 'https://gocardless.com', title: 'GoCardless', text: '' },
  { url: 'https://oldpay.io', title: 'OldPay', text: '' },
  { url: 'https://bigbank.com', title: 'BigBank', text: '' },
])
eq(candidates.map((c) => [c.domain, c.name]), [['mollie.com', 'Mollie'], ['gocardless.com', 'GoCardless'], ['oldpay.io', 'OldPay'], ['bigbank.com', 'BigBank']], 'toCandidates dedupes, cleans names, drops directories')

const facts = new Map([
  ['oldpay.io', { qid: 'Q1', industry: null, country: null, employees: null, founded: null, dissolved: true }],
  ['bigbank.com', { qid: 'Q2', industry: 'banking', country: 'NL', employees: 40_000, founded: '1900', dissolved: false }],
  ['klarna.com', { qid: 'Q3', industry: 'fintech', country: 'SE', employees: 3000, founded: '2005', dissolved: false }],
])
const input: ScoutInput = { dream: ['Adyen'], description: '', location: '', sizes: ['scale-up', 'mid'], useProfile: false, exclude: ['gocardless.com'] }
const pick = (domain: string, source: 'search' | 'knowledge', name = domain) => ({ domain, name, cluster: 'Payments', what: 'x', why: 'y', profileFit: 'same school', source })
const picks = finalizeScout(
  {
    picks: [
      pick('mollie.com', 'knowledge', 'Mollie'), // found anyway → search
      pick('mollie.com', 'search'), // duplicate
      pick('adyen.com', 'knowledge', 'Adyen'), // dream company
      pick('gocardless.com', 'search'), // excluded
      pick('invented.com', 'search'), // never found
      pick('oldpay.io', 'search'), // dissolved
      pick('bigbank.com', 'search'), // wrong size
      pick('klarna.com', 'knowledge'), // verified by Wikidata
      ...Array.from({ length: MAX_KNOWLEDGE + 2 }, (_, i) => pick(`k${i}.com`, 'knowledge')),
    ],
  },
  candidates,
  facts,
  input,
)
eq(picks.map((p) => [p.domain, p.source, p.unverified]), [['mollie.com', 'search', false], ['klarna.com', 'knowledge', false], ...Array.from({ length: MAX_KNOWLEDGE - 1 }, (_, i) => [`k${i}.com`, 'knowledge', true])], 'finalizeScout filters and caps')
eq(picks[0]!.sourceUrl, 'https://www.mollie.com/en', 'search pick links to its page')
eq(picks[1]!.sourceUrl, 'https://www.wikidata.org/wiki/Q3', 'knowledge pick links to Wikidata')
eq(picks[0]!.profileFit, null, 'profileFit dropped when the badge is not used')

const similar = toSimilar(
  [
    { domain: 'adyen.com', name: 'Adyen', url: 'https://adyen.com', text: 'Seed.' },
    { domain: 'oldpay.io', name: 'OldPay', url: 'https://oldpay.io', text: 'Gone.' },
    { domain: 'bigbank.com', name: 'BigBank', url: 'https://bigbank.com', text: 'BigBank  is a bank.\nIt lends. More text' },
    { domain: 'nodot.com', name: 'NoDot', url: 'https://nodot.com', text: 'no sentence end' },
  ],
  facts,
  'adyen.com',
)
eq(similar.map((c) => c.domain), ['bigbank.com', 'nodot.com'], 'toSimilar drops the seed and dissolved companies')
eq(similar[0]!.what, 'BigBank is a bank.', 'toSimilar keeps the first sentence')
eq(similar[0]!.facts?.employees, 40_000, 'toSimilar carries facts')
eq(similar[1]!.what, 'no sentence end', 'toSimilar keeps text without a full stop')

const cands = toCandidates([
  { url: 'https://mollie.com', title: 'Mollie', text: 'Payments.' },
  { url: 'https://oldpay.io', title: 'OldPay', text: 'Gone.' },
])
const sp = (domain: string, source: 'search' | 'knowledge', name = domain) => ({ domain, name, what: 'w', why: 'y', source })
const sim = finalizeSimilar(
  {
    picks: [
      sp('mollie.com', 'search', 'Mollie'),
      sp('mollie.com', 'search', 'Mollie dup'),
      sp('adyen.com', 'knowledge', 'Adyen'),
      sp('made-up.com', 'search'),
      sp('oldpay.io', 'search'),
      sp('klarna.com', 'knowledge', 'Klarna'),
      ...Array.from({ length: MAX_SIMILAR_KNOWLEDGE + 2 }, (_, i) => sp(`k${i}.com`, 'knowledge')),
    ],
  },
  cands,
  facts,
  { name: 'Adyen', domain: 'adyen.com' },
)
eq(sim.map((c) => c.domain), ['mollie.com', 'klarna.com', ...Array.from({ length: MAX_SIMILAR_KNOWLEDGE - 1 }, (_, i) => `k${i}.com`)], 'finalizeSimilar drops seed, dupes, invented search picks, dissolved, and caps knowledge')
eq([sim[0]!.unverified, sim[1]!.unverified, sim[2]!.unverified], [false, false, true], 'finalizeSimilar flags knowledge picks without open data')
eq(sim[0]!.url, 'https://mollie.com', 'search picks keep their page')

eq(firstSentence('# Frame (Frame Payments, Inc.)\nFrame is a Financial Services company. FrameOS is a payments platform. More.'), 'FrameOS is a payments platform.', 'firstSentence skips the heading and stock line')

console.log('companies.check ok')
