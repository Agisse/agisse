import { useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { AptLayout, Explain, deck, useItemLoop } from './Aptitude'
import { SJT_SCENARIOS, type SjtScenario } from './sjtItems'

// Situational judgement. Default: pick the most and the least effective response (SHL, Sova, Aon style).
// variant 'rate': rate every response 1–4 (Capp style). Keyed against SJT_SCENARIOS' ratings.

const RATE_LABEL = ['Counterproductive', 'Fairly ineffective', 'Fairly effective', 'Highly effective']

/** Both picks right = correct; kind carries how many of the two were right. */
export function judgeMostLeast(s: SjtScenario, most: number, least: number) {
  const points = Number(s.ratings[most] === 4) + Number(s.ratings[least] === 1)
  return { correct: points === 2, kind: `ml:${points}` }
}

/** Correct when the ratings are off the key by 2 steps or fewer in total; kind carries the 0–100 closeness. */
export function judgeRate(s: SjtScenario, ratings: number[]) {
  const off = s.ratings.reduce((sum, k, i) => sum + Math.abs(k - ratings[i]!), 0)
  return { correct: off <= 2, kind: `rate:${Math.round(100 * (1 - off / 12))}` }
}

/** Mean partial credit (0–1): half a point per right most/least pick, or closeness of the ratings. */
export const sjtDetails = (trials: Trial[]): Record<string, number> => {
  const xs = trials.map((t) => (t.kind?.startsWith('ml:') ? Number(t.kind.slice(3)) / 2 : t.kind?.startsWith('rate:') ? Number(t.kind.slice(5)) / 100 : null)).filter((x) => x !== null)
  return xs.length ? { partialCredit: Math.round((100 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 100 } : {}
}

function SjtGame(props: GameProps) {
  const rate = props.variant === 'rate'
  const [draw] = useState(() => deck(SJT_SCENARIOS))
  const { item, result, submit, next, seq } = useItemLoop(draw, props)
  return <Scenario key={seq} s={item} rate={rate} result={result} onSubmit={submit} onNext={next} />
}

function Scenario({ s, rate, result, onSubmit, onNext }: { s: SjtScenario; rate: boolean; result: boolean | null; onSubmit: (ok: boolean, kind: string) => void; onNext: () => void }) {
  const [most, setMost] = useState<number | null>(null)
  const [least, setLeast] = useState<number | null>(null)
  const [ratings, setRatings] = useState<(number | null)[]>([null, null, null, null])
  const shown = result !== null
  const pickMost = (i: number) => {
    setMost(i)
    if (least === i) setLeast(null)
  }
  const pickLeast = (i: number) => {
    setLeast(i)
    if (most === i) setMost(null)
  }
  const ready = rate ? ratings.every((r) => r !== null) : most !== null && least !== null && most !== least
  const send = () => {
    if (!ready || shown) return
    const j = rate ? judgeRate(s, ratings as number[]) : judgeMostLeast(s, most!, least!)
    onSubmit(j.correct, j.kind)
  }
  return (
    <AptLayout
      keys="Tab to move · Space to select · Enter to submit"
      stimulus={
        <>
          <div className="apt__caption">Scenario</div>
          <p>{s.situation}</p>
        </>
      }
      question={
        <>
          {rate ? 'Rate how effective each response is.' : 'Which response is the most effective, and which the least?'}
          {rate && <span className="apt__rule">1 counterproductive · 2 fairly ineffective · 3 fairly effective · 4 highly effective</span>}
        </>
      }
    >
      <div className="apt__sjt">
        {s.responses.map((text, i) => (
          <div key={i} className="apt__resp">
            <span>
              {text}
              {shown && <span className="apt__key"> Key: {RATE_LABEL[s.ratings[i]! - 1]!.toLowerCase()}.</span>}
            </span>
            <span className="apt__rate" role="group" aria-label={`Response ${i + 1}`}>
              {rate ? (
                [1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={ratings[i] === n} aria-label={`${n}, ${RATE_LABEL[n - 1]}`} disabled={shown} onClick={() => setRatings((r) => r.map((x, k) => (k === i ? n : x)))}>
                    {n}
                  </button>
                ))
              ) : (
                <>
                  <button type="button" aria-pressed={most === i} disabled={shown} onClick={() => pickMost(i)}>
                    Most
                  </button>
                  <button type="button" aria-pressed={least === i} disabled={shown} onClick={() => pickLeast(i)}>
                    Least
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      {!shown && (
        <button type="button" className="btn btn--primary btn--sm apt__next" disabled={!ready} onClick={send}>
          Submit
        </button>
      )}
      {shown && <Explain ok={result} text={<p>{`${s.competency}. ${s.note}`}</p>} onNext={onNext} />}
    </AptLayout>
  )
}

export const sjt: GameDef = {
  id: 'sjt',
  name: 'Situational judgement',
  skills: ['situational-judgement'],
  howTo: 'Read each workplace scenario and judge the responses as an effective graduate would. No calculation, no trick: think about the person who owns the problem.',
  duration: 600,
  targetRt: 50000,
  Component: SjtGame satisfies ComponentType<GameProps>,
  details: sjtDetails,
}
