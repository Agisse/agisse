import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { SLOW_AFTER, stepAt } from '@/lib/ai-wait'
import { useDark } from '@/lib/theme'

/** The outline of what is coming, so the page doesn't jump when it lands. */
export type AiShape = 'verdict' | 'document' | 'letter' | 'list' | 'lines'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Shown while the AI works on something: what it is doing now, elapsed seconds, a word when it runs long, and Cancel.
 * `steps` advance over `expected` seconds and are phrased as ongoing, since the server doesn't report them.
 */
export function AiWorking({
  label = 'Working',
  steps,
  expected = 24,
  shape,
  startedAt,
  onCancel,
}: {
  label?: string
  steps?: string[]
  expected?: number
  shape?: AiShape
  startedAt?: number
  onCancel?: () => void
}) {
  const [start] = useState(() => startedAt ?? Date.now())
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - start) / 1000))
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [start])
  const blue = useDark() ? '#4d7bff' : '#1f45e0'
  const all = steps?.length ? steps : [label]
  const at = stepAt(elapsed, all.length, expected)
  return (
    <div className="ai-wait">
      <div className="ai-wait__head">
        <ThinkingOrb className="ai-wait__orb" state="working" size={20} color={blue} paused={reduced()} aria-hidden="true" />
        <div className="ai-wait__body">
          {/* One polite live region: it speaks when the step changes and once when the wait runs long, never per second. */}
          <p role="status" className="ai-wait__status">
            <span key={at} className="ai-wait__step shimmer">{all[at]}…</span>
            {elapsed >= SLOW_AFTER && <span className="ai-wait__slow">Still working. This can take up to a minute.</span>}
          </p>
          {all.length > 1 && (
            <span className="ai-wait__dots" aria-hidden="true">
              {all.map((s, i) => (
                <span key={s} className={i === at ? 'is-now' : i < at ? 'is-past' : undefined} />
              ))}
            </span>
          )}
        </div>
        <span className="ai-wait__time tnum" aria-hidden="true">{elapsed}s</span>
        {onCancel && (
          <button type="button" className="btn btn--sm btn--quiet ai-wait__cancel" onClick={onCancel}>
            <X aria-hidden="true" /> Cancel
          </button>
        )}
      </div>
      {shape && <Ghost shape={shape} />}
    </div>
  )
}

const line = (w: number, k: number, sm = false) => <span key={k} className={sm ? 'feed-ghost feed-ghost--sm' : 'feed-ghost'} style={{ width: `${w}%` }} />

function Ghost({ shape }: { shape: AiShape }) {
  return (
    <div className={`ai-wait__ghost ai-wait__ghost--${shape}`} aria-hidden="true">
      {shape === 'verdict' && (
        <>
          <div className="ai-wait__ghost-verdict">
            <span className="feed-ghost ai-wait__ghost-score" />
            <span className="ai-wait__ghost-lines">{[line(45, 0), line(85, 1, true), line(65, 2, true)]}</span>
          </div>
          {[80, 62, 74, 55].map((w, i) => (
            <span key={i} className="ai-wait__ghost-row">
              <span className="feed-ghost ai-wait__ghost-dot" />
              {line(w, 0, true)}
            </span>
          ))}
        </>
      )}
      {shape === 'document' && (
        <>
          <span className="feed-ghost ai-wait__ghost-name" />
          {[90, 75, 85, 60, 80, 70].map((w, i) => line(w, i, true))}
        </>
      )}
      {shape === 'letter' &&
        [[95, 88, 60], [92, 97, 84, 40], [90, 70]].map((p, i) => (
          <span key={i} className="ai-wait__ghost-para">{p.map((w, j) => line(w, j, true))}</span>
        ))}
      {shape === 'list' &&
        [70, 55, 62].map((w, i) => (
          <span key={i} className="ai-wait__ghost-row">
            <span className="feed-ghost feed-ghost--logo" />
            <span className="ai-wait__ghost-lines">{[line(w, 0), line(w - 20, 1, true)]}</span>
          </span>
        ))}
      {shape === 'lines' && [92, 84, 58].map((w, i) => line(w, i, true))}
    </div>
  )
}
