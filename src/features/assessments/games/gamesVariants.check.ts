// Run: npx tsx src/features/assessments/games/gamesVariants.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const nb = await import('./NBack')
const gn = await import('./GoNoGo')
const wm = await import('./WorkingMemory')
const sm = await import('./SpatialMemory')
const ts = await import('./TaskSwitching')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })

// Flashback: N rises with progress, colour joins at 3-back, ~30% matches, lures only at the colour level.
ok(nb.flashN(0) === 1 && nb.flashN(11) === 1 && nb.flashN(12) === 2 && nb.flashN(29) === 2 && nb.flashN(30) === 3, 'flash N')
ok(!nb.colourRule(2) && nb.colourRule(3), 'colour rule')
ok(nb.flashWindowMs(1) > nb.flashWindowMs(10) && nb.flashWindowMs(10) >= 1400, 'flash window')
for (const n of [1, 2, 3]) {
  const h: { s: number; c: number }[] = []
  let matches = 0
  let lures = 0
  for (let i = 0; i < 3000; i++) {
    const f = nb.nextFlash(h, n, rand)
    ok(f.s >= 0 && f.s < nb.FLASH_SHAPES.length && f.c >= 0 && f.c < 3, 'flash range')
    h.push(f)
    if (nb.isFlashMatch(h, n)) matches++
    else if (h.length > n && h[h.length - 1 - n]!.s === f.s) lures++
  }
  const share = matches / (3000 - n)
  ok(share > 0.25 && share < 0.35, `flash n=${n} match share ${share}`)
  ok(n === 3 ? lures > 300 : lures === 0, `flash n=${n} lures ${lures}`)
}
ok(nb.isFlashMatch([{ s: 1, c: 0 }, { s: 1, c: 2 }], 1) && !nb.isFlashMatch([{ s: 1, c: 0 }, { s: 2, c: 0 }], 1), 'shape match')
ok(!nb.isFlashMatch([{ s: 1, c: 0 }, { s: 0, c: 0 }, { s: 0, c: 0 }, { s: 1, c: 2 }], 3), 'colour lure is no match at 3-back')
ok(nb.isFlashMatch([{ s: 1, c: 2 }, { s: 0, c: 0 }, { s: 0, c: 0 }, { s: 1, c: 2 }], 3), 'shape+colour match at 3-back')
const fd = nb.nBackDetails([t(true, 'match'), t(false, 'nonmatch'), t(false, 'slow'), t(false, 'slow')])
ok(fd.hits === 1 && fd.falseAlarms === 1 && fd.tooSlow === 2, `flash details ${JSON.stringify(fd)}`)
ok(!('tooSlow' in nb.nBackDetails([t(true, 'match')])), 'no tooSlow for letter n-back')

// Pulse / Stop: go shares, adaptive pace stays in bounds.
const share = (v: string) => Array.from({ length: 4000 }, () => gn.variantStimulus(v, rand)).filter((k) => k === 'go').length / 4000
const ps = share('pulse')
const ss = share('stop')
ok(ps > 0.27 && ps < 0.33, `pulse go share ${ps}`)
ok(ss > 0.72 && ss < 0.78, `stop go share ${ss}`)
ok(gn.pulsePace(1000, true) === 920 && gn.pulsePace(1000, false) === 1150, 'pulse pace step')
let pace = 1000
for (let i = 0; i < 100; i++) pace = gn.pulsePace(pace, true)
ok(pace === 400, `pulse pace floor ${pace}`)
for (let i = 0; i < 100; i++) pace = gn.pulsePace(pace, false)
ok(pace === 1400, `pulse pace ceiling ${pace}`)

// Digitspan / Digits: alphabet without look-alikes, no immediate repeats, reverse answers, ±1 length, details.
ok(!/[01IO]/.test(wm.SPAN_CHARS) && wm.SPAN_CHARS.length === 32, 'span alphabet')
for (let len = 2; len <= 12; len++) {
  for (const chars of [wm.SPAN_CHARS, wm.DIGIT_CHARS]) {
    const s = wm.makeSpan(len, chars, rand)
    ok(s.length === len && s.every((x, i) => chars.includes(x) && x !== s[i - 1]), `span ${len}`)
  }
}
ok(wm.spanAnswer(['A', '7', 'K'], false) === 'A7K' && wm.spanAnswer(['A', '7', 'K'], true) === 'K7A', 'span answer')
ok(wm.normalizeSpan(' a 7-k ') === 'A7K', 'normalize')
ok(wm.nextSpanLen(4, true) === 5 && wm.nextSpanLen(4, false) === 3 && wm.nextSpanLen(wm.MIN_SPAN, false) === wm.MIN_SPAN, 'span length')
ok(!wm.isReverse(0, () => 0) && !wm.isReverse(1, () => 0) && wm.isReverse(2, () => 0.1) && !wm.isReverse(2, () => 0.9), 'reverse rule')
const wd = wm.spanDetails([t(true, 'fwd:4'), t(true, 'fwd:5'), t(false, 'fwd:6'), t(true, 'rev:6'), t(false, 'rev:7')])
ok(wd.maxSpan === 6 && wd.forwardAccuracy === 0.667 && wd.backwardAccuracy === 0.5, `span details ${JSON.stringify(wd)}`)
ok(!('backwardAccuracy' in wm.spanDetails([t(true, 'fwd:3')])), 'digits: no backward accuracy')
ok(Object.keys(wm.spanDetails([{ correct: true, rt: 1, level: 1 }])).length === 0, 'plain sequence game: no details')

// Tiles: distinct targets, distractors never first or beside the same tile, exact order, details.
for (let len = 2; len <= sm.MAX_TILES; len++) {
  for (let i = 0; i < 100; i++) {
    const it = sm.makeTiles(len, rand)
    ok(it.seq.length === len && new Set(it.seq).size === len, 'tiles distinct')
    ok(it.stream.filter((s) => !s.distractor).map((s) => s.cell).join() === it.seq.join(), 'stream keeps target order')
    ok(it.stream.filter((s) => s.distractor).length === sm.distractorCount(len) && !it.stream[0]!.distractor, 'distractors')
    ok(it.stream.every((s, j) => s.cell >= 0 && s.cell < 16 && s.cell !== it.stream[j - 1]?.cell), 'no tile flashes twice in a row')
  }
}
ok(sm.isTilesCorrect([3, 1, 2], [3, 1, 2]) && !sm.isTilesCorrect([3, 1, 2], [1, 3, 2]) && !sm.isTilesCorrect([3, 1, 2], [3, 1]), 'tiles judge')
ok(sm.nextTilesLen(3, true) === 4 && sm.nextTilesLen(3, false) === 2 && sm.nextTilesLen(sm.MAX_TILES, true) === sm.MAX_TILES, 'tiles length')
ok(sm.tileMs(1) > sm.tileMs(10) && sm.tileMs(10) >= 450, 'tile pacing')
ok(sm.tilesDetails([t(true, 'tiles:3'), t(true, 'tiles:5'), t(false, 'tiles:6')]).maxSpan === 5, 'tiles details')
ok(Object.keys(sm.tilesDetails([{ correct: true, rt: 1, level: 1 }])).length === 0, 'pattern game: no details')

// Tickets: valid tickets, ~half switch, answer by half, 1.5 s in simulation.
let prevTop: boolean | null = null
let switches = 0
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 400; i++) {
    const tk = ts.makeTicket(prevTop, level, rand)
    ok(tk.num >= 1 && tk.num <= 9 && tk.num !== 5 && ts.TICKET_SHAPES.includes(tk.shape) && tk.level === level, 'ticket')
    ok(prevTop === null ? tk.kind === 'start' : tk.kind === (tk.top === prevTop ? 'repeat' : 'switch'), 'ticket kind')
    if (tk.kind === 'switch') switches++
    prevTop = tk.top
  }
}
ok(switches / 4000 > 0.45 && switches / 4000 < 0.55, `ticket switch share ${switches / 4000}`)
const tk = (num: number, shape: (typeof ts.TICKET_SHAPES)[number], top: boolean) => ({ num, shape, top, kind: 'repeat' as const, level: 1 })
ok(ts.ticketYes(tk(4, 'circle', true)) && !ts.ticketYes(tk(3, 'square', true)), 'top asks even')
ok(ts.ticketYes(tk(3, 'triangle', false)) && !ts.ticketYes(tk(4, 'oval', false)), 'bottom asks corners')
ok(!ts.isTicketCorrect(tk(4, 'circle', true), null), 'ticket timeout is wrong')
ok(ts.ticketMs(1, true) === 1500 && ts.ticketMs(10, true) === 1500 && ts.ticketMs(1, false) > ts.ticketMs(10, false), 'ticket pacing')

console.log('gamesVariants checks passed')
