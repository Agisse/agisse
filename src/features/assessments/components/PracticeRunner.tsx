import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { ArrowLeft } from 'lucide-react'
import { providerGame } from '../../../../shared/assessment-catalog'
import { TRAINING_MODES, type GameId, type GameResult, type TrainingMode, type TrainingSession } from '../../../../shared/assessments'
import { api } from '../../../lib/api'
import { useResource } from '../../../lib/hooks'
import posthog from '../../../lib/posthog'
import { GAMES } from '../games'
import { GameSession } from '../engine/session'
import type { Trial } from '../engine/types'
import { drillPlan, drillSeconds, trainingPlan } from '../providers/plan'
import { ErrorNote } from './AssessmentPrep'
import { GameIntro, type IntroStep } from './GameIntro'
import { canPause, guideOf } from './gameGuide'
import { GameResultView } from './GameResult'
import './runner.css'
import '../games/games.css'
import '../assessments.css'

/** seconds null = untimed (practice). title/variant set when the step is a provider's game (e.g. pymetrics Balloons). */
/** paced: the real test records time instead of counting down, so the clock counts up and pace is reported apart from accuracy. */
type Step = IntroStep & { variant?: string; rounds?: number; providerGameId?: string }
/** `history` is this game's earlier results in this mode, frozen when it finished, so "last time" is never the run itself. */
type Done = { step: Step; result: GameResult; history: GameResult[] }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Full-page run of one or more drills: /practice?mode=… (free training) or /jobs/:id/practice. */
export function PracticeRunner({ jobId }: { jobId?: string }) {
  const search = useSearch()
  const q = new URLSearchParams(search)
  const rawMode = q.get('mode')
  const mode: TrainingMode = TRAINING_MODES.find((m) => m === rawMode) ?? 'drill'
  // `games` takes drill ids or provider game ids (pymetrics-balloons); a provider game runs its own variant and real timing.
  const listed = (q.get('games') ?? '').split(',').filter((g) => Object.hasOwn(GAMES, g) || providerGame(g))

  const plan = useResource(async () => {
    const sessions = await api
      .trainingSessions()
      .then((r) => r.sessions)
      .catch(() => [] as TrainingSession[])
    const games = listed.length ? listed : drillPlan(sessions, jobId ? trainingPlan((await api.jobAssessment(jobId)).assessment).allocation : undefined).map((d) => d.gameId)
    const queue = games.map((id): Step => {
      const pg = providerGame(id)
      const gameId = pg ? pg.gameId : (id as GameId)
      // Simulation of a provider game: its real length; round-limited games get the drill default and end when the game says so.
      const seconds = mode === 'practice' ? null : mode === 'simulation' ? (pg?.realDuration ?? (pg?.realRounds ? null : GAMES[gameId].duration)) : drillSeconds(games.length)
      return pg
        ? {
            gameId,
            providerGameId: pg.id,
            seconds,
            title: pg.name,
            variant: pg.variant,
            howTo: pg.howTo,
            rounds: mode === 'simulation' ? (pg.realRounds ?? undefined) : undefined,
            paced: pg.timeRecorded,
          }
        : { gameId, seconds }
    })
    return { sessions, queue }
  }, [search, jobId])

  const back = jobId ? `/jobs/${jobId}/prepare#online-test` : '/prepare'
  // While a game runs the way out is its End button, which asks first.
  const [running, setRunning] = useState(false)
  return (
    <main className="map practice">
      {!running && (
        <Link href={back} className="booth__back">
          <ArrowLeft aria-hidden="true" /> {jobId ? 'Online test' : 'Tests'}
        </Link>
      )}
      {plan.error ? (
        <ErrorNote text={plan.error} />
      ) : !plan.data ? (
        <p className="label label--muted">Getting your tests ready…</p>
      ) : !plan.data.queue.length ? (
        <p className="prep__lede">Nothing to practise for this application: no tested skill matches a test you can practise here.</p>
      ) : (
        <Run key={search} jobId={jobId ?? null} mode={mode} queue={plan.data.queue} sessions={plan.data.sessions} back={back} onRunning={setRunning} />
      )}
    </main>
  )
}

const totalText = (queue: Step[]) => {
  const secs = queue.reduce((n, s) => n + (s.seconds ?? 0), 0)
  const untimed = queue.filter((s) => s.seconds === null).length
  const n = `${queue.length} ${queue.length === 1 ? 'test' : 'tests'}`
  if (!secs) return `${n} · untimed`
  return `${n} · about ${Math.max(1, Math.round(secs / 60))} min${untimed ? ' plus untimed' : ''}`
}

function Run({
  jobId,
  mode,
  queue,
  sessions,
  back,
  onRunning,
}: {
  jobId: string | null
  mode: TrainingMode
  queue: Step[]
  sessions: TrainingSession[]
  back: string
  onRunning: (r: boolean) => void
}) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'result' | 'done'>('intro')
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [done, setDone] = useState<Done[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const step = queue[index]!
  const multi = queue.length > 1
  const position = multi ? `${index + 1} of ${queue.length}` : null
  // Results saved in this visit join the history, so Try again compares with the attempt just played.
  const [saved, setSaved] = useState<TrainingSession[]>([])
  // Same test, same version (pymetrics Stop and HireVue Pulse share a component), same mode.
  const past = (s: Step) => [...saved, ...sessions].filter((x) => x.gameId === s.gameId && x.providerGameId === (s.providerGameId ?? null) && x.mode === mode).map((x) => x.result)

  useEffect(() => onRunning(phase === 'running'), [phase, onRunning])

  const start = () => {
    if (index === 0 && !done.length && attempt === 0)
      posthog.capture('training_started', {
        mode,
        games: queue.map((s) => s.gameId),
        has_job: Boolean(jobId),
      })
    setPhase('running')
  }

  const finish = (result: GameResult, durationSec: number) => {
    const history = past(step)
    // Nothing answered, nothing to record. The server caps one item's median time at 10 min and a session at 4 h; an untimed item left open stays saveable.
    if (result.trials)
      api
        .saveTraining({ jobId, mode, gameId: step.gameId, providerGameId: step.providerGameId ?? null, durationSec: Math.min(durationSec, 4 * 60 * 60), result: { ...result, medianResponseTime: Math.min(result.medianResponseTime, 600_000) } })
        .then((r) => setSaved((s) => [r.session, ...s]))
        .catch((e) => setSaveError(e instanceof Error ? e.message : 'Could not save this result'))
    const all = [...done, { step, result, history }]
    setDone(all)
    const last = index + 1 >= queue.length
    if (last)
      posthog.capture('training_finished', {
        mode,
        games: all.length,
        has_job: Boolean(jobId),
        mean_score: Math.round(all.reduce((s, d) => s + d.result.score, 0) / all.length),
      })
    // Real conditions hold every result back until the end.
    if (mode === 'simulation') {
      if (last) setPhase('done')
      else {
        setIndex(index + 1)
        setPhase('intro')
      }
    } else setPhase('result')
  }

  const again = () => {
    setDone([])
    setIndex(0)
    setAttempt(0)
    setSaveError(null)
    setPhase('intro')
  }

  if (phase === 'intro')
    return <GameIntro step={step} mode={mode} position={position && `Test ${position}`} total={index === 0 && !done.length ? totalText(queue) : null} onStart={start} />

  if (phase === 'running') return <GameRun key={`${index}-${attempt}`} step={step} mode={mode} position={position} back={back} onFinish={finish} />

  const errorNote = saveError && <ErrorNote text={`Not saved: ${saveError}`} />

  if (phase === 'result') {
    const d = done[done.length - 1]!
    const nextStep = queue[index + 1]
    return (
      <section className="practice__panel" aria-label="Result">
        {errorNote}
        <GameResultView
          gameId={d.step.gameId}
          title={d.step.title}
          result={d.result}
          paced={d.step.paced}
          history={d.history}
          back={back}
          onAgain={() => {
            setDone(done.slice(0, -1))
            setAttempt(attempt + 1)
            setPhase('intro')
          }}
          next={
            nextStep
              ? {
                  label: `Next: ${nextStep.title ?? GAMES[nextStep.gameId].name}`,
                  go: () => (setIndex(index + 1), setAttempt(0), setPhase('intro')),
                }
              : undefined
          }
        />
      </section>
    )
  }

  return (
    <section className="practice__panel" aria-labelledby="practice-done">
      <h1 id="practice-done" className="display practice__title">
        Results
      </h1>
      {errorNote}
      {done.map((d, i) => (
        <GameResultView key={i} heading="h2" gameId={d.step.gameId} title={d.step.title} result={d.result} paced={d.step.paced} history={d.history} back={back} />
      ))}
      <div className="posting__actions">
        <button type="button" className="btn btn--primary" onClick={again}>
          Try again
        </button>
        <Link href={back} className="btn">
          {jobId ? 'Back to the online test' : 'Back to Tests'}
        </Link>
      </div>
    </section>
  )
}

function GameRun({
  step,
  mode,
  position,
  back,
  onFinish,
}: {
  step: Step
  mode: TrainingMode
  position: string | null
  back: string
  onFinish: (r: GameResult, durationSec: number) => void
}) {
  const game = GAMES[step.gameId]
  const [, navigate] = useLocation()
  // Simulation: fixed-level walk from the middle so the run mixes easy and hard items.
  const [session] = useState(() => new GameSession(game, mode === 'simulation' ? 5 : 3, mode !== 'simulation', guideOf(step.gameId).scored !== false))
  const [level, setLevel] = useState(session.level)
  const [left, setLeft] = useState(step.seconds)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ended = useRef(false)
  const remaining = useRef((step.seconds ?? 0) * 1000)
  const pausedMs = useRef(0)
  const pausedAt = useRef(0)
  /** Pause spans on the performance.now() clock games time items with, so a trial's rt can drop the time spent paused. */
  const pauses = useRef<[number, number][]>([])
  const covered = paused || timeUp
  // Games call onTrial from their own timers with mount-time closures; a ref sees the cover the moment it goes up.
  const coveredRef = useRef(false)
  coveredRef.current = covered
  const pausable = canPause(step.gameId, mode, step.seconds)

  // onFinish's inputs cannot change while this game runs (the runner keys it per game), so the mount-time closure is current.
  const end = () => {
    if (ended.current) return
    ended.current = true
    onFinish(session.finish(), Math.round((Date.now() - session.startedAt - pausedMs.current) / 1000))
  }
  const pause = (p: boolean) => {
    coveredRef.current = p
    if (p) {
      pausedAt.current = Date.now()
      pauses.current.push([performance.now(), Infinity])
    } else {
      pausedMs.current += Date.now() - pausedAt.current
      pauses.current[pauses.current.length - 1]![1] = performance.now()
    }
    setPaused(p)
  }
  /** Behind the Paused or Time's up sheet the player can't answer, so a game's own timeouts there are not their misses. */
  const trial = (t: Trial) => {
    if (ended.current || coveredRef.current) return
    const now = performance.now()
    const from = now - t.rt
    const lost = pauses.current.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, now) - Math.max(a, from)), 0)
    setLevel(session.submitAnswer(lost ? { ...t, rt: Math.max(0, t.rt - lost) } : t))
  }
  const quit = () => {
    ended.current = true
    navigate(back)
  }

  useLeaveGuard(true, () => setConfirming(true))
  useEffect(() => session.start(), [session])

  // The clock runs from `remaining`, so pausing freezes it and resuming carries on.
  useEffect(() => {
    if (covered) return
    if (step.seconds === null) {
      if (!step.paced) return
      const t = setInterval(() => setElapsed(Math.floor((Date.now() - session.startedAt - pausedMs.current) / 1000)), 500)
      return () => clearInterval(t)
    }
    const until = Date.now() + remaining.current
    const t = setInterval(() => {
      remaining.current = Math.max(0, until - Date.now())
      const l = Math.ceil(remaining.current / 1000)
      setLeft(l)
      if (l === 0) {
        clearInterval(t)
        coveredRef.current = true
        setTimeUp(true)
      }
    }, 250)
    return () => clearInterval(t)
  }, [session, step.seconds, step.paced, covered])

  // "Time's up" shows briefly before the next screen.
  useEffect(() => {
    if (!timeUp) return
    const t = setTimeout(end, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  // The clock keeps running behind the End confirm; Esc keeps going.
  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  // Games listen on window; while the board is covered, swallow keys before they get there.
  useEffect(() => {
    if (!covered) return
    const block = (e: KeyboardEvent) => e.stopPropagation()
    window.addEventListener('keydown', block, true)
    window.addEventListener('keyup', block, true)
    return () => {
      window.removeEventListener('keydown', block, true)
      window.removeEventListener('keyup', block, true)
    }
  }, [covered])

  const name = step.title ?? game.name
  return (
    <section className="practice__run" aria-label={`${name}${position ? `, test ${position}` : ''}`}>
      <div className="practice__bar">
        <span className="label">
          {name} {position && <span className="label--muted tnum">· {position}</span>}
        </span>
        <span className="runner__ctl">
          {left !== null ? (
            <span className="practice__clock tnum" role="timer" aria-label={`${left} seconds left`}>
              {clock(left)}
            </span>
          ) : (
            step.paced && (
              <span className="practice__clock tnum" aria-label={`${elapsed} seconds so far, time recorded`}>
                {clock(elapsed)}
              </span>
            )
          )}
          {pausable && !timeUp && (
            <button type="button" className="btn btn--sm" onClick={() => pause(!paused)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
          {left === null && !covered && (
            <button type="button" className="btn btn--sm" onClick={end}>
              Finish
            </button>
          )}
          <button type="button" className="btn btn--sm btn--quiet" onClick={() => setConfirming(true)} disabled={timeUp}>
            End
          </button>
        </span>
      </div>
      {confirming && !timeUp && (
        <div className="runner__confirm" role="alertdialog" aria-label="End this test?">
          <span>End now? This test won't be saved.</span>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setConfirming(false)} autoFocus>
            Keep going
          </button>
          <button type="button" className="btn btn--sm" onClick={quit}>
            End test
          </button>
        </div>
      )}
      <div className="runner__stage light-scope" data-covered={covered}>
        <div className="runner__board" inert={covered}>
          <game.Component
            level={level}
            mode={mode}
            feedback={mode === 'practice'}
            variant={step.variant}
            rounds={step.rounds}
            paused={covered}
            onDone={end}
            onTrial={trial}
          />
        </div>
        {covered && (
          <div className="runner__sheet" role="status">
            <p className="result__headline">{timeUp ? "Time's up" : 'Paused'}</p>
            {paused && (
              <button type="button" className="btn btn--primary" onClick={() => pause(false)}>
                Resume
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** Live guards; a remount (StrictMode, the next game in a queue) reuses the history entry instead of stacking another. */
let guards = 0
const GUARD = { leaveGuard: true }

/** Browser back or a tab close while a game runs: back opens the inline End confirm, a tab close gets the browser's own prompt. */
function useLeaveGuard(on: boolean, onBack: () => void) {
  const cb = useRef(onBack)
  useEffect(() => {
    cb.current = onBack
  })
  useEffect(() => {
    if (!on) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    const onPop = () => {
      history.pushState(GUARD, '', location.href)
      cb.current()
    }
    guards++
    if (!history.state?.leaveGuard) history.pushState(GUARD, '', location.href)
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('popstate', onPop)
    return () => {
      guards--
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('popstate', onPop)
      // The game ended in place: drop the guard entry so the next Back leaves the page. A quit already navigated past it.
      setTimeout(() => {
        if (!guards && history.state?.leaveGuard) history.back()
      })
    }
  }, [on])
}
