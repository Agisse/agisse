// Case interview practice with no model: generated mental maths, hand-written market sizing with reference trees,
// and a short framework primer. Scoring is pure so it can be checked.

// ---- Mental maths ----

export const MATH_KINDS = { percent: 'Percentages', growth: 'Growth', breakeven: 'Breakeven', division: 'Big-number division' } as const
export type MathKind = keyof typeof MATH_KINDS
export type MathQuestion = { kind: MathKind; prompt: string; answer: number; /** Absolute tolerance on the answer. */ tolerance: number; unit: string }

/** Seeded generator, so a check can replay a sequence. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!

/** 1200 → "1.2k", 4_800_000_000 → "4.8bn". */
export function fmt(n: number): string {
  const a = Math.abs(n)
  const [d, s] = a >= 1e9 ? [1e9, 'bn'] : a >= 1e6 ? [1e6, 'm'] : a >= 1e4 ? [1e3, 'k'] : [1, '']
  return `${+(n / d).toFixed(2)}${s}`
}

export function mathQuestion(kind: MathKind, r: () => number): MathQuestion {
  if (kind === 'percent') {
    const p = pick(r, [5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 60, 75])
    const y = pick(r, [24, 36, 48, 64, 120, 180, 240, 360, 480, 720]) * pick(r, [1, 1e3, 1e6])
    const answer = (p * y) / 100
    return { kind, prompt: `What is ${p}% of ${fmt(y)}?`, answer, tolerance: Math.abs(answer) * 0.01, unit: '' }
  }
  if (kind === 'growth') {
    const a = pick(r, [40, 80, 120, 160, 200, 250, 320, 400, 500, 800])
    const g = pick(r, [-20, -10, -5, 5, 10, 15, 20, 25, 40, 50])
    const b = (a * (100 + g)) / 100
    return { kind, prompt: `Revenue went from €${fmt(a * 1e6)} to €${fmt(b * 1e6)}. Growth in %?`, answer: g, tolerance: 0.5, unit: '%' }
  }
  if (kind === 'breakeven') {
    const margin = pick(r, [2, 4, 5, 8, 10, 20, 25])
    const price = margin + pick(r, [3, 5, 6, 10, 15, 20])
    const units = pick(r, [5, 8, 12, 15, 20, 40, 60]) * 1000
    const fixed = margin * units
    return { kind, prompt: `Fixed costs €${fmt(fixed)}, price €${price}, variable cost €${price - margin} per unit. Breakeven units?`, answer: units, tolerance: units * 0.01, unit: 'units' }
  }
  const a = pick(r, [12, 18, 24, 36, 42, 48, 60, 72, 96]) * pick(r, [1e6, 1e8, 1e9])
  const b = pick(r, [3, 4, 6, 8, 12, 15, 30, 40, 60]) * pick(r, [1e2, 1e3, 1e4])
  const answer = a / b
  return { kind, prompt: `${fmt(a)} ÷ ${fmt(b)}?`, answer, tolerance: answer * 0.05, unit: '' }
}

/** A drill of n questions cycling through the chosen kinds. */
export const mathDrill = (kinds: MathKind[], n: number, r: () => number) => Array.from({ length: n }, (_, i) => mathQuestion(kinds[i % kinds.length]!, r))

/** "1,2k", "1.2 million", "4.8bn", "15%", "€3 200" → number; null when unreadable. */
export function parseNumber(input: string): number | null {
  const s = input.toLowerCase().replace(/[€$£%\s]/g, '').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(',', '.')
  const m = s.match(/^(-?\d*\.?\d+)(k|thousand|m|mn|million|b|bn|billion)?$/)
  if (!m) return null
  const mult = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }[m[2] ?? ''] ?? 1
  return Number(m[1]) * mult
}

export const checkMath = (q: MathQuestion, input: string) => {
  const x = parseNumber(input)
  return x !== null && Math.abs(x - q.answer) <= q.tolerance + 1e-9
}

// ---- Market sizing ----

export type SizingNode = { driver: string; value: string; /** Words that show the seeker thought of this driver. */ keywords: string[] }
export type SizingPrompt = { id: string; prompt: string; unit: string; answer: number; tree: SizingNode[]; formula: string }

const n = (driver: string, value: string, ...keywords: string[]): SizingNode => ({ driver, value, keywords })

/** Reference estimates, not facts: one defensible assumption tree each. */
export const SIZING: SizingPrompt[] = [
  { id: 'coffee-brussels', prompt: 'How many cups of coffee are sold in cafés in Brussels on a weekday?', unit: 'cups', answer: 240_000, formula: '1.2m people × 40% café drinkers × 0.5 cups a day', tree: [n('Population', '1.2m', 'population', 'people', 'inhabitants', 'residents'), n('Share buying café coffee', '40%', 'share', 'drink', '%', 'adults'), n('Cups per buyer per day', '0.5', 'per day', 'cups', 'frequency', 'a day')] },
  { id: 'bikes-nl', prompt: 'How many new bicycles are sold in the Netherlands each year?', unit: 'bikes', answer: 1_200_000, formula: '18m people × 1.3 bikes each ÷ 19-year life', tree: [n('Population', '18m', 'population', 'people', 'dutch'), n('Bikes per person', '1.3', 'per person', 'bikes per', 'owned', 'ownership'), n('Replacement cycle', '~19 years', 'replace', 'life', 'lifetime', 'years')] },
  { id: 'baguettes-paris', prompt: 'How many baguettes are sold in Paris each day?', unit: 'baguettes', answer: 1_100_000, formula: '1.1m households × 0.8 a day × 1.2 for cafés and restaurants', tree: [n('Households', '1.1m', 'household', 'homes'), n('Baguettes per household per day', '~0.8', 'per day', 'per household', 'daily'), n('Restaurants and cafés', '+20%', 'restaurant', 'café', 'cafe', 'business', 'b2b')] },
  { id: 'hairdressers-de', prompt: 'How many hairdressers work in Germany?', unit: 'hairdressers', answer: 160_000, formula: '84m people × 6 visits a year ÷ (14 clients a day × 220 days)', tree: [n('Population', '84m', 'population', 'people'), n('Haircuts per person per year', '~6', 'per year', 'haircut', 'frequency', 'visits'), n('Clients per hairdresser per day', '~14', 'per day', 'capacity', 'per hairdresser'), n('Working days', '~220', 'days', 'working')] },
  { id: 'cinema-es', prompt: 'What is the yearly box-office revenue of cinemas in Spain?', unit: '€', answer: 560_000_000, formula: '48m people × 1.6 visits a year × €7.30 ticket', tree: [n('Population', '48m', 'population', 'people'), n('Visits per person per year', '1.6', 'visits', 'per year', 'frequency'), n('Average ticket price', '€7.30', 'price', 'ticket')] },
  { id: 'chargers-be', prompt: 'How many public charging points will Belgium need in 2030?', unit: 'charging points', answer: 150_000, formula: '6m cars × 25% electric × 1 public point per 10 EVs', tree: [n('Passenger cars', '6m', 'cars', 'vehicles', 'fleet'), n('Electric share in 2030', '25%', 'electric', 'ev', 'share', 'adoption'), n('EVs per public point', '10', 'per charger', 'per point', 'ratio', 'home charging')] },
  { id: 'pizza-milan', prompt: 'How many pizzas are delivered in Milan each week?', unit: 'pizzas', answer: 270_000, formula: '1.4m people ÷ 2.2 per household × 30% ordering × 1.4 pizzas', tree: [n('Population', '1.4m', 'population', 'people'), n('People per household', '2.2', 'household'), n('Households ordering in a week', '30%', 'order', 'share', 'weekly', 'delivery'), n('Pizzas per order', '1.4', 'per order', 'pizzas per')] },
  { id: 'tennis-fr', prompt: 'How many tennis balls are sold in France each year?', unit: 'balls', answer: 25_000_000, formula: '1m club players × 3 cans × 3 balls + 2m casual × 1 can × 3 + 10m for clubs and tournaments', tree: [n('Regular (club) players', '~1m', 'club', 'licence', 'regular', 'players'), n('Casual players', '~2m', 'casual', 'occasional'), n('Cans per player per year', '3 (regular) / 1 (casual)', 'cans', 'per year', 'frequency'), n('Balls per can', '3', 'per can', 'balls per', 'tube'), n('Clubs and tournaments', '+~10m', 'tournament', 'clubs', 'coaching')] },
  { id: 'screens-de', prompt: 'How many smartphone screens are repaired in Germany each year?', unit: 'repairs', answer: 5_000_000, formula: '65m smartphones × 15% cracked a year × 50% repaired', tree: [n('Smartphones in use', '65m', 'smartphone', 'phones', 'users'), n('Share cracked per year', '15%', 'crack', 'broken', 'damage', 'break'), n('Share repaired (not replaced)', '50%', 'repair', 'replace', 'fixed')] },
  { id: 'beds-dublin', prompt: 'How many purpose-built student beds does Dublin need?', unit: 'beds', answer: 45_000, formula: '100k full-time students × 60% not living at home × 75% wanting student housing', tree: [n('Full-time students', '100k', 'students', 'enrolled'), n('Living away from home', '60%', 'away', 'home', 'parents', 'local'), n('Want purpose-built housing', '75%', 'housing', 'demand', 'prefer', 'share')] },
  { id: 'sunscreen-es', prompt: 'How many bottles of sunscreen are sold in Spain each summer?', unit: 'bottles', answer: 30_000_000, formula: '48m residents × 40% users × 1 bottle + 40m summer tourists × 30% buying locally × 1', tree: [n('Residents', '48m', 'population', 'residents'), n('Residents who use it', '40%', 'use', 'share', 'users'), n('Summer tourists', '~40m', 'tourist', 'visitors'), n('Tourists buying locally', '30%', 'buy', 'local', 'bring'), n('Bottles per buyer', '1', 'per person', 'bottles per')] },
  { id: 'dentist-se', prompt: 'How many dental appointments take place in Sweden each year?', unit: 'appointments', answer: 15_000_000, formula: '10.5m people × 70% visit × 2 appointments', tree: [n('Population', '10.5m', 'population', 'people'), n('Share visiting a dentist each year', '70%', 'share', 'visit', '%'), n('Appointments per visitor', '2', 'per year', 'appointments per', 'frequency', 'check')] },
  { id: 'skipass-ch', prompt: 'What is the yearly revenue from ski passes in Switzerland?', unit: '€', answer: 1_000_000_000, formula: '20m skier-days × €50 average day-pass revenue', tree: [n('Skiers', '~2.5m', 'skiers', 'people', 'tourists', 'visitors'), n('Days per skier per season', '~8', 'days', 'per season', 'frequency'), n('Revenue per skier-day', '€50', 'price', 'pass', 'per day')] },
  { id: 'trees-dk', prompt: 'How many Christmas trees are sold in Denmark each year (home market)?', unit: 'trees', answer: 1_300_000, formula: '2.8m households × 45% real tree + offices, shops and squares', tree: [n('Households', '2.8m', 'household', 'homes'), n('Share buying a real tree', '45%', 'real', 'share', 'artificial'), n('Businesses and public spaces', '+~5%', 'office', 'business', 'shops', 'public')] },
  { id: 'parcels-lu', prompt: 'How many parcels are delivered in Luxembourg on a working day?', unit: 'parcels', answer: 100_000, formula: '670k residents × 30 parcels a year × 1.3 for business ÷ 255 days', tree: [n('Residents', '670k', 'population', 'residents', 'people'), n('Parcels per resident per year', '~30', 'per year', 'per person', 'online', 'e-commerce'), n('Business parcels', '+~30%', 'b2b', 'business', 'office', 'commuter'), n('Delivery days', '~255', 'days', 'working')] },
  { id: 'dogfood-uk', prompt: 'What is the yearly market for dog food in the UK?', unit: '£', answer: 1_800_000_000, formula: '12m dogs × £150 a year', tree: [n('Dogs', '12m', 'dogs', 'pets', 'households'), n('Spend per dog per year', '£150', 'spend', 'per dog', 'cost', 'price')] },
  { id: 'scooter-ams', prompt: 'How many shared e-bike and scooter rides happen in Amsterdam in a year?', unit: 'rides', answer: 9_000_000, formula: '5,000 vehicles × 5 rides a day × 365 days', tree: [n('Vehicles in the fleet', '~5,000', 'fleet', 'vehicles', 'scooters', 'bikes'), n('Rides per vehicle per day', '~5', 'per day', 'utilisation', 'utilization', 'rides per'), n('Days', '365 (lower in winter)', 'days', 'season', 'winter', 'year')] },
  { id: 'gyms-ie', prompt: 'How many gym memberships are there in Ireland?', unit: 'memberships', answer: 600_000, formula: '3.9m adults × 15% members', tree: [n('Adults', '3.9m', 'adults', 'population', 'people'), n('Share with a membership', '15%', 'share', 'members', 'membership', '%')] },
  { id: 'espresso-it', prompt: 'How many espresso machines do Italian bars and cafés buy each year?', unit: 'machines', answer: 18_000, formula: '150k bars × 1.2 machines ÷ 12-year life + 3k for new openings', tree: [n('Bars and cafés', '150k', 'bars', 'cafés', 'cafes', 'outlets'), n('Machines per bar', '1.2', 'per bar', 'machines per'), n('Replacement cycle', '~12 years', 'replace', 'life', 'years'), n('New openings', '+~3k', 'new', 'openings', 'growth')] },
  { id: 'trains-be', prompt: 'How many train tickets and passes are used on a weekday in Belgium?', unit: 'journeys', answer: 900_000, formula: '11.8m people × 4% travelling by train × 2 journeys', tree: [n('Population', '11.8m', 'population', 'people'), n('Share travelling by train on a weekday', '~4%', 'commuter', 'share', 'train users', 'students'), n('Journeys per traveller', '2 (return)', 'return', 'journeys per', 'two-way', 'round')] },
]

export type SizingResult = { ratio: number; verdict: 'close' | 'ballpark' | 'off'; missed: SizingNode[]; covered: SizingNode[] }

/**
 * Within ±50% of the reference is close, within 3× either way is the right ballpark. A driver counts as covered when
 * any of its keywords appears in the seeker's own tree.
 */
export function scoreSizing(p: SizingPrompt, estimate: number, drivers: string): SizingResult {
  const ratio = estimate / p.answer
  const verdict = ratio >= 0.5 && ratio <= 1.5 ? 'close' : ratio >= 1 / 3 && ratio <= 3 ? 'ballpark' : 'off'
  const text = drivers.toLowerCase()
  const covered = p.tree.filter((d) => d.keywords.some((k) => text.includes(k.toLowerCase())))
  return { ratio, verdict, covered, missed: p.tree.filter((d) => !covered.includes(d)) }
}

// ---- Framework primer ----

export type Framework = { id: string; name: string; when: string; buckets: { name: string; ask: string }[]; watch: string }

export const FRAMEWORKS: Framework[] = [
  {
    id: 'profitability',
    name: 'Profitability',
    when: 'Profits are falling, or a client wants them higher.',
    buckets: [
      { name: 'Revenue', ask: 'Price × volume, per product and segment. Which moved, and since when?' },
      { name: 'Costs', ask: 'Fixed and variable. Which line grew faster than revenue?' },
      { name: 'External', ask: 'Is the whole market down, or just the client? Competitors, regulation, inputs.' },
    ],
    watch: 'Compare with the market before blaming the client; a falling market changes the answer.',
  },
  {
    id: 'market-entry',
    name: 'Market entry',
    when: 'Should the client enter a new country, segment or product line?',
    buckets: [
      { name: 'Market', ask: 'Size, growth, margins, customer needs.' },
      { name: 'Competition', ask: 'Who is there, how concentrated, what would they do in response?' },
      { name: 'Client fit', ask: 'Capabilities, brand, cash to invest.' },
      { name: 'How to enter', ask: 'Build, buy or partner; cost, time and risk of each.' },
    ],
    watch: 'End with a go / no-go and the one condition that would change it.',
  },
  {
    id: 'ma',
    name: 'Mergers & acquisitions',
    when: 'Should the client buy a company?',
    buckets: [
      { name: 'Target on its own', ask: 'Market, position, financial health.' },
      { name: 'Synergies', ask: 'Revenue (cross-selling) and costs (overlap). How sure are they?' },
      { name: 'Price', ask: 'Valuation against what the synergies are worth.' },
      { name: 'Risks', ask: 'Integration, culture, regulators, financing.' },
    ],
    watch: 'Synergies are usually overestimated; say which you would discount.',
  },
  {
    id: 'pricing',
    name: 'Pricing',
    when: 'How should the client price a new or existing product?',
    buckets: [
      { name: 'Cost floor', ask: 'What does one unit cost, and what margin is needed?' },
      { name: 'Customer value', ask: 'What is it worth to the buyer, and how price-sensitive are they?' },
      { name: 'Competitors', ask: 'What do alternatives cost, and how is this different?' },
    ],
    watch: 'Value sets the ceiling, cost the floor, competitors where in between.',
  },
  {
    id: 'growth',
    name: 'Growth',
    when: 'The client wants to grow revenue.',
    buckets: [
      { name: 'Existing customers', ask: 'Sell more, more often, at a better price.' },
      { name: 'New customers', ask: 'New segments or regions for the existing product.' },
      { name: 'New products', ask: 'Adjacent offers to existing customers.' },
      { name: 'Acquisitions', ask: 'Buy growth when building is too slow.' },
    ],
    watch: 'Rank the options by size, speed and risk, then recommend one.',
  },
]
