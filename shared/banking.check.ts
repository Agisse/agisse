// Run: npx tsx shared/banking.check.ts
import { lboClose, paperLbo, pitchSeconds, solveLbo } from './banking.ts'

const fail = (m: string): never => {
  throw new Error(m)
}
const near = (a: number, b: number, m: string) => void (Math.abs(a - b) < 1e-6 || fail(`${m}: ${a} != ${b}`))

// 100 EBITDA at 8× = 800; 60% debt = 480, equity 320. Exit 150 × 8 = 1200, debt 480 − 100 = 380, equity 820: 2.5625×.
const a = solveLbo({ ebitda: 100, entry: 8, debtPct: 60, exitEbitda: 150, repaid: 100, exit: 8, years: 5 })
near(a.equity, 320, 'equity')
near(a.exitEquity, 820, 'exit equity')
near(a.mom, 2.5625, 'mom')
near(a.irr, (2.5625 ** 0.2 - 1) * 100, 'irr')
const ok = lboClose(a, 2.5, 20)
if (!ok.mom || !ok.irr) fail('rule-of-thumb answer should pass')
if (lboClose(a, 2.3, 15).irr) fail('15% is too far from 20.7%')

for (let s = 1; s < 500; s++) {
  const d = paperLbo(s)
  const x = solveLbo(d)
  if (!(x.exitDebt >= 0 && x.exitEquity > 0 && x.mom > 1)) fail(`seed ${s} gives an unsolvable deal`)
  if (JSON.stringify(paperLbo(s)) !== JSON.stringify(d)) fail('same seed, same deal')
}

if (pitchSeconds('word '.repeat(225)) !== 90) fail('225 words ≈ 90 s')
console.log('banking ok')
