import { useEffect, useRef } from 'react'
import { Link } from 'wouter'
import { referencePercentile, type GameId, type GameResult as Result } from '../../../../shared/assessments'
import { GAMES } from '../games'
import { coachNotes } from '../analytics/coach'
import { guideOf } from './gameGuide'

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`
const rt = (ms: number) => (!ms ? '–' : ms >= 10000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`)

type Props = {
  gameId: GameId
  title?: string
  result: Result
  paced?: boolean
  /** Earlier results of this game, newest first. */
  history: Result[]
  /** Buttons: Try again, then either "Next: …" or "Back to Tests". */
  onAgain?: () => void
  next?: { label: string; go: () => void }
  back: string
  heading?: 'h1' | 'h2'
}

/** One game's outcome in plain words: a headline, one comparison, one tip; the full numbers sit under Details. */
export function GameResultView({ gameId, title, result, paced, history, onAgain, next, back, heading: H = 'h1' }: Props) {
  const name = title ?? GAMES[gameId].name
  const scored = guideOf(gameId).scored !== false
  const right = Math.round(result.accuracy * result.trials)
  const headline = result.trials >= 3 ? `You got ${right} of ${result.trials} right` : `You reached level ${result.difficultyReached} of 10`
  const prev = history[0]
  const compare =
    prev &&
    (result.score === prev.score ? `Same score as last time (${prev.score}).` : `Score ${result.score}, ${result.score > prev.score ? 'up' : 'down'} from ${prev.score} last time.`)
  // notes[0] restates the headline; the game's own tip follows it.
  const notes = coachNotes(result, gameId, history)
  const tip = notes[1] ?? notes[0]
  const backLabel = back.startsWith('/jobs/') ? 'Back to the online test' : 'Back to Tests'
  // A screen of its own (h1): move focus to its title so keyboard and screen-reader users land on the result.
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (H === 'h1') titleRef.current?.focus()
  }, [H])

  return (
    <div className="result">
      <H ref={titleRef} tabIndex={-1} className="display practice__title">{name}</H>
      {scored ? (
        <>
          <p className="result__headline">{headline}</p>
          {compare && <p className="prep__meta">{compare}</p>}
          {tip && <p className="result__tip">{tip}</p>}
          <details className="result__details">
            <summary>Details</summary>
            <div className="practice__table">
              <table>
                <tbody>
                  <tr>
                    <th scope="row">Score</th>
                    <td className="tnum">{result.score}</td>
                  </tr>
                  <tr>
                    <th scope="row">Accuracy</th>
                    <td className="tnum">{Math.round(result.accuracy * 100)}%</td>
                  </tr>
                  <tr>
                    <th scope="row">Median time</th>
                    <td className="tnum">{rt(result.medianResponseTime)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Level reached</th>
                    <td className="tnum">{result.difficultyReached} / 10</td>
                  </tr>
                  <tr>
                    <th scope="row">vs. reference (estimated)</th>
                    <td className="tnum">{result.trials ? ordinal(referencePercentile(result.score)) : '–'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {paced && result.trials > 0 && (
              <p className="prep__meta">
                Pace {rt(result.medianResponseTime)} per correct item (fluent: about {rt(GAMES[gameId].targetRt)}). The real test reports pace and accuracy apart, so a fast wrong
                answer helps neither.
              </p>
            )}
            <p className="booth__model">
              Agisse's own 0–100 scale. Not an employer's score, and does not predict one. The reference percentile compares with an estimated curve, not with real test takers.
            </p>
          </details>
        </>
      ) : (
        <p className="result__headline">No right answer. It reads your preferences.</p>
      )}
      {onAgain && (
        <div className="posting__actions">
          {next ? (
            <button type="button" className="btn btn--primary" onClick={next.go}>
              {next.label}
            </button>
          ) : (
            <Link href={back} className="btn btn--primary">
              {backLabel}
            </Link>
          )}
          <button type="button" className="btn" onClick={onAgain}>
            Try again
          </button>
          {next && (
            <Link href={back} className="btn btn--quiet">
              {backLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
