import type { GameId, TrainingMode } from '../../../../shared/assessments'

/** What the pre-game screen tells the player, per game. Keys come from each game's own `.game__keys` line; variants (provider games) may differ slightly. */
export type Guide = {
  /** One short phrase: what the game measures. */
  measures: string
  /** Keyboard line. */
  keys: string
  /** Touch / click line. */
  touch: string
  /** false = a preference game with no right answer. */
  scored?: boolean
}

const tap = 'Tap the answer'
const g = (measures: string, keys: string, touch = tap): Guide => ({ measures, keys, touch })

const GUIDE: Partial<Record<GameId, Guide>> = {
  'numerical-speed': g('Quick mental arithmetic', '1 or left arrow for the left value, 2 or right arrow for the right; type answers and press Enter', 'Tap a value, or type on the keypad'),
  'working-memory': g('Holding items in order', 'Type the sequence, then Enter; Backspace removes the last', 'Tap the items in the same order'),
  'n-back': g('Updating what you hold in mind', 'F or left arrow for no match, J or right arrow for match', 'Tap Match or No match'),
  'go-no-go': g('Reacting fast, and holding back', 'Space on green; nothing on red', 'Tap on green; do nothing on red'),
  'task-switching': g('Switching between rules', 'F or left arrow, J or right arrow (or Q and P)', 'Tap the left or right answer'),
  'sequence-reasoning': g('Spotting a pattern in a sequence', '1 to 4 to answer, or arrows then Enter'),
  'spatial-memory': g('Remembering where things were', 'Arrows to move, Space or Enter to tap a tile', 'Tap the squares that lit up'),
  'risk-reward': g('Weighing chance against payoff', '1 or left arrow for A, 2 or right arrow for B', 'Tap option A or B'),
  'attention-tracking': g('Following moving objects', 'Arrows to move, Space to select, Enter when done', 'Tap the circles you followed'),
  estimation: g('Judging quantities at a glance', '1 to 4 to answer, or arrows then Enter'),
  numerosity: g('Combining numbers to a target', 'Letter keys toggle a tile, Enter submits, Backspace clears', 'Tap the tiles, then Submit'),
  disconumbers: g('Remembering numbered circles', 'Letter keys tap a circle, 1 to 4 pick the sum', 'Tap the circles in order, then the sum'),
  pathfinder: g('Planning a route', 'Arrows to move, Space or Enter to pick and swap, Esc to cancel', 'Tap a tile, then another to swap'),
  'image-puzzle': g('Visual puzzles and patterns', 'Arrows to move, Space or Enter to pick and swap, Esc to cancel', 'Tap a piece, then another to swap'),
  'shape-match': g('Spotting differences in shapes', 'Arrows to move, Space to select, Enter to submit', 'Tap the figures'),
  emotions: g('Reading emotions', 'Number keys pick an answer', 'Tap the emotion'),
  balloons: g('How you handle risk', 'Space to pump, Enter to collect', 'Tap Pump or Collect'),
  cards: g('Learning from wins and losses', '1 to 4 pick a deck', 'Tap a deck'),
  'easy-hard': g('Effort versus reward', 'Left arrow easy, right arrow hard, then Space to press', 'Tap Easy or Hard, then tap to press'),
  keypresses: g('Steady, fast tapping', 'Space', 'Tap the pad'),
  flanker: g('Focus despite distraction', 'Left and right arrows (or Q and P)', 'Tap left or right'),
  lengths: g('Quick perception', 'Left arrow or S for short, right arrow or L for long', 'Tap Short or Long'),
  towers: g('Planning ahead', '1 to 3 lift or drop on a peg, Esc puts the disc back', 'Tap a peg to lift, then a peg to drop'),
  'money-exchange': { measures: 'How you share and judge fairness', keys: 'Left and right arrows to adjust, Enter to confirm', touch: 'Drag the slider, then tap Confirm', scored: false },
  'security-dial': g('Timing and precision', 'Space to stop the pointer, S to skip', 'Tap the dial to stop it'),
  predict: g('Learning from outcomes', 'S or left arrow for sun, R or right arrow for rain', 'Tap Sun or Rain'),
  'team-sales': g('Decisions against a rival', '1 or left arrow for High, 2 or right arrow for Low', 'Tap High or Low'),
  balance: g('Logical reasoning with weights', '1 to 9 add a shape, Backspace removes, Enter checks', 'Tap shapes to add, then Check'),
  order: g('Finding the rule in a series', '1 to 5 to answer, or arrows then Enter'),
  'token-search': g('Planning a search', '1 to 9 open a box', 'Tap a box to open it'),
  'grid-challenge': g('Memory while multitasking', 'F or left arrow, J or right arrow; arrows and Space to recall', 'Tap the answer, then the dots in order'),
  'switch-challenge': g('Mental rule-following', '1 to 3 to answer'),
  'digit-challenge': g('Number puzzles', 'Digits fill a blank, Backspace clears, Enter checks', 'Tap digits, then Check'),
  'motion-challenge': g('Planning moves', 'Arrows move, N next piece, S skip', 'Tap a piece, then a square next to it'),
  'gap-challenge': g('Finding the missing shape', 'Number keys to answer'),
  'grid-lock': g('Fitting shapes together', 'Number keys pick, R turns, arrows move, Enter places', 'Tap a piece, then a spot'),
  numbubbles: g('Fast mental sums', 'Press the bubble number', 'Tap the right bubbles'),
  'proof-it': g('Checking details', 'Tab or arrows to move between words, Enter to mark', 'Tap each mistake'),
  'tally-up': g('Keeping running totals', 'F or left arrow, J or right arrow', 'Tap the bigger side'),
  'sea-wolf': g('Choosing under constraints', 'Tab and Enter', 'Tap to shortlist and release'),
  redrock: g('Working through a business case', 'Tab and Enter', 'Tap to collect figures and answer'),
  'numerical-data': g('Reading tables and charts', '1 to 5 to answer', 'Tap the answer'),
  'verbal-tfc': g('Reading carefully', '1 to 3 or A to C to answer, Enter for next', 'Tap True, False or Cannot say'),
  sjt: g('Workplace judgement', 'Tab to move, Space to select, Enter to submit', 'Tap or drag your ratings'),
  'critical-reasoning': g('Judging claims from a passage', '1 to 5 or A to E to answer, Enter for next', 'Tap the answer'),
  diagrammatic: g('Following rules in diagrams', '1 to 5 or A to E to answer, Enter for next', 'Tap the answer'),
}

const FALLBACK: Guide = { measures: 'Accuracy and speed', keys: 'Tab and Enter, or the keys shown under the game', touch: 'Tap the answer' }

/** Provider variants whose controls differ from the drill's, keyed `gameId:variant`. */
const VARIANT_GUIDE: Record<string, Partial<Guide>> = {
  'balloons:arctic': { keys: 'P to pump, Q to collect' },
  'go-no-go:stop': { keys: 'Space on red; nothing on green', touch: 'Tap on red; do nothing on green' },
  'go-no-go:pulse': { keys: 'Space only when the object has a red dot', touch: 'Tap only when the object has a red dot' },
}

export const guideOf = (id: GameId, variant?: string): Guide => ({ ...(GUIDE[id] ?? FALLBACK), ...(variant ? VARIANT_GUIDE[`${id}:${variant}`] : undefined) })

/** Games that run their own stimulus timers: pausing the runner clock alone would still score misses behind the sheet, so they offer End but no Pause. */
// ponytail: no Pause for self-timed games; pass GameProps.paused into their timers to offer it.
const SELF_TIMED = new Set<GameId>(['go-no-go', 'flanker', 'lengths', 'keypresses', 'security-dial', 'easy-hard', 'n-back', 'working-memory', 'spatial-memory', 'disconumbers', 'tally-up', 'grid-challenge', 'attention-tracking', 'numbubbles', 'balloons', 'cards', 'predict', 'task-switching', 'risk-reward', 'image-puzzle', 'estimation'])

export const canPause = (id: GameId, mode: TrainingMode, seconds: number | null) => mode !== 'simulation' && seconds !== null && !SELF_TIMED.has(id)
