// What each provider's games are and which companies use them at which stage. Hand-curated from public sources
// (provider pages, company careers pages, gameassessmentprep.com write-ups), checked 2026-10. Timings and round counts
// marked in `note` as reconstructed are candidates' reports, not provider-published.
import { PROVIDERS, type CompanyAssessment, type GameId } from './assessments'

export type ProviderGame = {
  /** Stable id used in practice URLs: `<provider>-<game>`. */
  id: string
  provider: string
  /** The name candidates see in the real assessment. */
  name: string
  measures: string
  /** Seconds the real game runs; null when untimed or set by rounds. */
  realDuration: number | null
  realRounds: number | null
  /** The Agisse component that implements it, plus the rule variant it runs. */
  gameId: GameId
  variant?: string
  /** Instructions when the variant's rules differ from the component's default howTo. */
  howTo?: string
  note?: string
  /** Format · timing · tactics, about 120 words, shown before starting. */
  guide?: string
  /** The publisher's own free practice page. */
  practiceUrl?: string
  /** Whether the real length and item count come from the publisher (confirmed) or from candidate and prep-site reports (reconstructed). */
  basis?: 'confirmed' | 'reconstructed'
  /** No countdown: the real test records time per item and scores pace separately from accuracy (Capp, Sova). */
  timeRecorded?: boolean
}

const SHL_PRACTICE = 'https://www.shl.com/shldirect/en/practice-tests/'
const CAPP_PRACTICE = 'https://hub.preparationplus.com/'
const SOVA_PRACTICE = 'https://www.sovaassessment.com/candidate-preparation-hub'
const SAVILLE_PRACTICE = 'https://www.savilleassessment.com/practice-tests'
const KF_PRACTICE = 'https://www.kornferry.com/careers/candidates/candidate-guide-assessments'
const AON_PRACTICE = 'https://www.aon.com/en/capabilities/talent-and-rewards/prepare-for-your-online-assessment'
const WG_PRACTICE = 'https://www.talentlens.com/practice-tests.html'

const EXTRA_NAMES: Record<string, string> = { 'mckinsey-solve': 'McKinsey Solve', criteria: 'Criteria', saville: 'Saville', 'talent-q': 'Korn Ferry (Talent Q)', 'watson-glaser': 'Watson-Glaser', harver: 'Harver' }
export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? EXTRA_NAMES[id] ?? id
/** URL segment for a firm or provider page: "Bain & Company" → "bain-and-company". */
export const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Each provider's own free practice page, for the providers that publish one. */
export const OFFICIAL_PRACTICE: Record<string, string> = { shl: SHL_PRACTICE, cappfinity: CAPP_PRACTICE, sova: SOVA_PRACTICE, saville: SAVILLE_PRACTICE, 'talent-q': KF_PRACTICE, aon: AON_PRACTICE, 'watson-glaser': WG_PRACTICE }

const g = (provider: string, slug: string, name: string, gameId: GameId, measures: string, realDuration: number | null, realRounds: number | null, extra: Partial<ProviderGame> = {}): ProviderGame => ({
  id: `${provider}-${slug}`,
  provider,
  name,
  measures,
  realDuration,
  realRounds,
  gameId,
  ...extra,
})

export const PROVIDER_GAMES: ProviderGame[] = [
  // HireVue game-based assessment: the employer picks 4–6 of these, usually one attempt.
  g('hirevue', 'numerosity', 'Numerosity', 'numerosity', 'Mental arithmetic', 180, null),
  g('hirevue', 'flashback', 'Flashback', 'n-back', 'Working memory', 180, null, { variant: 'flashback', howTo: 'Does this shape match the one N steps back? N rises from 1 to 3; at 3-back the colour must match too.' }),
  g('hirevue', 'digitspan', 'Digitspan', 'working-memory', 'Short-term memory', 180, null, { variant: 'digitspan', howTo: 'Letters and digits flash one at a time. Type them back in order, or backwards when told.' }),
  g('hirevue', 'disconumbers', 'Disconumbers', 'disconumbers', 'Working memory and arithmetic', 180, null),
  g('hirevue', 'pathfinder', 'Pathfinder', 'pathfinder', 'Spatial planning', 300, null),
  g('hirevue', 'puzzle', 'Puzzle', 'image-puzzle', 'Visual memory', 420, null),
  g('hirevue', 'shapedance', 'Shapedance', 'shape-match', 'Attention to detail', 180, null, { variant: 'identical', howTo: 'Select every figure that is exactly identical to another; the rest differ in a small detail.' }),
  g('hirevue', 'singularity', 'Singularity', 'shape-match', 'Visual scanning', 180, null, { variant: 'unique', howTo: 'Click the one image that is different from all the others.' }),
  g('hirevue', 'e-motions', 'E-Motions', 'emotions', 'Emotion recognition', 240, null, { variant: 'six' }),
  g('hirevue', 'pulse', 'Pulse', 'go-no-go', 'Impulse control', 120, null, { variant: 'pulse', howTo: 'Press Space only when the object shows a red dot. The pace speeds up as you get it right.' }),

  // pymetrics (Harver): 12 games, ~25 min, no right/wrong feedback.
  g('pymetrics', 'balloons', 'Balloons', 'balloons', 'Risk tolerance and learning', null, 39, { variant: 'pymetrics', note: 'Balloon count reconstructed from candidate reports.' }),
  g('pymetrics', 'cards', 'Cards', 'cards', 'Learning from reward and loss', null, 80, { variant: 'iowa', note: 'Draw count reconstructed.' }),
  g('pymetrics', 'digits', 'Digits', 'working-memory', 'Short-term memory', null, null, { variant: 'digits', howTo: 'Digits flash one at a time. Type them back in order; one more digit each time you are right.' }),
  g('pymetrics', 'easy-or-hard', 'Easy or Hard', 'easy-hard', 'Effort versus reward', 120, null),
  g('pymetrics', 'faces', 'Faces', 'emotions', 'Emotion recognition', null, 14, { variant: 'ten', howTo: 'Pick the emotion the face shows, sometimes with a situation to read. 7 s per face, 30 s with a situation.' }),
  g('pymetrics', 'keypresses', 'Keypresses', 'keypresses', 'Processing speed and persistence', null, 3),
  g('pymetrics', 'stop', 'Stop', 'go-no-go', 'Impulse control', null, 80, { variant: 'stop', howTo: 'Press Space when the light is red; hold back when it is green.' }),
  g('pymetrics', 'arrows', 'Arrows', 'flanker', 'Attention and task switching', null, 135, { variant: 'arrows', howTo: 'Blue or black arrows: answer the middle arrow. Red arrows: answer the side arrows.' }),
  g('pymetrics', 'lengths', 'Lengths', 'lengths', 'Learning from feedback', null, 90, { note: 'Reward bias reconstructed.' }),
  g('pymetrics', 'towers', 'Towers', 'towers', 'Planning', 120, null),
  g('pymetrics', 'money-exchange-1', 'Money Exchange 1', 'money-exchange', 'Trust and fairness', null, 4, { variant: 'trust', note: 'Preference only: there is no better answer.' }),
  g('pymetrics', 'money-exchange-2', 'Money Exchange 2', 'money-exchange', 'Generosity and fairness', null, 2, { variant: 'dictator', howTo: 'Split $10 with a stranger, then rate how fair other splits were.', note: 'Preference only: there is no better answer.' }),

  // Arctic Shores: employer-configured battery of tasks.
  g('arctic-shores', 'balloon', 'Balloon', 'balloons', 'Risk tolerance and learning', null, 45, { variant: 'arctic', howTo: 'P pumps the balloon and adds money; Q banks it. A pop loses what is not banked.' }),
  g('arctic-shores', 'direction', 'Direction', 'flanker', 'Focus and control', null, 80, { variant: 'direction', howTo: 'Answer the direction of the centre arrow with Q (left) or P (right). When the sides are X\'s, do not press.' }),
  g('arctic-shores', 'tickets', 'Tickets', 'task-switching', 'Task switching', null, 80, { variant: 'tickets', howTo: 'Ticket at the top: is the number even? At the bottom: does the shape have corners? Q = no, P = yes.' }),
  g('arctic-shores', 'tiles', 'Tiles', 'spatial-memory', 'Sequence memory', null, null, { variant: 'tiles', howTo: 'Repeat the blue tiles in the order they lit; ignore the orange flashes.' }),
  g('arctic-shores', 'security', 'Security', 'security-dial', 'Timing and persistence', null, 10),
  g('arctic-shores', 'energy', 'Energy', 'cards', 'Learning under shifting odds', null, 50, { variant: 'energy', howTo: 'Activate generators to gain energy. Each colour has hidden odds, and positions shuffle: follow the colour.' }),
  g('arctic-shores', 'predict', 'Predict', 'predict', 'Probabilistic learning', null, 60),
  g('arctic-shores', 'team-sales', 'Team Sales', 'team-sales', 'Cooperation versus competition', null, 12),
  g('arctic-shores', 'expressions', 'Expressions', 'emotions', 'Emotion recognition', null, 50, { variant: 'seven', howTo: 'Pick which of the seven basic emotions the face shows.' }),
  g('arctic-shores', 'balance', 'Balance', 'balance', 'Deductive reasoning', null, 20),
  g('arctic-shores', 'order', 'Order', 'order', 'Inductive reasoning', null, 20, { variant: 'order' }),
  g('arctic-shores', 'patterns', 'Patterns', 'order', 'Abstract reasoning', 1020, 20, { variant: 'patterns', howTo: 'Choose which of five squares comes next in the sequence.' }),
  g('arctic-shores', 'token-search', 'Token Search', 'token-search', 'Spatial working memory', null, null, { note: 'Not confirmed in the current battery.' }),

  // Aon (cut-e) smartPredict.
  g('aon', 'grid-challenge', 'gridChallenge', 'grid-challenge', 'Working memory under distraction', 540, 9),
  g('aon', 'switch-challenge', 'switchChallenge', 'switch-challenge', 'Deductive reasoning', 360, null),
  g('aon', 'digit-challenge', 'digitChallenge', 'digit-challenge', 'Numerical reasoning', 360, null),
  g('aon', 'motion-challenge', 'motionChallenge', 'motion-challenge', 'Planning', 360, null, { variant: 'moves' }),
  g('aon', 'gap-challenge', 'gapChallenge', 'gap-challenge', 'Logical reasoning', 360, null),

  // Criteria (formerly Revelian) Cognify and Emotify.
  g('criteria', 'grid-lock', 'Grid Lock', 'grid-lock', 'Spatial reasoning', 180, 9),
  g('criteria', 'numbubbles', 'Numbubbles', 'numbubbles', 'Numerical speed', 200, 10),
  g('criteria', 'proof-it', 'Proof It', 'proof-it', 'Attention to detail', 300, 5),
  g('criteria', 'resemble', 'Resemble', 'image-puzzle', 'Spatial reasoning', 180, 9, { variant: 'resemble', howTo: 'Rebuild the tile pattern in the empty grid, turned as the prompt says.' }),
  g('criteria', 'short-cuts', 'Short Cuts', 'motion-challenge', 'Planning', 240, 7, { variant: 'distance', howTo: 'Route the marble to the star along the shortest total track length.' }),
  g('criteria', 'tally-up', 'Tally Up', 'tally-up', 'Working memory and arithmetic', 140, 35),
  g('criteria', 'matching-faces', 'Matching Faces', 'emotions', 'Emotion recognition', 90, 30, { variant: 'match', howTo: 'Pick the face that shows the same emotion as the target. 3 s per round.' }),

  // McKinsey Solve: McKinsey's own build.
  g('mckinsey-solve', 'sea-wolf', 'Sea Wolf', 'sea-wolf', 'Problem solving with constraints', 1950, 3),
  g('mckinsey-solve', 'redrock', 'Redrock', 'redrock', 'Data analysis and synthesis', 2100, null),

  // Aon (cut-e) scales: short speed tests, "answer as many as you can" (Aon's candidate page).
  g('aon', 'scales-numerical', 'scales numerical', 'numerical-data', 'Numerical reasoning at speed', 720, 37, {
    basis: 'confirmed',
    practiceUrl: AON_PRACTICE,
    guide:
      'Format: tables and charts with one question each; several screens reuse the same data, so read the headings once and keep them in mind. Timing: 12 minutes for up to 37 items, and almost nobody finishes, so the score rewards correct answers per minute. Tactics: estimate first and pick the option that fits; work it out exactly only when two options are close. Skip an item that would cost more than a minute. Have a calculator and scrap paper ready before you start.',
  }),
  g('aon', 'scales-verbal', 'scales verbal', 'verbal-tfc', 'Verbal reasoning at speed', 720, 49, {
    basis: 'confirmed',
    practiceUrl: AON_PRACTICE,
    guide:
      'Format: short texts, each followed by statements you mark true, false or cannot say from the text alone. Timing: 12 minutes for up to 49 statements; the test is built so you run out of time. Tactics: read the statement first, then scan the text for the one sentence it depends on. Watch qualifiers (all, some, only, by 2027): a statement that goes one step beyond the text is cannot say, not true. Ignore what you know about the topic.',
  }),

  // SHL Verify: one countdown per test. Interactive versions are adaptive.
  g('shl', 'verify-numerical', 'Verify Numerical Reasoning', 'numerical-data', 'Numerical reasoning', 1080, 10, {
    basis: 'confirmed',
    practiceUrl: SHL_PRACTICE,
    note: 'Interactive version: up to 10 adaptive items in 18 min (SHL factsheet). The classic version runs about 18 items in 25 min (reported).',
    guide:
      'Format: tables and charts of business data; each item asks for a percentage change, a ratio, a currency conversion or a projection, with five options. The interactive version has you drag bars or fill tables instead. Timing: one countdown for the whole test, about one to two minutes per item. Tactics: write down the units before calculating (thousands, € million, per €1); most wrong options come from the wrong base year or an inverted rate. Use a calculator, but estimate first so a typo cannot fool you.',
  }),
  g('shl', 'verify-verbal', 'Verify Verbal Reasoning', 'verbal-tfc', 'Verbal reasoning', 1140, 30, {
    basis: 'reconstructed',
    practiceUrl: SHL_PRACTICE,
    guide:
      'Format: business passages of about 120–200 words, each with statements to mark true, false or cannot say. Timing: about 30 statements in 17–19 minutes, roughly 35 seconds each. Tactics: true means the passage says or directly implies it; false means the passage contradicts it; cannot say means you would need outside information. The most common trap is a plausible statement the passage never makes: that is cannot say. Read the statement first, then find the line it depends on.',
  }),
  g('shl', 'verify-inductive', 'Verify Inductive Reasoning', 'order', 'Abstract reasoning', 1080, 15, {
    variant: 'patterns',
    basis: 'confirmed',
    practiceUrl: SHL_PRACTICE,
    howTo: 'Find the rule behind the series of figures and choose which comes next.',
    guide:
      'Format: a series of figures that change by a hidden rule; pick the one that comes next (the interactive version has you build it). Timing: up to 15 adaptive items in 18 minutes, about a minute each. Tactics: track one element at a time: position, count, rotation, shading. Rules often combine two changes, one moving every step and another every second step. When stuck, cross out options that break a rule you are sure of.',
  }),
  g('shl', 'verify-deductive', 'Verify Deductive Reasoning', 'critical-reasoning', 'Deductive reasoning', null, null, {
    variant: 'deduction',
    basis: 'reconstructed',
    practiceUrl: SHL_PRACTICE,
    howTo: 'Accept the premises as true and decide whether each conclusion must follow from them.',
    guide:
      'Format: short sets of premises, and conclusions you judge as following or not; some employers use an interactive version with scheduling puzzles. Timing: one countdown; item counts vary by version. Tactics: treat the premises as true even when they sound odd, and test each conclusion against them, not against real life. Watch the classic errors: "some" does not mean "all", and "if A then B" does not mean "if B then A". Sketch a diagram for anything with three or more terms.',
  }),

  // Cappfinity (Capp): often untimed but time-recorded; item counts are not published.
  g('cappfinity', 'numerical', 'Numerical Reasoning', 'numerical-data', 'Numerical reasoning', null, 12, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: CAPP_PRACTICE,
    note: 'Item count reconstructed; Capp does not publish it.',
    guide:
      'Format: data questions, sometimes with typed answers rather than options; difficulty adapts to you. Timing: often no countdown, but your time per item is recorded and counts; your instructions say which applies. Tactics: work steadily rather than fast, since a quick wrong answer costs more than ten extra seconds. Check units and the base year before each calculation, and type answers in the format asked.',
  }),
  g('cappfinity', 'verbal', 'Verbal Reasoning', 'verbal-tfc', 'Verbal reasoning', null, 12, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: CAPP_PRACTICE,
    note: 'Item count reconstructed.',
    guide:
      'Format: passages with statements to judge, plus newer item types such as spotting errors or ranking. Timing: usually time-recorded rather than counted down. Tactics: judge strictly from the passage; a statement that goes one step further than the text is cannot say. Keep a steady pace: Capp reports how long you take as well as whether you are right.',
  }),
  g('cappfinity', 'critical', 'Critical Reasoning', 'critical-reasoning', 'Critical reasoning', null, 12, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: CAPP_PRACTICE,
    note: 'Item count reconstructed.',
    guide:
      'Format: arguments, assumptions and conclusions to evaluate, close to the five classic critical-thinking item types. Timing: time-recorded. Tactics: separate what the text states from what it assumes; a conclusion follows only if it must be true given the text. For argument items, strong means both important and directly about the question.',
  }),
  g('cappfinity', 'sjt', 'Situational Judgement', 'sjt', 'Judgement and strengths', null, 10, {
    variant: 'rate',
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: CAPP_PRACTICE,
    howTo: 'Rate how effective each response is, from 1 (counterproductive) to 4 (highly effective).',
    note: 'Item count reconstructed.',
    guide:
      'Format: workplace scenarios where you rate or rank each response; Capp tests are strengths-based, looking for what you would naturally do well. Timing: time-recorded. Tactics: the best response usually owns the problem, involves the right person early and keeps the client or team informed. Avoid both extremes: escalating everything, and acting alone without telling anyone.',
  }),

  // Sova: one combined assessment; no visible timer, speed and accuracy both scored.
  g('sova', 'numerical', 'Numerical Reasoning', 'numerical-data', 'Numerical reasoning', null, 9, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: SOVA_PRACTICE,
    note: 'About 9 items in 3 sets (reported).',
    guide:
      'Format: sets of three questions on one table or chart. Timing: no visible timer, but each question is timed and Sova scores how quickly and how accurately you answer, separately. Tactics: read the whole table once per set, since the next questions reuse it. Do not rush into errors: a fast wrong answer only helps pace.',
  }),
  g('sova', 'verbal', 'Verbal Reasoning', 'verbal-tfc', 'Verbal reasoning', null, 9, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: SOVA_PRACTICE,
    note: 'About 9 items in 3 sets (reported).',
    guide:
      'Format: a passage with three statements to judge true, false or cannot say. Timing: time-recorded per question, no countdown. Tactics: decide from the passage alone; when a statement uses a stronger word than the text (always, all, caused), it is usually false or cannot say. Keep moving: speed is scored alongside accuracy.',
  }),
  g('sova', 'logical', 'Logical Reasoning', 'diagrammatic', 'Abstract reasoning', null, 9, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: SOVA_PRACTICE,
    note: 'Format and count reconstructed.',
    guide:
      'Format: figures that change by rules you infer, then apply. Timing: time-recorded per item. Tactics: name each rule in words before applying it ("swaps colours", "moves the first to the end") and apply rules in the order shown. Cross out options that break the rule you are surest of.',
  }),
  g('sova', 'sjt', 'Situational Judgement', 'sjt', 'Judgement', null, 8, {
    basis: 'reconstructed',
    timeRecorded: true,
    practiceUrl: SOVA_PRACTICE,
    note: 'Count reconstructed.',
    guide:
      'Format: workplace scenarios where you pick the most and least effective response. Timing: no countdown. Tactics: the best response solves the problem at the right level, involves the right people early and is honest; the worst usually hides a problem or breaks a rule. Answer as the employer would want a new graduate to act.',
  }),

  // Saville Swift Analysis Aptitude: three 6-minute sub-tests of 8 items.
  g('saville', 'swift-verbal', 'Swift Verbal', 'verbal-tfc', 'Verbal analysis', 360, 8, {
    basis: 'reconstructed',
    practiceUrl: SAVILLE_PRACTICE,
    guide:
      'Format: the first part of Swift Analysis Aptitude: short passages with statements to mark true, false or cannot say. Timing: 8 items in 6 minutes; the numerical and diagrammatic parts then run on their own clocks. Tactics: 45 seconds per item leaves no time to read a passage twice: read the statement, find its sentence, decide. Never leave an item blank; a guess beats nothing.',
  }),
  g('saville', 'swift-numerical', 'Swift Numerical', 'numerical-data', 'Numerical analysis', 360, 8, {
    basis: 'reconstructed',
    practiceUrl: SAVILLE_PRACTICE,
    guide:
      'Format: tables of business data with five options per question. Timing: 8 items in 6 minutes. Tactics: estimate first and see whether only one option fits; often it does. Keep a calculator open, watch units, and move on from any item that needs more than a minute.',
  }),
  g('saville', 'swift-diagrammatic', 'Swift Diagrammatic', 'diagrammatic', 'Diagrammatic analysis', 360, 8, {
    basis: 'reconstructed',
    practiceUrl: SAVILLE_PRACTICE,
    guide:
      'Format: figures pass through operator boxes that each change them in one way; work out the rules from examples, then predict the output. Timing: 8 items in 6 minutes. Tactics: decode the box you are surest of first. Name each rule in a word (invert, reverse, rotate) so you do not re-derive it per item.',
  }),

  // Korn Ferry (Talent Q) Elements: adaptive, timed per question.
  g('talent-q', 'numerical', 'Elements Numerical', 'numerical-data', 'Numerical reasoning', 900, 12, {
    basis: 'reconstructed',
    practiceUrl: KF_PRACTICE,
    note: 'Each question has its own clock, about 75–90 s (reported); Agisse runs one clock for the set.',
    guide:
      'Format: adaptive: each answer sets the difficulty of the next, and several questions share one table. Timing: each question has its own clock, about 90 seconds for the first on a table and 75 after (reported). Tactics: read the table carefully on its first question, since later ones reuse it with less time. A question left unanswered when its clock ends counts as wrong, so always pick something.',
  }),
  g('talent-q', 'verbal', 'Elements Verbal', 'verbal-tfc', 'Verbal reasoning', 900, 15, {
    basis: 'reconstructed',
    practiceUrl: KF_PRACTICE,
    note: 'Each question about 60–75 s (reported).',
    guide:
      'Format: adaptive passages with statements; some versions ask which of several statements is true. Timing: per question, roughly 75 seconds for the first on a passage and 60 after. Tactics: read the passage fully on its first question, then scan for keywords. Stay strictly inside the text.',
  }),
  g('talent-q', 'logical', 'Elements Logical', 'diagrammatic', 'Logical reasoning', 900, 12, {
    basis: 'reconstructed',
    practiceUrl: KF_PRACTICE,
    note: 'Each question about 75 s (reported).',
    guide:
      'Format: rows or grids of shapes following rules; find what fits or what comes out. Timing: per question, about 75 seconds. Tactics: list what can change (shape, colour, count, position, order) and check which one each rule touches. Guess rather than time out.',
  }),

  // Watson-Glaser III (TalentLens), common at UK and EU law firms.
  g('watson-glaser', 'critical-thinking', 'Watson-Glaser Critical Thinking', 'critical-reasoning', 'Critical thinking', 1800, 40, {
    basis: 'confirmed',
    practiceUrl: WG_PRACTICE,
    guide:
      'Format: 40 items in five sections: inference (rated from true to false), recognising assumptions, deduction, interpretation and evaluating arguments. Timing: 30 minutes in most versions. Tactics: each section has its own rule, so read its instructions: deduction asks what must follow, interpretation what follows beyond reasonable doubt. For assumptions, ask whether the statement still makes sense without it. A strong argument is important and directly about the question, even if you disagree.',
  }),
]

export const providerGame = (id: string) => PROVIDER_GAMES.find((x) => x.id === id) ?? null
export const providerGames = (provider: string) => PROVIDER_GAMES.filter((x) => x.provider === provider)

/** Personality and preference tests in the same batteries: nothing to train, so only a note. */
export const UNTRAINABLE: { provider: string; name: string; note: string }[] = [
  { provider: 'hirevue', name: 'Portrait / PortraitXT', note: 'Picture pairs or agree/disagree statements about your preferences. Answer honestly and consistently; there is no right answer.' },
  { provider: 'hirevue', name: 'Teamchat', note: 'A chat scenario where you choose replies. Pick what you would really say to a colleague: clear, respectful, solution-focused.' },
  { provider: 'plum', name: 'Plum survey', note: 'A 25-minute untimed survey of personality and problem solving. Rank honestly.' },
]

/** `tests`: the provider game ids the online test is made of; `unless`: other firms whose name contains this one. */
export type CuratedAssessment = Omit<CompanyAssessment, 'id'> & { aliases?: string[]; unless?: string[]; tests: string[] }

const gap = (path: string, title: string) => ({ url: `https://www.gameassessmentprep.com${path}`, title, kind: 'candidate report' as const })
const D = '2026-10-05'
const base = { location: null, weightsEstimated: true, difficulty: null, scoringDimensions: [], sourceDate: D, origin: 'curated' as const, skills: [] }
const ids = (provider: string, names: string[]) => names.map((n) => `${provider}-${n}`)

const PYMETRICS_ALL = ids('pymetrics', ['balloons', 'cards', 'digits', 'easy-or-hard', 'faces', 'keypresses', 'stop', 'arrows', 'lengths', 'towers', 'money-exchange-1', 'money-exchange-2'])

/** Known processes. `stages` name the real games so the prep page can link each one. */
const ROWS: Omit<CuratedAssessment, 'gameTypes'>[] = [
  {
    ...base,
    company: 'McKinsey',
    aliases: ['mckinsey & company'],
    rolePattern: null,
    provider: 'mckinsey-solve',
    assessmentTypes: ['game-based'],
    tests: ['mckinsey-solve-sea-wolf', 'mckinsey-solve-redrock'],
    stages: ['1. McKinsey Solve: Sea Wolf, Redrock (about 65 min; 85 min invitations add a third scenario)', '2. First round: two case interviews plus Personal Experience Interview (about 45 min each)', '3. Final round: two or three partner interviews'],
    timeLimits: 'Sea Wolf about 30–35 min, Redrock about 35 min',
    sources: [gap('/employers/mckinsey-solve', 'McKinsey Solve guide')],
    confidence: 'medium',
    notes: 'Solve is McKinsey-built; scenarios rotate. Agisse simulates the two current core scenarios.',
  },
  {
    ...base,
    company: 'BCG',
    aliases: ['boston consulting group'],
    rolePattern: null,
    provider: 'pymetrics',
    assessmentTypes: ['game-based', 'video interview'],
    tests: PYMETRICS_ALL,
    stages: ['1. Online test (varies by office): pymetrics games or the Casey online case (25–35 min, ends with a 60 s recorded recommendation)', '2. One-way video interview in some channels', '3. Two case and fit rounds'],
    timeLimits: 'pymetrics: about 25 min, 48 h window',
    sources: [gap('/pymetrics/bcg', 'BCG pymetrics guide')],
    confidence: 'medium',
    notes: 'BCG moved many offices from pymetrics to Casey; check your invitation.',
    interview: { prepSec: 60, answerSec: 60, retakes: 0, questions: 1 },
  },
  {
    ...base,
    company: 'Bain',
    aliases: ['bain & company'],
    unless: ['bain capital'],
    rolePattern: null,
    provider: 'sova',
    assessmentTypes: ['numerical', 'verbal', 'logical', 'situational judgement', 'video interview'],
    tests: ids('sova', ['numerical', 'verbal', 'logical', 'sjt']),
    stages: ['1. Online test: Sova numerical, verbal, logical and situational items (Europe, London) or TestGorilla (Amsterdam, some US), 30–40 min', '2. HireVue pre-screen reported in South-East Asia (3 questions)', '3. Case interview rounds'],
    timeLimits: '30–40 min',
    sources: [gap('/pymetrics/bain', 'Bain online test guide')],
    confidence: 'medium',
    notes: 'Older German reports mention pymetrics.',
    interview: { prepSec: 30, answerSec: 120, retakes: 1, questions: 3 },
  },
  {
    ...base,
    company: 'JPMorgan',
    aliases: ['jp morgan', 'j.p. morgan', 'jpmorgan chase'],
    rolePattern: null,
    provider: 'hirevue',
    assessmentTypes: ['video interview', 'game-based'],
    tests: PYMETRICS_ALL,
    stages: ['1. pymetrics games (used about 2019–2024; recent candidates report video only)', '2. HireVue video interview: 3–5 questions, 30 s prep, 2 min answers', '3. Superday'],
    timeLimits: 'HireVue: 30 s prep, 2 min per answer',
    sources: [gap('/pymetrics/jpmorgan', 'JPMorgan assessment guide')],
    confidence: 'medium',
    notes: null,
    interview: { prepSec: 30, answerSec: 120, retakes: 0, questions: 4 },
  },
  {
    ...base,
    company: 'Goldman Sachs',
    rolePattern: null,
    provider: 'hirevue',
    assessmentTypes: ['video interview'],
    tests: [],
    stages: ['1. HireVue video interview: 3–6 questions, 30 s prep, up to 2 min answers (engineers: HackerRank first)', '2. Superday: 2–5 interviews'],
    timeLimits: 'About 30 min in total',
    sources: [gap('/employers/goldman-sachs', 'Goldman Sachs process guide')],
    confidence: 'medium',
    notes: 'No game stage.',
    interview: { prepSec: 30, answerSec: 120, retakes: 0, questions: 5 },
  },
  {
    ...base,
    company: 'Morgan Stanley',
    rolePattern: null,
    location: null,
    provider: 'aon',
    assessmentTypes: ['numerical', 'logical', 'situational judgement', 'game-based', 'video interview'],
    tests: ['aon-scales-numerical', 'aon-switch-challenge'],
    stages: ['1. Aon battery (EMEA, reported): scales numerical, deductive, chat-based situational test, switchChallenge', '2. HireVue: 3–5 questions, 30 s prep, 1.5 min answers', '3. Superday or assessment centre'],
    timeLimits: 'switchChallenge 6 min',
    sources: [gap('/employers/morgan-stanley', 'Morgan Stanley process guide')],
    confidence: 'low',
    notes: null,
    interview: { prepSec: 30, answerSec: 90, retakes: 0, questions: 4 },
  },
  {
    ...base,
    company: 'Deloitte',
    rolePattern: null,
    provider: 'hirevue',
    assessmentTypes: ['situational judgement', 'numerical', 'logical', 'video interview'],
    tests: [],
    stages: ['1. UK: Immersive Online Assessment (situational judgement plus reasoning)', '2. Job Simulation or HireVue (Canada official): 6–12 questions, 30–60 s prep, 1–3 min answers, often 2 attempts', '3. Final: group discussion plus about 50 min interview'],
    timeLimits: null,
    sources: [gap('/employers/deloitte', 'Deloitte process guide')],
    confidence: 'medium',
    notes: null,
    interview: { prepSec: 45, answerSec: 120, retakes: 1, questions: 6 },
  },
  {
    ...base,
    company: 'PwC',
    aliases: ['pricewaterhousecoopers'],
    rolePattern: null,
    provider: 'shl',
    assessmentTypes: ['personality', 'numerical', 'logical', 'video interview'],
    tests: ids('shl', ['verify-numerical', 'verify-inductive', 'verify-deductive']),
    stages: ['1. SHL behavioural profile plus timed Verify Numerical Reasoning, Verify Inductive Reasoning and Verify Deductive Reasoning', '2. SHL on-demand video interview', '3. Virtual assessment centre, then senior-leader interview'],
    timeLimits: null,
    sources: [gap('/employers/pwc', 'PwC process guide')],
    confidence: 'medium',
    notes: 'UK process.',
    interview: { prepSec: 30, answerSec: 120, retakes: 0, questions: 5 },
  },
  {
    ...base,
    company: 'EY',
    aliases: ['ernst & young', 'ernst and young'],
    rolePattern: null,
    provider: 'shl',
    assessmentTypes: ['situational judgement', 'personality'],
    tests: [],
    stages: ['1. SHL realistic job preview plus behavioural test', '2. Experience Day'],
    timeLimits: null,
    sources: [gap('/employers/ey', 'EY process guide')],
    confidence: 'low',
    notes: 'UK process.',
  },
  {
    ...base,
    company: 'KPMG',
    rolePattern: null,
    provider: null,
    assessmentTypes: ['situational judgement', 'numerical', 'logical', 'video interview'],
    tests: [],
    stages: ['1. Untimed skills test (about 20 min) plus timed cognitive test (36 min)', '2. Video interview with an AI avatar: 6 questions, about 40 min', '3. Launch Pad half-day'],
    timeLimits: 'Cognitive test 36 min',
    sources: [gap('/employers/kpmg', 'KPMG process guide')],
    confidence: 'low',
    notes: 'UK process.',
    interview: { prepSec: 30, answerSec: 120, retakes: 0, questions: 6 },
  },
  {
    ...base,
    company: 'Accenture',
    rolePattern: null,
    provider: null,
    assessmentTypes: ['situational judgement', 'game-based', 'coding'],
    tests: [],
    stages: ['1. UK: Discovery Portal, untimed, 60–90 min. India: about 40 min with gamified puzzles. Tech roles: HackerRank', '2. Task-based and strengths interviews'],
    timeLimits: null,
    sources: [gap('/employers/accenture', 'Accenture process guide')],
    confidence: 'low',
    notes: 'Puzzle vendor unknown.',
  },
  {
    ...base,
    company: 'Unilever',
    rolePattern: null,
    provider: 'hirevue',
    assessmentTypes: ['game-based', 'video interview'],
    tests: ids('hirevue', ['numerosity', 'flashback', 'digitspan', 'disconumbers', 'shapedance', 'singularity', 'e-motions', 'pulse']),
    stages: ['1. Games (historically pymetrics; HireVue games reported since): pick of Numerosity, Flashback, Digitspan, Disconumbers, Shapedance, Singularity, E-Motions, Pulse', '2. HireVue video interview', '3. Discovery Centre (UFLP)'],
    timeLimits: 'Games 15–25 min in total',
    sources: [gap('/employers/unilever', 'Unilever process guide'), gap('/hirevue', 'HireVue games guide')],
    confidence: 'low',
    notes: 'Games and video can come as separate invitations.',
    interview: { prepSec: 30, answerSec: 120, retakes: 1, questions: 5 },
  },
  {
    ...base,
    company: 'Siemens',
    rolePattern: null,
    provider: null,
    assessmentTypes: ['game-based'],
    tests: [],
    stages: ['1. Game-based behavioural assessment (vendor not named)', '2. Video interview (conditional)', '3. Assessment centre'],
    timeLimits: null,
    sources: [gap('/employers/siemens', 'Siemens process guide')],
    confidence: 'low',
    notes: null,
  },
  {
    ...base,
    company: 'Amazon',
    rolePattern: null,
    provider: null,
    assessmentTypes: ['personality', 'situational judgement', 'coding'],
    tests: [],
    stages: ['1. Work Style Assessment plus Work Sample Simulation (and coding for tech roles)', '2. Phone screen', '3. Interview loop with a Bar Raiser'],
    timeLimits: null,
    sources: [gap('/employers/amazon', 'Amazon process guide')],
    confidence: 'medium',
    notes: 'UK apprenticeships add 3 recorded video questions.',
  },
  {
    ...base,
    company: 'ABN AMRO',
    rolePattern: null,
    provider: 'harver',
    assessmentTypes: ['logical', 'numerical'],
    tests: [],
    stages: ['1. Harver (NOA) cognitive test: analogies, exclusion, number series', '2. Interviews'],
    timeLimits: null,
    sources: [{ url: 'https://www.testprep.nl/en/guide/company-abn-amro-assessment-provider-harver-noa-assessment-practice-explained', title: 'ABN AMRO assessment guide', kind: 'candidate report' }],
    confidence: 'low',
    notes: 'Some reports name Cubiks/Talogy instead.',
  },
]

export const CURATED_ASSESSMENTS: CuratedAssessment[] = ROWS.map((c) => ({ ...c, gameTypes: [...new Set(c.tests.map((id) => providerGame(id)!.gameId))] }))

/** Lower case, no accents, "&" as "and", punctuation as spaces, padded: " j p morgan chase and co ". */
const norm = (s: string) => ` ${s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `
const has = (name: string, words: string) => name.includes(norm(words))
/** The curated rows for a company name: the name or an alias appears as whole words ("JPMorgan Chase & Co." → JPMorgan). */
export function curatedFor(company: string): CuratedAssessment[] {
  const name = norm(company)
  return CURATED_ASSESSMENTS.filter((c) => [c.company, ...(c.aliases ?? [])].some((n) => has(name, n)) && !c.unless?.some((n) => has(name, n)))
}

/** The real tests a firm's online stage is made of, in catalogue order. */
export const testsFor = (c: CuratedAssessment) => c.tests.map((id) => providerGame(id)!)
