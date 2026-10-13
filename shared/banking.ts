// Investment banking prep, no model: a paper LBO generator and the reference content for /prepare/interviews/banking.
// Structure follows Wall Street Prep's Red Book (technicals) and its recruiting and networking guide; the wording is ours.
import { rng } from './case-kit.ts'

// ---- Paper LBO ----

export type PaperLbo = { ebitda: number; entry: number; debtPct: number; exitEbitda: number; repaid: number; exit: number; years: number }
export type LboAnswer = { price: number; debt: number; equity: number; exitEv: number; exitDebt: number; exitEquity: number; mom: number; irr: number }

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!

/** A deal with round numbers, built so it can be solved on paper in about five minutes. */
export function paperLbo(seed: number): PaperLbo {
  const r = rng(seed)
  const ebitda = pick(r, [50, 80, 100, 120, 150, 200])
  const entry = pick(r, [6, 7, 8, 9, 10])
  const debtPct = pick(r, [50, 60, 70])
  const exitEbitda = Math.round((ebitda * pick(r, [1.2, 1.3, 1.4, 1.5, 1.6])) / 5) * 5
  const debt = (ebitda * entry * debtPct) / 100
  const repaid = Math.min(debt, Math.round((ebitda * pick(r, [1, 1.5, 2])) / 10) * 10)
  return { ebitda, entry, debtPct, exitEbitda, repaid, exit: entry + pick(r, [-1, 0, 0, 1]), years: 5 }
}

export function solveLbo(d: PaperLbo): LboAnswer {
  const price = d.ebitda * d.entry
  const debt = (price * d.debtPct) / 100
  const equity = price - debt
  const exitEv = d.exitEbitda * d.exit
  const exitDebt = debt - d.repaid
  const exitEquity = exitEv - exitDebt
  const mom = exitEquity / equity
  return { price, debt, equity, exitEv, exitDebt, exitEquity, mom, irr: (mom ** (1 / d.years) - 1) * 100 }
}

/** Paper-LBO tolerance: the multiple within 0.1×, the IRR within 2 points (what rule-of-thumb maths gets you). */
export const lboClose = (a: LboAnswer, mom: number, irr: number) => ({ mom: Math.abs(mom - a.mom) <= 0.1 + 1e-9, irr: Math.abs(irr - a.irr) <= 2 })

// ---- Your pitch ("Tell me about yourself") ----

export const PITCH_PARTS = [
  ['opening', 'Opening line', 'Thank them. Your name, where you are from, what and where you study, which year.'],
  ['hook', 'Hook', 'The moment finance or business first caught you. One short, true story.'],
  ['experiences', 'Experiences', 'Two to four, in order. For each: what it was, what you learned, why it led to the next.'],
  ['ending', 'Ending', 'Why that adds up to this role, at this bank.'],
] as const
export type PitchPart = (typeof PITCH_PARTS)[number][0]

/** Spoken length at about 150 words a minute. Aim for 90 seconds, give or take 20. */
export const pitchSeconds = (text: string) => Math.round((text.split(/\s+/).filter(Boolean).length / 150) * 60)
export const PITCH_RANGE = [70, 110] as const

// ---- Networking calls ----

export const CALL_STEPS = [
  ['Open', 'Thank them for their time, a minute of small talk, then: “I’d love to tell you a bit about me and hear about your path to the bank.” Give a 30-second version of your pitch.'],
  ['Ask', 'Questions that start a conversation, not an interview. Frame a few with what you already know: “I could imagine every deal is different, so is there a typical day?”'],
  ['Close', 'Thank them, ask what they would do in your place, and whether there is anyone else you should speak with. That second name is the goal of the call.'],
  ['Follow up', 'A short thank-you within 24 hours that mentions one thing they said. Write again when you act on their advice.'],
] as const

export const CALL_QUESTIONS = [
  ['Their path', ['How did you end up in your group?', 'What did your previous role teach you that you use now?', 'What surprised you most when you started?']],
  ['The work', ['Which deal taught you the most so far?', 'How much do analysts run with the model themselves?', 'How has the market changed your deal flow this year?']],
  ['Advice', ['What would you do in my shoes this year?', 'What makes a candidate stand out to your team?', 'Is there anyone else you would suggest I speak with?']],
] as const

export const CALL_AVOID = 'Skip pay, exit opportunities, perks and “what does an analyst actually do”: they signal you have not done the reading.'

// ---- Recruiting in Europe ----

export const CALENDAR = [
  ['September–January', 'Spring weeks and insight days, mostly for first and second-year students. Many close before Christmas.'],
  ['July–November', 'Summer internships for the following year open. Banks hire on a rolling basis, so apply in the first weeks.'],
  ['All year', 'Off-cycle internships of three to six months. A common route in Europe for master’s students and recent graduates.'],
  ['After the summer', 'Most analyst offers come from converting a summer internship; direct graduate hiring fills the rest.'],
] as const

export const ROUNDS = ['Application and CV', 'Online tests and often a recorded video interview', 'First round: fit and technicals', 'Superday or assessment centre, sometimes with a case or modelling test', 'Offer'] as const

// ---- Resources ----

export type Resource = { name: string; url: string; line: string }
const res = (name: string, url: string, line: string): Resource => ({ name, url, line })

export const PATH = [
  'Learn the concepts with the free guides below.',
  'Drill one question bank until you answer without notes. The technicals here are a start.',
  'Read interview reports for each bank before each round.',
  'Build one DCF and one LBO on a real company. It gives you something to talk about.',
] as const

export const RESOURCES: [string, Resource[]][] = [
  ['Free', [
    res('Wall Street Prep guides', 'https://www.wallstreetprep.com/knowledge/', 'From the publisher of the Red Book. Clear articles on accounting, DCF, M&A and LBOs.'),
    res('Mergers & Inquisitions', 'https://mergersandinquisitions.com', 'The best free writing on recruiting, technicals and networking.'),
    res('Aswath Damodaran, NYU', 'https://pages.stern.nyu.edu/~adamodar/', 'Free valuation lectures, spreadsheets and data. Learn why, not only what.'),
    res('Macabacus', 'https://macabacus.com/', 'Free model templates and a technical knowledge base.'),
    res('Wall Street Oasis forums', 'https://www.wallstreetoasis.com/forum', 'Interview reports by bank, pay data and recruiting timelines.'),
    res('Rosenbaum & Pearl, Investment Banking', 'https://www.wiley.com/en-us/search?pq=rosenbaum%20investment%20banking', 'The standard textbook. Often in university libraries.'),
  ]],
  ['Paid, pick one', [
    res('Breaking Into Wall Street', 'https://breakingintowallstreet.com', 'Repetition-heavy modelling practice and a widely used 400-question guide.'),
    res('Wall Street Prep Premium', 'https://www.wallstreetprep.com', 'The modelling course banks use for analyst training.'),
    res('Financial Edge', 'https://www.fe.training', 'London-based and known in European banks.'),
    res('Exponent mock interviews', 'https://www.tryexponent.com/coaching/investment-banking', 'Book a mock interview with a working analyst.'),
  ]],
  ['Build with real data', [
    res('OpenBB', 'https://github.com/OpenBB-finance/OpenBB', 'Open-source research terminal. Pull real financials for practice comps.'),
    res('FinanceToolkit', 'https://github.com/JerBouma/FinanceToolkit', 'More than 150 ratios and models, computed in the open.'),
    res('Anthropic financial services', 'https://github.com/anthropics/financial-services', 'Reference comps, DCF, LBO and CIM workflows: see how deliverables are structured.'),
  ]],
  ['Jobs in Europe', [
    res('eFinancialCareers', 'https://www.efinancialcareers.com', 'Finance job board with the most European banking roles.'),
  ]],
]
