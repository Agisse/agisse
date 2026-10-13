// Run: npx tsx src/features/assessments/components/gameGuide.check.ts
import { canPause, guideOf } from './gameGuide'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}

// Games whose own timers would score misses or burn study time behind the Paused sheet offer no Pause.
for (const id of ['task-switching', 'risk-reward', 'image-puzzle', 'estimation', 'go-no-go', 'n-back'] as const) ok(!canPause(id, 'drill', 60), `${id} not pausable`)
ok(canPause('numerical-speed', 'drill', 60) && canPause('proof-it', 'drill', 60), 'item-paced games pause')
ok(!canPause('numerical-speed', 'simulation', 60) && !canPause('numerical-speed', 'drill', null), 'no pause in simulation or untimed')

// The intro's controls match the variant being played.
ok(guideOf('balloons').keys.startsWith('Space') && guideOf('balloons', 'arctic').keys.startsWith('P to pump, Q'), 'balloons keys')
ok(guideOf('go-no-go', 'stop').keys.includes('on red') && guideOf('go-no-go', 'pulse').keys.includes('red dot') && guideOf('go-no-go').keys.includes('on green'), 'go/no-go keys')
ok(guideOf('money-exchange').scored === false && guideOf('balloons', 'arctic').measures === guideOf('balloons').measures, 'variant keeps the rest')

console.log('gameGuide ok')
