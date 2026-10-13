import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { Shimmer } from '@/components/ai-elements/shimmer'

/** Shown while the AI works on something: what it is doing, elapsed seconds, and Cancel. */
export function AiWorking({ label = 'Working', startedAt, onCancel }: { label?: string; startedAt?: number; onCancel?: () => void }) {
  const [start] = useState(() => startedAt ?? Date.now())
  const [elapsed, setElapsed] = useState(0)
  const still = useReducedMotion()
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [start])
  const text = `${label}…`
  return (
    <p className="booth__status ai-working" role="status">
      <Sparkles aria-hidden="true" className="ai-working__icon" />
      <span>{still ? text : <Shimmer as="span">{text}</Shimmer>}</span>
      <span className="tnum" aria-hidden="true">{elapsed}s</span>
      {onCancel && (
        <button type="button" className="btn btn--sm btn--quiet" onClick={onCancel}>
          <X aria-hidden="true" /> Cancel
        </button>
      )}
    </p>
  )
}
