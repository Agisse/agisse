import { Play } from 'lucide-react'
import { GAMES } from '../games'
import type { GameId, TrainingMode } from '../../../../shared/assessments'
import { MODE_HINT, MODE_LABEL } from './modes'
import { canPause, guideOf } from './gameGuide'

export type IntroStep = {
  gameId: GameId
  seconds: number | null
  title?: string
  howTo?: string
  paced?: boolean
  variant?: string
}

const timeText = (s: IntroStep) => (s.seconds !== null ? `About ${Math.max(1, Math.round(s.seconds / 60))} min` : s.paced ? 'Untimed; your pace is recorded' : 'Untimed')

/** Shown before EVERY game: nothing runs until Start (focused, so Enter starts too). `total` is set on the first screen only. */
export function GameIntro({ step, mode, position, total, onStart }: { step: IntroStep; mode: TrainingMode; position: string | null; total: string | null; onStart: () => void }) {
  const game = GAMES[step.gameId]
  const guide = guideOf(step.gameId, step.variant)
  const scored = guide.scored !== false
  const name = step.title ?? game.name


  return (
    <section className="practice__panel" aria-labelledby="intro-title">
      <p className="label label--muted tnum">{[MODE_LABEL[mode], position, total].filter(Boolean).join(' · ')}</p>
      <h1 id="intro-title" className="display practice__title">
        {name}
      </h1>
      {total && <p className="prep__lede">{MODE_HINT[mode]}</p>}
      <dl className="intro__facts">
        <dt>Measures</dt>
        <dd>{guide.measures}</dd>
        <dt>What to do</dt>
        <dd>{step.howTo ?? game.howTo}</dd>
        <dt>Controls</dt>
        <dd>
          <span>Keyboard: {guide.keys}</span>
          <span>Touch or mouse: {guide.touch}</span>
        </dd>
        <dt>Time</dt>
        <dd>
          {timeText(step)}
          {canPause(step.gameId, mode, step.seconds) ? '. You can pause.' : step.seconds !== null ? '. The clock does not pause.' : ''}
        </dd>
        <dt>Scored on</dt>
        <dd>{scored ? 'Accuracy, speed and level reached' : 'Not scored. It reads your preferences.'}</dd>
      </dl>
      <button type="button" className="btn btn--primary btn--sign" onClick={onStart} autoFocus>
        <Play aria-hidden="true" /> Start test
      </button>
    </section>
  )
}
