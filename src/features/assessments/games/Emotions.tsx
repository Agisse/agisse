import { useEffect, useId, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
const rnd = (n: number, rand: Rand) => Math.floor(rand() * n)

export const EMOTIONS = ['happy', 'sad', 'angry', 'afraid', 'surprised', 'disgusted', 'contempt', 'bored', 'interested', 'confused'] as const
export type Emotion = (typeof EMOTIONS)[number]
export type EmotionVariant = 'six' | 'seven' | 'ten' | 'match'
/** six: HireVue E-Motions; seven: the Ekman set with contempt (Arctic Shores); ten: pymetrics Faces; match: Criteria Matching Faces. */
export const labelsFor = (v: EmotionVariant): readonly Emotion[] => EMOTIONS.slice(0, v === 'seven' ? 7 : v === 'ten' ? 10 : 6)

/** Facial action parameters, roughly −1 … 1, 0 = neutral. */
export type FaceParams = {
  browRaise: number
  browInner: number
  browKnit: number
  browAsym: number
  eyeOpen: number
  cheek: number
  smile: number
  open: number
  width: number
  asym: number
  upperLip: number
  wrinkle: number
  gazeX: number
  gazeY: number
  tilt: number
}
const NEUTRAL: FaceParams = { browRaise: 0, browInner: 0, browKnit: 0, browAsym: 0, eyeOpen: 0, cheek: 0, smile: 0, open: 0, width: 0, asym: 0, upperLip: 0, wrinkle: 0, gazeX: 0, gazeY: 0, tilt: 0 }

/** Each emotion at full intensity, after the classic facial action descriptions. */
export const EXPRESSIONS: Record<Emotion, Partial<FaceParams>> = {
  happy: { smile: 1, open: 0.35, width: 0.3, cheek: 1, eyeOpen: -0.25, browRaise: 0.1 },
  sad: { browInner: 1, browRaise: -0.15, smile: -0.8, eyeOpen: -0.35, gazeY: 0.8, width: -0.1 },
  angry: { browRaise: -0.7, browInner: -1, browKnit: 1, eyeOpen: 0.15, cheek: 0.35, smile: -0.35, width: -0.35 },
  afraid: { browRaise: 0.75, browInner: 0.8, browKnit: 0.7, eyeOpen: 1, open: 0.45, width: 0.6, smile: -0.35 },
  surprised: { browRaise: 1, eyeOpen: 1, open: 1, width: -0.4 },
  disgusted: { browRaise: -0.45, browKnit: 0.45, wrinkle: 1, upperLip: 1, eyeOpen: -0.45, cheek: 0.6, smile: -0.45, open: 0.15, width: -0.1 },
  contempt: { asym: 1, eyeOpen: -0.2, tilt: 4, gazeX: 0.25 },
  bored: { eyeOpen: -0.6, browRaise: -0.1, smile: -0.15, gazeX: 0.9, gazeY: -0.4, tilt: -5 },
  interested: { browRaise: 0.35, eyeOpen: 0.3, smile: 0.35, tilt: 6 },
  confused: { browAsym: 1, browKnit: 0.4, smile: -0.2, asym: -0.45, tilt: 7 },
}

/** Blends neutral towards the emotion; low intensity is the ambiguous end. */
export function paramsFor(e: Emotion, intensity: number): FaceParams {
  const p = { ...NEUTRAL }
  for (const [k, v] of Object.entries(EXPRESSIONS[e])) p[k as keyof FaceParams] = v * intensity
  return p
}

/** Intensity 1 at level 1 down to ~0.42 at level 10. */
export const intensityFor = (level: number) => Math.round((1 - (Math.min(10, Math.max(1, level)) - 1) * 0.065) * 100) / 100

export const SKIN = ['#f3d5bf', '#e8bc96', '#d29b72', '#b0774f', '#8a5a3a', '#5f3d29']
export const HAIR = ['#1f1a17', '#4a3020', '#7b4a2a', '#b88a4a', '#8c8a86']
export type Identity = { skin: number; hair: number; style: number; hw: number; hh: number; jaw: number }
export const makeIdentity = (rand: Rand): Identity => ({
  skin: rnd(SKIN.length, rand),
  hair: rnd(HAIR.length, rand),
  style: rnd(4, rand),
  hw: 58 + rnd(12, rand),
  hh: 80 + rnd(10, rand),
  jaw: 0.45 + rand() * 0.25,
})

/** Original one-line situations, each written to fit one emotion. */
export const SITUATIONS: Record<Emotion, string[]> = {
  happy: ['She just heard her best friend got the job they both hoped for.', 'His team surprised him with a card on his last day before parental leave.', 'The results came back and her project beat every target.'],
  sad: ['He found out his childhood home is being torn down.', 'Her flatmate of six years is moving to another country next week.', 'The rescue dog he walked every weekend has been adopted and he will not see it again.'],
  angry: ['Someone took credit for his analysis in front of the whole board.', 'The courier left her parcel in the rain after she paid for a timed delivery.', 'Her manager cancelled the review for the third time without saying why.'],
  afraid: ['The lift jolts and stops between floors with the lights flickering.', 'He hears footsteps behind him on an empty road late at night.'],
  surprised: ['She opens the door to a room full of friends she thought were abroad.', 'He checks his account and finds a payment he never expected.'],
  disgusted: ['She opens the office fridge and finds a month-old container of fish.', 'He watches a colleague sneeze into his hand and then reach for the shared biscuits.'],
  contempt: ['A rival who cut every corner lectures her about doing things properly.', 'He listens to someone boast about a result everyone knows they bought.'],
  bored: ['The meeting has run 40 minutes over on a topic that does not involve her.', 'He has been on hold for an hour with the same four bars of music.'],
  interested: ['A stranger at the conference describes a method that could fix her biggest problem.', 'His mentor starts explaining how the deal was really won.'],
  confused: ['The instructions say to turn left, but the map shows only a wall.', 'He gets a thank-you email for a meeting he never attended.'],
}

export type EmotionItem = { target: Emotion; face: Identity; intensity: number; situation: string | null; limitMs: number | null }
export type MatchItem = { target: Emotion; face: Identity; options: { emotion: Emotion; face: Identity }[]; answer: number; intensity: number; limitMs: number }

/** For 'ten', even items are face-only (7 s) and odd items add a situation (30 s); six and seven are untimed. */
export function makeEmotionItem(level: number, variant: EmotionVariant, index: number, rand: Rand = Math.random): EmotionItem {
  const labels = labelsFor(variant)
  const target = labels[rnd(labels.length, rand)]
  const withSituation = variant === 'ten' && index % 2 === 1
  return {
    target,
    face: makeIdentity(rand),
    intensity: intensityFor(level),
    situation: withSituation ? SITUATIONS[target][rnd(SITUATIONS[target].length, rand)] : null,
    limitMs: variant === 'ten' ? (withSituation ? 30000 : 7000) : null,
  }
}

/** Three faces, each a different person; one shares the target's emotion. 3 s per round. */
export function makeMatchItem(level: number, rand: Rand = Math.random): MatchItem {
  const labels = labelsFor('six')
  const target = labels[rnd(labels.length, rand)]
  const others = labels.filter((e) => e !== target)
  const a = others.splice(rnd(others.length, rand), 1)[0]
  const b = others[rnd(others.length, rand)]
  const answer = rnd(3, rand)
  const emotions = [a, b]
  emotions.splice(answer, 0, target)
  return { target, face: makeIdentity(rand), options: emotions.map((emotion) => ({ emotion, face: makeIdentity(rand) })), answer, intensity: intensityFor(level), limitMs: 3000 }
}

/** kind = 'target:picked', picked 'timeout' when the clock ran out; ':s' marks an item with a situation. */
export const emotionKind = (target: Emotion, picked: Emotion | 'timeout', situation: boolean) => `${target}:${picked}${situation ? ':s' : ''}`

export function emotionDetails(trials: Trial[]) {
  const parsed = trials.map((t) => ({ t, k: (t.kind ?? '').split(':') })).filter((x) => (EMOTIONS as readonly string[]).includes(x.k[0]))
  const rate = (xs: typeof parsed) => (xs.length ? Math.round((xs.filter((x) => x.t.correct).length / xs.length) * 1000) / 1000 : 0)
  const out: Record<string, number> = {
    timeouts: parsed.filter((x) => x.k[1] === 'timeout').length,
    faceOnlyRate: rate(parsed.filter((x) => x.k[2] !== 's')),
    situationRate: rate(parsed.filter((x) => x.k[2] === 's')),
  }
  for (const e of EMOTIONS) {
    const xs = parsed.filter((x) => x.k[0] === e)
    if (xs.length) out[`${e}Rate`] = rate(xs)
  }
  return out
}

// ---------- Face ----------

const shade = (hex: string, f: number) =>
  `#${[1, 3, 5].map((i) => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('')}`
/** Quadratic control point so the curve passes through `mid` halfway between the ends. */
const ctrl = (a: number, b: number, mid: number) => 2 * mid - (a + b) / 2

export function Face({ id, p, className }: { id: Identity; p: FaceParams; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const skin = SKIN[id.skin]
  const hair = HAIR[id.hair]
  const line = shade(skin, 0.55)
  const ink = '#2a1c16'
  const { hw, hh, jaw } = id
  const cy = 112
  const head = `M${100 - hw},${cy} C${100 - hw},${cy - hh * 1.05} ${100 + hw},${cy - hh * 1.05} ${100 + hw},${cy} C${100 + hw},${cy + hh * 0.55} ${100 + hw * jaw},${cy + hh * 0.95} 100,${cy + hh} C${100 - hw * jaw},${cy + hh * 0.95} ${100 - hw},${cy + hh * 0.55} ${100 - hw},${cy} Z`
  const cap = `M${100 - hw - 3},${cy - 2} C${100 - hw - 6},${cy - hh * 1.2} ${100 + hw + 6},${cy - hh * 1.2} ${100 + hw + 3},${cy - 2} L${100 + hw - 3},${cy - 16} Q${100 + hw * 0.4},${cy - hh * 0.62} 100,${cy - hh * 0.5} Q${100 - hw * 0.5},${cy - hh * 0.6} ${100 - hw + 3},${cy - 16} Z`

  const eyeY = 113
  const eye = (side: -1 | 1) => {
    const x = 100 + side * 25
    const up = 5.5 * (1 + 0.6 * p.eyeOpen)
    const down = 4.5 * (1 + 0.4 * Math.min(0, p.eyeOpen) + 0.3 * Math.max(0, p.eyeOpen)) * (1 - 0.45 * Math.max(0, p.cheek))
    const d = `M${x - 11},${eyeY} C${x - 6},${eyeY - up * 1.35} ${x + 6},${eyeY - up * 1.35} ${x + 11},${eyeY} C${x + 6},${eyeY + down * 1.35} ${x - 6},${eyeY + down * 1.35} ${x - 11},${eyeY} Z`
    const clip = `${uid}e${side}`
    return (
      <g key={side}>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
        <path d={d} fill="#fbf8f4" />
        <g clipPath={`url(#${clip})`}>
          <circle cx={x + p.gazeX * 4} cy={eyeY + p.gazeY * 2.5} r={4.8} fill={shade(HAIR[id.hair === 4 ? 1 : id.hair], 1.3)} />
          <circle cx={x + p.gazeX * 4} cy={eyeY + p.gazeY * 2.5} r={2.2} fill={ink} />
        </g>
        <path d={`M${x - 12},${eyeY + 0.5} C${x - 6},${eyeY - up * 1.4} ${x + 6},${eyeY - up * 1.4} ${x + 12},${eyeY + 0.5}`} fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        {p.cheek > 0.2 && <path d={`M${x - 9},${eyeY + down + 4} Q${x},${eyeY + down + 7} ${x + 9},${eyeY + down + 4}`} fill="none" stroke={line} strokeOpacity={p.cheek * 0.7} strokeWidth={1.2} />}
      </g>
    )
  }
  const brow = (side: -1 | 1) => {
    const lift = -10 * p.browRaise + (side === 1 ? -6 : 5) * p.browAsym
    const inner = 97 + lift - 9 * p.browInner
    const outer = 96 + lift + 3 * p.browInner
    const ix = 100 + side * (11 - 3 * p.browKnit)
    const ox = 100 + side * 37
    return (
      <path
        key={side}
        d={`M${ix},${inner} Q${(ix + ox) / 2},${(inner + outer) / 2 - 5} ${ox},${outer + 2}`}
        fill="none"
        stroke={shade(hair, 0.9)}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
    )
  }

  const mw = 17 * (1 + 0.28 * p.width)
  const my = 163
  const lY = my - 7 * p.smile
  const rY = my - 7 * p.smile - 8 * p.asym
  const upMid = my - 1 - 4 * p.upperLip - 1.5 * p.open
  const loMid = my + 1 + 15 * p.open + 3 * Math.max(0, p.smile)
  const ends = (lY + rY) / 2
  const mouth = `M${100 - mw},${lY} Q100,${ctrl(lY, rY, upMid)} ${100 + mw},${rY} Q100,${ctrl(lY, rY, loMid)} ${100 - mw},${lY} Z`
  const lips = shade(skin, 0.72)
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label="A face">
      {id.style === 1 && <rect x={100 - hw - 12} y={cy - hh * 0.8} width={hw * 2 + 24} height={hh * 1.9} rx={hw * 0.9} fill={hair} transform={`rotate(${p.tilt} 100 170)`} />}
      <path d={`M80,${cy + hh - 14} L80,240 L120,240 L120,${cy + hh - 14} Z`} fill={shade(skin, 0.9)} />
      <path d="M20,240 C24,214 60,204 84,202 L116,202 C140,204 176,214 180,240 Z" fill={['#3d5a80', '#5b6b4e', '#7a4e5c', '#4d4d4d'][id.style]} />
      <g transform={`rotate(${p.tilt} 100 170)`}>
        <ellipse cx={100 - hw} cy={cy + 6} rx={8} ry={13} fill={shade(skin, 0.95)} />
        <ellipse cx={100 + hw} cy={cy + 6} rx={8} ry={13} fill={shade(skin, 0.95)} />
        <path d={head} fill={skin} />
        {id.style !== 3 && <path d={cap} fill={hair} />}
        {id.style === 2 && <circle cx={100} cy={cy - hh * 0.98} r={17} fill={hair} />}
        {id.style === 3 && (
          <>
            <clipPath id={`${uid}h`}>
              <path d={head} />
            </clipPath>
            <path d={cap} fill={hair} opacity={0.4} clipPath={`url(#${uid}h)`} />
          </>
        )}
        {eye(-1)}
        {eye(1)}
        {brow(-1)}
        {brow(1)}
        <path d="M97,118 Q93,135 94,141 Q100,145 106,141" fill="none" stroke={line} strokeWidth={1.8} strokeLinecap="round" />
        {p.wrinkle > 0.15 &&
          [-1, 1].map((s) => (
            <path key={s} d={`M${100 + s * 4},113 q${s * 3},4 ${s * 1},9`} fill="none" stroke={line} strokeOpacity={p.wrinkle} strokeWidth={1.3} />
          ))}
        {p.smile > 0.4 &&
          [-1, 1].map((s) => (
            <path key={s} d={`M${100 + s * 15},146 Q${100 + s * 21},152 ${100 + s * (mw + 3)},${(s < 0 ? lY : rY) + 1}`} fill="none" stroke={line} strokeOpacity={(p.smile - 0.3) * 0.5} strokeWidth={1.2} />
          ))}
        {p.browKnit > 0.35 &&
          [-1, 1].map((s) => (
            <path key={s} d={`M${100 + s * 3},${100 - 10 * p.browRaise} l${s * 0.6},8`} fill="none" stroke={line} strokeOpacity={p.browKnit * 0.7} strokeWidth={1.2} strokeLinecap="round" />
          ))}
        {p.open > 0.08 ? (
          <g>
            <clipPath id={`${uid}m`}>
              <path d={mouth} />
            </clipPath>
            <path d={mouth} fill="#4a2223" />
            <g clipPath={`url(#${uid}m)`}>
              <rect x={100 - mw} y={Math.min(upMid, ends) - 4} width={mw * 2} height={4 + 4 * p.open + (p.smile > 0.3 ? 3 : 0)} fill="#f6f1ea" />
            </g>
            <path d={mouth} fill="none" stroke={lips} strokeWidth={2.4} strokeLinejoin="round" />
          </g>
        ) : (
          <g>
            <path d={`M${100 - mw},${lY} Q100,${ctrl(lY, rY, upMid + 1)} ${100 + mw},${rY}`} fill="none" stroke={shade(skin, 0.5)} strokeWidth={2} strokeLinecap="round" />
            <path d={`M${100 - mw * 0.6},${(lY + ends) / 2 + 3} Q100,${ctrl(lY, rY, loMid + 4)} ${100 + mw * 0.6},${(rY + ends) / 2 + 3}`} fill="none" stroke={lips} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.7} />
          </g>
        )}
      </g>
    </svg>
  )
}

// ---------- Game ----------

const LABEL: Record<Emotion, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  afraid: 'Afraid',
  surprised: 'Surprised',
  disgusted: 'Disgusted',
  contempt: 'Contempt',
  bored: 'Bored',
  interested: 'Interested',
  confused: 'Confused',
}
const KEY = (i: number) => String((i + 1) % 10)

function EmotionsGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const v: EmotionVariant = variant === 'seven' || variant === 'ten' || variant === 'match' ? variant : 'six'
  const index = useRef(0)
  const make = (l: number) => (v === 'match' ? makeMatchItem(l) : makeEmotionItem(l, v, index.current))
  const [item, setItem] = useState<EmotionItem | MatchItem>(() => make(level))
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [item])

  function finish(picked: Emotion | 'timeout') {
    if (fb) return
    const situation = 'situation' in item && !!item.situation
    const ok = picked === item.target
    onTrial({ correct: ok, rt: picked === 'timeout' ? item.limitMs! : performance.now() - shownAt.current, level: itemLevel.current, kind: emotionKind(item.target, picked, situation) })
    index.current++
    if (rounds && index.current >= rounds) onDone?.()
    setFb({ ok, text: `${picked === 'timeout' ? 'time ran out; ' : ''}${v === 'match' ? 'the matching face shows' : 'this face shows'} ${LABEL[item.target].toLowerCase()}` })
  }

  useEffect(() => {
    if (fb || item.limitMs === null) return
    const t = setTimeout(() => finish('timeout'), item.limitMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, fb])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        setFb(null)
        setItem(make(levelRef.current))
      },
      feedback ? 1500 : 300,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, feedback])

  const choices: Emotion[] = 'options' in item ? item.options.map((o) => o.emotion) : [...labelsFor(v)]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key.length !== 1 || !/\d/.test(e.key)) return
      const i = (Number(e.key) + 9) % 10
      if (i < choices.length) finish(choices[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const reveal = !!fb && feedback
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {'options' in item ? 'Which face shows the same emotion?' : 'Which emotion is this person showing?'}
      </div>
      {item.limitMs !== null && !fb && <div key={index.current} className="hv-countdown" style={{ '--timer-ms': `${item.limitMs}ms` } as CSSProperties} aria-hidden="true" />}
      <Face id={item.face} p={paramsFor(item.target, item.intensity)} className="hv-face" />
      {'situation' in item && item.situation && <p className="hv-situation">{item.situation}</p>}
      {'options' in item ? (
        <div className="game__choices">
          {item.options.map((o, i) => (
            <button key={i} type="button" className="btn hv-faceopt" data-answer={reveal && i === item.answer ? 'true' : undefined} disabled={!!fb} onClick={() => finish(o.emotion)} aria-label={`Face ${i + 1}`}>
              <Face id={o.face} p={paramsFor(o.emotion, item.intensity)} className="hv-face hv-face--sm" />
              <span className="hv-key">{i + 1}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="game__choices hv-labels">
          {choices.map((e, i) => (
            <button key={e} type="button" className="btn game__choice" data-answer={reveal && e === item.target ? 'true' : undefined} disabled={!!fb} onClick={() => finish(e)}>
              <span className="hv-key">{KEY(i)}</span> {LABEL[e]}
            </button>
          ))}
        </div>
      )}
      <div className={`game__feedback ${reveal ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {reveal && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">Number keys 1–{choices.length === 10 ? '0' : choices.length} pick an answer</div>
    </div>
  )
}

export const emotions: GameDef = {
  id: 'emotions',
  name: 'Emotions',
  skills: ['emotion-recognition'],
  howTo: 'Read the face (and the situation, when there is one) and pick the emotion it shows, or the face that shows the same emotion.',
  duration: 240,
  targetRt: 3000,
  Component: EmotionsGame satisfies ComponentType<GameProps>,
  details: emotionDetails,
}
