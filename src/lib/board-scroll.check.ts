// Run: npx tsx src/lib/board-scroll.check.ts
import { edgeSpeed, nearestIndex } from './board-scroll.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(edgeSpeed(500, 0, 1000), 0, 'middle stays put')
eq(edgeSpeed(0, 0, 1000), -18, 'at the left edge: full speed left')
eq(edgeSpeed(40, 0, 1000), -9, 'half into the left zone: half speed')
eq(edgeSpeed(1000, 0, 1000), 18, 'at the right edge: full speed right')
eq(edgeSpeed(1100, 0, 1000), 18, 'past the edge: capped')
eq(edgeSpeed(81, 0, 1000), 0, 'just outside the zone')
eq(edgeSpeed(50, 0, 100), 0, 'narrow board: zones shrink, middle stays put')

eq(nearestIndex([0, 284, 568, 852], 0), 0, 'at the start')
eq(nearestIndex([0, 284, 568, 852], 300), 1, 'just past column 2')
eq(nearestIndex([0, 284, 568, 852], 500), 2, 'closer to column 3')
eq(nearestIndex([0, 284, 568, 852], 600, true), 3, 'scrolled to the end: last column')
eq(nearestIndex([], 100), 0, 'no columns')

console.log('board-scroll ok')
