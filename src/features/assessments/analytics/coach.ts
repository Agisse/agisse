// Post-game notes grounded only in what the session measured. No traits, no guesses about employer scores.
import type { GameId, GameResult } from '../../../../shared/assessments'
import { MAX_LEVEL, median } from '../engine/session'

/** Rates may arrive as 0–1 or 0–100. */
const pct = (v: number) => `${Math.round(v <= 1 ? v * 100 : v)}%`
const num = (d: Record<string, number>, k: string) => (typeof d[k] === 'number' && Number.isFinite(d[k]) ? d[k] : null)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function detailNote(gameId: GameId, d: Record<string, number>): string | null {
  switch (gameId) {
    case 'task-switching': {
      const cost = num(d, 'switchCostMs')
      const sw = num(d, 'switchAccuracy')
      const rep = num(d, 'repeatAccuracy')
      const acc = sw !== null && rep !== null ? `accuracy was ${pct(sw)} on switches and ${pct(rep)} on repeats` : null
      if (cost !== null) return `Changing rules added about ${Math.round(cost)} ms per answer${acc ? `, and ${acc}` : ''}.`
      return acc ? `In this session, ${acc}.` : null
    }
    case 'go-no-go': {
      const fp = num(d, 'falsePositives')
      const miss = num(d, 'misses')
      const rt = num(d, 'meanGoRt')
      if (fp === null && miss === null) return null
      const parts = [fp !== null && `responded to ${plural(fp, 'no-go item')}`, miss !== null && `missed ${plural(miss, 'go item')}`].filter(Boolean).join(' and ')
      return `You ${parts}${rt !== null ? `; your average go response was ${Math.round(rt)} ms` : ''}.`
    }
    case 'n-back': {
      const hits = num(d, 'hits')
      const fa = num(d, 'falseAlarms')
      if (hits === null) return null
      return `You caught ${plural(hits, 'match', 'matches')}${fa !== null ? ` with ${plural(fa, 'false alarm')}` : ''}.`
    }
    case 'risk-reward': {
      const low = num(d, 'lowVarianceRate')
      const ev = num(d, 'evRate')
      if (low !== null) return `In this session, you picked the lower-variance option in ${pct(low)} of choices${ev !== null ? ` and the higher expected-value option in ${pct(ev)}` : ''}.`
      return ev !== null ? `In this session, you picked the higher expected-value option in ${pct(ev)} of choices.` : null
    }
    case 'attention-tracking': {
      const hit = num(d, 'meanHitRate')
      return hit !== null ? `You tracked ${pct(hit)} of targets on average.` : null
    }
    default:
      return TIPS[gameId]?.((k) => num(d, k)) ?? null
  }
}

type Get = (k: string) => number | null
const lt = (v: number | null, x: number) => v !== null && v < x
const gt = (v: number | null, x: number) => v !== null && v > x

/** Provider-game notes: what a measure says and what to try next. One note, the most telling, per session. */
const TIPS: Partial<Record<GameId, (g: Get) => string | null>> = {
  balloons: (g) => {
    const pop = g('popRate')
    const adapt = g('adaptation')
    if (gt(pop, 0.4)) return `${pct(pop!)} of balloons popped: you pushed too far. Each colour's best stop is about half of where it tends to pop.`
    if (lt(pop, 0.1)) return `Only ${pct(pop!)} popped: you are cashing in early. Push each colour a little further until you see where it pops.`
    if (adapt !== null && adapt <= 0) return 'Your pumping did not move toward each colour\'s best stop. Notice where each colour pops and adjust per colour.'
    return null
  },
  cards: (g) => {
    const late = g('lateGoodDeckRate')
    if (late === null) return null
    return late < 0.6 ? `Late in the game you drew from the steady decks ${pct(late)} of the time. Track your net per deck and stop chasing the big wins.` : `You settled on the steady decks (${pct(late)} late in the game): that is the learning the task looks for.`
  },
  'easy-hard': (g) => {
    const [lo, hi, done] = [g('hardRate12'), g('hardRate88'), g('hardCompletionRate')]
    if (gt(g('hardRate'), 0) && lt(done, 0.7)) return `You finished ${pct(done!)} of the hard tasks you chose. Only take hard when you can keep up about 5 presses a second.`
    if (lo !== null && hi !== null && hi - lo < 0.15) return 'You chose hard about as often at 12% as at 88%. Let the shown probability drive the choice.'
    return null
  },
  keypresses: (g) => {
    const [pps, early, late] = [g('pressesPerSecond'), g('earlyPresses'), g('latePresses')]
    if (gt(early, 0)) return `${plural(early!, 'press')} came before GO. Wait for the signal.`
    if (gt(late, 0)) return `${plural(late!, 'press')} came after STOP. Stop cleanly the moment it shows.`
    return pps !== null ? `${pps.toFixed(1)} presses a second; around 6 is fast.` : null
  },
  flanker: (g) => {
    const [cost, sw, nogo] = [g('congruencyCostMs'), g('ruleSwitchErrors'), g('noGoErrors')]
    if (gt(nogo, 1)) return `You pressed on ${plural(nogo!, 'X trial')}. Slow down just enough to spot the X's.`
    if (gt(sw, 2)) return `${plural(sw!, 'error')} came right after the colour rule changed. Check the colour before the arrows.`
    if (gt(cost, 100)) return `The side arrows slowed you by about ${Math.round(cost!)} ms. Keep your eyes fixed on the centre.`
    return null
  },
  lengths: (g) => {
    const [bias, acc] = [g('responseBias'), g('accuracy')]
    if (lt(acc, 0.6)) return 'Accuracy near chance: the flash is being missed. Fix your eyes where the mouth appears before it flashes.'
    if (gt(bias, 0.1)) return 'Rewards pulled your answers toward one length. That is normal, but answer what you saw.'
    return null
  },
  towers: (g) => {
    const [extra, plan] = [g('avgExcessMoves'), g('avgPlanningMs')]
    if (gt(extra, 1) && lt(plan, 4000)) return `About ${extra!.toFixed(1)} extra moves per puzzle after short planning. Spend a few seconds working back from the target first.`
    return gt(extra, 1) ? `About ${extra!.toFixed(1)} moves over the minimum per puzzle. Plan the whole sequence before the first move.` : null
  },
  'money-exchange': (g) => {
    const sent = g('avgSent')
    return `${sent !== null ? `You sent $${sent.toFixed(1)} of $10 on average. ` : ''}There is no better answer here; answer consistently with how you would act.`
  },
  'security-dial': (g) => {
    const [hit, err, skips] = [g('hitRate'), g('meanErrorDeg'), g('skips')]
    if (lt(hit, 0.6) && gt(err, 10)) return `You missed by about ${Math.round(err!)}° on average. Start pressing as the pointer approaches the digit, not when it arrives.`
    return gt(skips, 2) ? 'You skipped several locks. Retry the early ones; only the last stages are meant to be near-impossible.' : null
  },
  predict: (g) => {
    const late = g('lateOptimalRate')
    if (late === null) return null
    return late < 0.6 ? 'You matched outcomes instead of learning the cards. Always forecast the more likely weather for each pattern, even though it is sometimes wrong.' : `In the second half you chose the better forecast ${pct(late)} of the time.`
  },
  'team-sales': (g) => {
    const [coop, ret, forg] = [g('cooperationRate'), g('retaliationRate'), g('forgivenessRate')]
    if (lt(coop, 0.5)) return `You priced High ${pct(coop!)} of the time. Mutual High pays most over the rounds; keep it by default.`
    if (gt(ret, 0.7)) return 'You punished single undercuts that may have been noise. Respond only after two in a row.'
    if (lt(forg, 0.5)) return 'You stayed Low after the rival returned to High. Go back to High as soon as they do.'
    return null
  },
  balance: (g) => (lt(g('accuracy'), 0.7) ? 'Pin one shape at weight 1, work out the others from the reference scales one at a time, then add up the target pan.' : null),
  order: (g) => {
    const [acc, multi] = [g('accuracy'), g('multiRuleAccuracy')]
    return acc !== null && multi !== null && multi < acc - 0.15 ? 'Items with three or more changing features broke down. Settle each feature (shape, colour, size, turn, position) one at a time.' : null
  },
  'token-search': (g) => {
    const [within, between] = [g('withinErrors'), g('betweenErrors')]
    if (gt(between, within ?? 0)) return `${plural(between!, 'error')} reopened boxes that already gave a token. Use a fixed route and skip boxes that paid out.`
    return gt(within, 0) ? `${plural(within!, 'error')} reopened a box within the same search. Keep a fixed route, e.g. left to right, top to bottom.` : null
  },
  disconumbers: (g) => {
    const [order, sum] = [g('orderRate'), g('sumRate')]
    if (order !== null && sum !== null && order < sum - 0.15) return 'You kept the numbers but lost the order. Name the positions under your breath as they light.'
    if (order !== null && sum !== null && sum < order - 0.15) return 'You kept the order but missed sums. Keep a running total as each circle lights.'
    return null
  },
  pathfinder: (g) => {
    const [extra, skips] = [g('meanExtraSwaps'), g('skips')]
    if (gt(extra, 1)) return `About ${extra!.toFixed(1)} swaps over par: trace the route from the start and fix the first broken tile before swapping.`
    return gt(skips, 2) ? 'Several skips: practise at a lower level until you reach par.' : null
  },
  'image-puzzle': (g) => {
    const [extra, turned, upright] = [g('meanExtraSwaps'), g('turnedRate'), g('uprightRate')]
    if (turned !== null && upright !== null && turned < upright - 0.2) return 'Turned patterns are the weak spot. Rotate one row at a time: for 90° clockwise the top row becomes the right column.'
    return gt(extra, 2) ? 'While the picture shows, memorise anchors such as corners and strong colour edges, and place those first.' : null
  },
  'shape-match': (g) => {
    const rates = (['colourRate', 'rotationRate', 'detailRate'] as const).map((k) => [k, g(k)] as const).filter(([, v]) => v !== null)
    const worst = rates.sort((a, b) => a[1]! - b[1]!)[0]
    if (gt(g('falseAlarms'), 2)) return 'Several wrong picks: check rotation and small details before selecting.'
    if (gt(g('missed'), 2)) return 'You stopped scanning early. Sweep row by row to the end.'
    return worst && worst[1]! < 0.75 ? `Differences in ${worst[0].replace('Rate', '')} were missed most; scan for that first.` : null
  },
  emotions: (g) => (gt(g('timeouts'), 2) ? 'Several answers timed out. Read the eyes and brows first instead of the whole face.' : null),
  'grid-challenge': (g) => {
    const [recall, side] = [g('recallAccuracy'), g('distractorAccuracy')]
    if (recall !== null && side !== null && recall < side - 0.15) return 'The side task is crowding out the dots. Rehearse the dot path as a shape and answer the side question quickly.'
    if (recall !== null && side !== null && side < recall - 0.15) return 'You traded the side judgements for the dots; both are scored. Give each judgement a real look.'
    return null
  },
  'switch-challenge': (g) => {
    const [single, chain] = [g('singleAccuracy'), g('chainAccuracy')]
    return single !== null && chain !== null && chain < single - 0.15 ? 'Chained switches are the weak spot. Work out the middle row from the known switch first, then find the missing one.' : null
  },
  'digit-challenge': (g) => (lt(g('fourBlankAccuracy'), 0.6) ? 'Longer equations break down. Fix the × or ÷ part first, then adjust with + or −. Any valid answer counts.' : null),
  'motion-challenge': (g) => {
    if (gt(g('skipRate'), 0.2)) return 'You skipped often. Every puzzle is solvable, and a few extra moves beat a skip.'
    return gt(g('meanExtra'), 1) ? 'Trace the route first and only move the blocks that sit on it.' : null
  },
  'gap-challenge': (g) => (lt(g('deductionAccuracy'), 0.7) ? 'When the ? cannot be read off its row and column, fill a row or column with one shape missing first and work from there.' : null),
  'grid-lock': (g) => (gt(g('turnsPerPiece'), 3) ? 'Lots of turning: place the largest or most awkward piece first, in a corner, and fit the rest around it.' : null),
  numbubbles: (g) => (lt(g('popAccuracy'), 0.8) ? 'Wrong pops reset your streak. One sure pop is worth more than two guesses.' : null),
  'proof-it': (g) => {
    if (lt(g('precision'), 0.7)) return 'Guess-clicks cost you: three wrong clicks end a document.'
    if (lt(g('factHitRate'), 0.6)) return 'Names, numbers and dates slipped through. Read the reference table first, then check each fact.'
    return lt(g('typoHitRate'), 0.6) ? 'Typos slipped through: look at the middle letters of long words.' : null
  },
  'tally-up': (g) => {
    const [plain, mod] = [g('plainAccuracy'), g('modifierAccuracy')]
    if (plain !== null && mod !== null && mod < plain - 0.15) return 'Modifier tokens trip you up. Update each side\'s total the moment a ×2 or − token appears.'
    return gt(g('timeouts'), 2) ? 'Keep a running number per side instead of recounting at the end.' : null
  },
  'sea-wolf': (g) => {
    if (lt(g('validRate'), 0.67)) return 'Some final sets fell outside the ranges. Sum each attribute over the three and check it lies between 3× the low and 3× the high bound.'
    return lt(g('scoreRatio'), 0.9) ? 'Valid sets, but not the best. Drop every microbe with the avoided trait first, then shortlist by uptake.' : null
  },
  redrock: (g) => {
    if (lt(g('journalRecall'), 0.8)) return 'You missed figures the brief needed. Read the questions first and collect exactly their inputs.'
    if (lt(g('analysisAcc'), 0.7)) return 'Calculation slips: write the formula before using the calculator and round only at the end.'
    if (lt(g('reportAcc'), 0.7)) return 'Bar compares, line shows a trend, pie shows shares, scatter shows a relationship.'
    return lt(g('miniCaseAcc'), 0.7) ? 'Drill percentage change, share of total and ratios for the mini-cases.' : null
  },
}

export function coachNotes(result: GameResult, gameId: GameId, previous: GameResult[] = []): string[] {
  if (!result.trials) return ['No answers were recorded in this session.']
  const notes = [`Accuracy was ${pct(result.accuracy)} over ${plural(result.trials, 'item')}, reaching level ${result.difficultyReached} of ${MAX_LEVEL}.`]
  const detail = detailNote(gameId, result.details)
  if (detail) notes.push(detail)
  const prevRt = median(previous.map((r) => r.medianResponseTime).filter((x) => x > 0))
  const rt = result.medianResponseTime
  if (rt > 0 && prevRt > 0) {
    const cmp = rt < prevRt * 0.95 ? 'faster than' : rt > prevRt * 1.05 ? 'slower than' : 'about the same as'
    notes.push(`Your median correct response took ${rt} ms, ${cmp} your earlier sessions (${Math.round(prevRt)} ms).`)
  } else if (rt > 0) {
    notes.push(`Your median correct response took ${rt} ms; later sessions will compare against it.`)
  }
  return notes.slice(0, 3)
}
