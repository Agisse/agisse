// Full practice cases for /prepare/case, with no model: five timed rounds per case (structure, exhibit, maths, brainstorm,
// recommendation), the maths checked in code, the rest self-scored against a reference answer. Every case, figure and
// reference is original. Round timings and the "3 is an average candidate" calibration follow ConsultingTrainer and the
// real-mock-interview-agent rubric (both MIT).
import { parseNumber } from './case-kit'

export const DIMENSIONS = { structure: 'Structure', insight: 'Exhibits', maths: 'Maths', creativity: 'Brainstorm', synthesis: 'Recommendation' } as const
export type Dimension = keyof typeof DIMENSIONS
export type Scores = Record<Dimension, number>

/** Seconds per round; maths runs untimed but scores speed. */
export const ROUND_SEC = { structure: 90, insight: 60, maths: 0, creativity: 90, synthesis: 60 } as const satisfies Record<Dimension, number>

/** Same shape as the tests' table (NumData), so the page can reuse its DataView. */
export type Exhibit = { kind: 'table'; caption: string; head: string[]; rows: string[][]; note?: string }

export type Case = {
  id: string
  title: string
  kind: string
  prompt: string
  /** What an interviewer answers when asked; shown after the candidate writes their own questions. */
  facts: string[]
  structure: { name: string; points: string }[]
  exhibit: Exhibit
  insight: string
  maths: { question: string; answer: number; unit: string; working: string }
  brainstorm: { question: string; ideas: string[] }
  recommendation: string
}

const table = (caption: string, head: string[], rows: string[][], note?: string): Exhibit => ({ kind: 'table', caption, head, rows, note })

export const CASES: Case[] = [
  {
    id: 'brewery',
    title: 'Brasserie Lune',
    kind: 'Profitability',
    prompt: 'Our client, Brasserie Lune, is a Belgian craft brewer. Its operating profit has fallen sharply over the last two years, even though it sells more beer than before. The founders want to know why, and what to do about it.',
    facts: ['Goal: get back to the 2023 profit level within two years.', 'Six beers, sold in Belgium and the Netherlands.', 'Three channels: supermarkets, cafés and its own taproom.', 'Supermarkets now take 60% of volume, up from 35% in 2023.'],
    structure: [
      { name: 'Revenue', points: 'Price and volume per hectolitre, split by channel and beer. Did the mix shift?' },
      { name: 'Costs', points: 'Variable cost per hectolitre (malt, glass, energy) and fixed costs. Which grew faster than revenue?' },
      { name: 'Market', points: 'Is craft beer shrinking or are competitors cutting prices? How much power do retailers have?' },
    ],
    exhibit: table('Brasserie Lune, key figures', ['', '2023', '2025'], [['Volume (thousand hl)', '40', '42'], ['Average price (€ per hl)', '250', '235'], ['Variable cost (€ per hl)', '120', '130'], ['Fixed costs (€m)', '3.0', '3.1']]),
    insight: 'Volume is up 5%, so the problem is not demand. The margin per hectolitre fell from €130 to €105, about 19%: price is down 6% and variable cost up 8%. Fixed costs barely moved. The issue is unit margin.',
    maths: { question: 'By what percentage did operating profit fall from 2023 to 2025?', answer: 40.5, unit: '%', working: '2023: 40k hl × €130 = €5.2m, minus €3.0m fixed = €2.2m. 2025: 42k hl × €105 = €4.41m, minus €3.1m = €1.31m. €0.89m ÷ €2.2m ≈ 40%.' },
    brainstorm: {
      question: 'How could Lune restore its margin per hectolitre?',
      ideas: ['Cut the deepest supermarket promotions or renegotiate terms', 'Grow higher-margin channels: cafés, taproom, online', 'Limited and premium editions at a higher price', 'Smaller formats that raise price per litre', 'Lighter or returnable glass', 'Hedge energy, recover brewing heat', 'Pool malt and hop buying with other brewers', 'Drop the lowest-margin beers'],
    },
    recommendation: 'Profit fell about 40% because each hectolitre now earns €105 instead of €130, not because Lune sells less. Two causes: the shift to supermarkets cut the average price 6%, and glass and energy raised variable cost 8%. I would cut the deepest supermarket promotions, grow café and taproom sales, and move to lighter glass. The risk is a supermarket delisting; next I would look at margin by channel and beer.',
  },
  {
    id: 'velobox',
    title: 'VeloBox in Munich',
    kind: 'Market entry',
    prompt: 'VeloBox rents e-bikes on a monthly subscription in twelve Dutch cities. It is considering Munich as its first city outside the Netherlands. Should it enter?',
    facts: ['Goal: the city must be profitable by year three.', '60,000 subscribers in the Netherlands today.', '€10m available to invest.', 'One competitor already offers bike subscriptions in Munich.'],
    structure: [
      { name: 'Market', points: 'How many likely subscribers, how fast is it growing, what do they need?' },
      { name: 'Competition', points: 'Who is there already, at what price, and how would they respond?' },
      { name: 'Economics', points: 'Fee against cost per bike, fixed city costs, breakeven and payback.' },
      { name: 'Fit and entry', points: 'Can VeloBox run a German city? Own hubs, partners, regulation.' },
    ],
    exhibit: table('Munich, year three assumptions', ['Driver', 'Value'], [['Population', '1.5m'], ['Share aged 18–39', '32%'], ['Adoption in that group', '2%'], ['Monthly fee', '€39'], ['Cost per bike per month', '€22'], ['Fixed city costs per year', '€1.5m']]),
    insight: 'Each subscriber contributes €17 a month, €204 a year. Covering €1.5m of fixed costs takes about 7,350 subscribers, which is 1.5% adoption. The plan assumes 2%, so there is little room for error.',
    maths: { question: 'What annual profit would Munich make in year three?', answer: 458_400, unit: '€', working: '1.5m × 32% × 2% = 9,600 subscribers. 9,600 × €17 × 12 = €1.96m contribution, minus €1.5m fixed ≈ €0.46m.' },
    brainstorm: {
      question: 'What could stop VeloBox winning in Munich, and how would you test it cheaply?',
      ideas: ['The incumbent cuts prices', 'Winter churn: cold months and snow', 'Germans prefer to own bikes', 'Theft and vandalism raise cost per bike', 'Permits for hubs and street parking', 'Hiring mechanics in a tight labour market', 'Test with a one-district pilot', 'Survey students and young workers', 'Mystery-shop the competitor'],
    },
    recommendation: 'Enter Munich, but start with a one-district pilot. At 2% adoption the city makes about €0.46m a year by year three, but breakeven needs 1.5%, so the margin for error is thin. The biggest risks are the incumbent and winter churn. Next step: six months with 500 bikes to measure adoption and churn before committing the full €1.5m a year.',
  },
  {
    id: 'forma',
    title: 'Forma gyms',
    kind: 'Private equity',
    prompt: 'A private equity fund is considering buying Forma, a chain of 60 budget gyms in Spain. The seller is asking €150m. Should the fund buy at that price?',
    facts: ['The fund holds for five years and targets 2.5× its money.', 'No other gyms in its portfolio.', 'Forma opened eight clubs last year.', 'Comparable gym deals went for about 9× EBITDA.'],
    structure: [
      { name: 'Market', points: 'Growth of budget fitness in Spain, membership penetration, competitors.' },
      { name: 'Target', points: 'Members per club, fees, churn, economics of a new club.' },
      { name: 'Value', points: 'EBITDA and the multiple asked against comparable deals; upside from new clubs.' },
      { name: 'Risks and exit', points: 'Leases, refurbishment capex, competition, who buys it in five years.' },
    ],
    exhibit: table('Forma today', ['Driver', 'Value'], [['Clubs', '60'], ['Members per club', '2,500'], ['Monthly fee', '€35'], ['EBITDA margin', '20%'], ['Asking price', '€150m']]),
    insight: 'Revenue is about €63m and EBITDA €12.6m. At the 9× paid in comparable deals Forma is worth about €113m, so the asking price carries roughly €37m of premium the fund would have to earn through growth.',
    maths: { question: 'What EBITDA multiple is the seller asking?', answer: 11.9, unit: '×', working: '60 × 2,500 × €35 × 12 = €63m revenue. 20% margin = €12.6m EBITDA. €150m ÷ €12.6m ≈ 11.9×.' },
    brainstorm: {
      question: 'What would you check in due diligence before paying above market?',
      ideas: ['Member churn and how long cohorts stay', 'Payback on the eight new clubs', 'Pipeline of signed sites', 'Lease length and rent reviews', 'Refurbishment capex due', 'Competitors expanding nearby', 'Room to raise fees', 'Management depth', 'January seasonality in sign-ups'],
    },
    recommendation: 'Do not pay €150m as it stands. Forma makes about €12.6m EBITDA, so the ask is roughly 12× against 9× in comparable deals, around €37m above market. It is only worth more if new clubs deliver real growth, so I would bid around €115–120m and go higher only if diligence shows low churn and a funded pipeline. Next: cohort churn data and a lease review.',
  },
  {
    id: 'dentique',
    title: 'Dentique',
    kind: 'Pricing',
    prompt: 'Dentique, a French start-up, has built software that cuts no-shows at dental practices. It is about to launch. What should it charge?',
    facts: ['Running cost about €15 per practice per month.', 'Goal: 2,000 practices within two years.', 'Sold directly to practices.', 'A competitor sells a basic reminder tool for €49 a month.'],
    structure: [
      { name: 'Customer value', points: 'How much revenue does a practice recover, and how sure is it?' },
      { name: 'Alternatives', points: 'What do competitors charge and deliver?' },
      { name: 'Cost', points: 'Cost to serve and the margin Dentique needs.' },
      { name: 'Model', points: 'Per practice or per dentist, tiers, trial, outcome-based.' },
    ],
    exhibit: table('An average practice', ['Driver', 'Value'], [['Dentists', '2'], ['Appointments per dentist per month', '320'], ['No-show rate today', '8%'], ['No-show rate with Dentique', '5%'], ['No-show rate with competitor', '7%'], ['Revenue lost per no-show', '€60']]),
    insight: 'Dentique removes three of every eight no-shows; the competitor removes one. That makes Dentique worth about three times the €49 tool, so the price can sit well above €49 and still pay for itself quickly.',
    maths: { question: 'How much revenue does Dentique save an average practice each month?', answer: 1152, unit: '€', working: '2 × 320 = 640 appointments. 8% − 5% = 3 points fewer no-shows: 640 × 3% = 19.2 × €60 ≈ €1,150.' },
    brainstorm: {
      question: 'Beyond the price level, which pricing choices would you consider?',
      ideas: ['Per practice or per dentist', 'Free trial or first month free', 'Pay per recovered appointment', 'Annual plan at a discount', 'Basic and premium tiers', 'Setup fee', 'Bundle with practice software', 'Launch discount to win switchers'],
    },
    recommendation: 'Charge about €199 per practice per month. Dentique saves an average practice about €1,150 a month, three times what the €49 competitor saves, so €199 pays back within a week and still leaves a clear premium over the competitor. The risk is dentists anchoring on €49; next I would test €149, €199 and €249 with 30 practices.',
  },
  {
    id: 'northside',
    title: 'Northside grocers',
    kind: 'Growth',
    prompt: 'Northside, an Irish grocery chain with €1.2bn in revenue, wants to add €150m in revenue within three years. Which options should it pursue?',
    facts: ['Investment budget up to €100m.', '80 stores, mostly in Dublin and Cork.', 'No online delivery today.', 'Margins are in line with competitors.'],
    structure: [
      { name: 'Existing customers', points: 'Sell more per visit: own label, range, loyalty.' },
      { name: 'New customers', points: 'New stores, new regions, online delivery.' },
      { name: 'Acquisitions', points: 'Buy a chain when building is too slow.' },
      { name: 'Choosing', points: 'Rank by revenue, investment, speed and risk.' },
    ],
    exhibit: table('Growth options by year three', ['Option', 'Extra revenue (€m)', 'Investment (€m)'], [['Online delivery', '60', '20'], ['12 new stores', '90', '70'], ['Premium own label', '30', '5'], ['Buy a regional chain', '160', '240']]),
    insight: 'Own label returns the most per euro (6×) but is small. Online plus new stores reaches €150m exactly for €90m, within budget. The acquisition hits the target alone but costs €240m, well over budget.',
    maths: { question: 'What is the lowest investment that reaches €150m of extra revenue?', answer: 90_000_000, unit: '€', working: 'Online + new stores = €60m + €90m = €150m for €20m + €70m = €90m. Every other mix either falls short (own label + stores = €120m) or costs more.' },
    brainstorm: {
      question: 'What could stop the online and new-store plan from delivering?',
      ideas: ['New stores cannibalise existing ones', 'Delivery cost per order too high', 'Planning permission and sites', 'Competitors respond on price', 'Staff shortages', 'New stores ramp up slowly', 'Weak IT and e-commerce skills'],
    },
    recommendation: 'Pursue online delivery and 12 new stores: together they add €150m for €90m, against €240m for the acquisition. Add premium own label as well: it is the best return per euro and nearly free, and it gives a buffer if new stores ramp up slowly. The main risk is cannibalisation; next I would check catchment overlap for the 12 sites.',
  },
  {
    id: 'fjord',
    title: 'Fjord Air',
    kind: 'Operations',
    prompt: 'Fjord Air, a Norwegian regional airline, wants to fly more flights with its current fleet instead of buying aircraft. How could it do that, and what is it worth?',
    facts: ['30 turboprop aircraft.', 'Flights run from 06:00 to 21:00.', 'Ground handling is outsourced at four airports.', 'Demand on the main routes exceeds seats at peak times.'],
    structure: [
      { name: 'Process', points: 'Turnaround steps and which sit on the critical path.' },
      { name: 'People and partners', points: 'Ground handlers, crew, incentives and contracts.' },
      { name: 'Assets', points: 'Gates, equipment, maintenance windows.' },
      { name: 'Demand', points: 'Are there passengers and airport slots for the extra flights?' },
    ],
    exhibit: table('Fleet and schedule', ['Driver', 'Value'], [['Aircraft', '30'], ['Operating day', '15 hours'], ['Average flight', '75 minutes'], ['Turnaround today', '45 minutes'], ['Turnaround target', '35 minutes']]),
    insight: 'A flight plus turnaround takes 120 minutes, so a 15-hour day fits 7.5 cycles and half of one is wasted. At 110 minutes eight fit: a ten-minute cut adds one flight per aircraft, about 14% more capacity.',
    maths: { question: 'How many extra flights a day could the fleet fly at 35-minute turnarounds?', answer: 30, unit: 'flights', working: '900 minutes ÷ 120 = 7.5, so 7 flights today. 900 ÷ 110 = 8.2, so 8. One more per aircraft × 30 = 30.' },
    brainstorm: {
      question: 'How could Fjord Air cut turnaround from 45 to 35 minutes?',
      ideas: ['Board through front and rear doors', 'Refuel during boarding', 'Crew tidy the cabin; deep clean overnight', 'Check large cabin bags at the gate', 'Ground crew waiting before arrival', 'Board by zone', 'Simpler catering loads', 'Track each step and the causes of delay', 'Incentives in the handling contracts'],
    },
    recommendation: 'Cutting turnaround to 35 minutes adds about 30 flights a day, one per aircraft and about 14% more capacity, without new planes. Start on the critical path: two-door boarding, refuelling during boarding and crew-led tidying. The risk is that extra flights only pay with demand and slots; next I would time 50 turnarounds and check slots on the busiest routes.',
  },
]

/** Accepts the answer within 3%; for answers in millions or more, "90" counts as 90m. Signs are ignored. */
export function checkCaseMaths(answer: number, input: string): boolean {
  const x = parseNumber(input)
  if (x === null) return false
  const ok = (v: number) => Math.abs(Math.abs(v) - answer) <= answer * 0.03
  return ok(x) || (answer >= 1e6 && ok(x * 1e6))
}

/** 5 right within 75 s, 4 right but slower, 2 wrong, 1 skipped. */
export const mathsScore = (right: boolean, sec: number, answered: boolean) => (!answered ? 1 : right ? (sec <= 75 ? 5 : 4) : 2)

export type CaseLog = { id: string; at: string; title: string; source: 'solo' | 'live'; scores: Scores; fix: string; fixed?: boolean }

export const weakest = (s: Scores) => (Object.keys(DIMENSIONS) as Dimension[]).reduce((a, b) => (s[b] < s[a] ? b : a))

export const READY_CASES = 30

/**
 * Average of the last five cases per dimension, and one honest sentence. Strong is 4 and up across them; a dimension below 3
 * is the one to work on. Readiness also needs volume: about 30 cases, the most-cited benchmark, half of them live.
 */
export function readiness(log: CaseLog[]) {
  const recent = log.slice(0, 5)
  const keys = Object.keys(DIMENSIONS) as Dimension[]
  const avg = Object.fromEntries(keys.map((k) => [k, recent.length ? recent.reduce((s, c) => s + c.scores[k], 0) / recent.length : 0])) as Scores
  const strong = keys.filter((k) => avg[k] >= 4)
  const weak = keys.filter((k) => avg[k] < 3)
  const name = (ks: Dimension[]) => ks.map((k) => DIMENSIONS[k].toLowerCase()).join(', ').replace(/, ([^,]+)$/, ' and $1')
  const be = (ks: Dimension[]) => (ks.length > 1 ? 'are' : 'is')
  const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1)
  const live = log.filter((c) => c.source === 'live').length
  let line: string
  if (log.length === 0) line = 'Run your first case to see where you stand.'
  else if (log.length < 3) line = 'A few more cases and a pattern will show.'
  else if (weak.length) line = cap([...(strong.length ? [`${name(strong)} ${be(strong)} consistent`] : []), `${name(weak)} ${be(weak)} not there yet`].join('; ')) + '.'
  else if (strong.length === keys.length && log.length >= READY_CASES && live >= READY_CASES / 2) line = 'Consistent across the board. Book a mock with a practising consultant to confirm.'
  else if (strong.length === keys.length) line = `Strong recent scores. Keep going to ${READY_CASES} cases, at least half with a partner.`
  else line = `No weak spot. Push ${name(keys.filter((k) => avg[k] < 4))} to 4 and up.`
  return { avg, line, count: log.length, live }
}

/** Days in the current Monday-start week that have at least one timestamp. */
export function daysThisWeek(stamps: string[], now = new Date()) {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return new Set(stamps.map((s) => new Date(s)).filter((d) => d >= monday).map((d) => d.toDateString())).size
}

export const inThisWeek = (at: string, now = new Date()) => daysThisWeek([at], now) === 1
