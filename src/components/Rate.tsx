import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { RatedTask } from '../../shared/types'
import { api } from '../lib/api'
import posthog from '../lib/posthog'

/** Thumbs up or down on one generated output. The server rates its latest generation; key this by the output so a rewrite starts unrated. */
export function Rate({ task, refId }: { task: RatedTask; refId: string }) {
  const [good, setGood] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(value: boolean, withNote = '') {
    setGood(value)
    setError('')
    try {
      await api.feedback({ task, refId, good: value, note: withNote || undefined })
      if (withNote) setSent(true)
      else posthog.capture('output_rated', { task, good: value })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the rating')
    }
  }

  return (
    <div className="rate">
      <span className="rate__label">Useful?</span>
      <button type="button" className={`btn btn--quiet rate__btn${good === true ? ' is-on' : ''}`} aria-pressed={good === true} aria-label="Useful" onClick={() => send(true)}>
        <ThumbsUp aria-hidden="true" />
      </button>
      <button type="button" className={`btn btn--quiet rate__btn${good === false ? ' is-on' : ''}`} aria-pressed={good === false} aria-label="Not useful" onClick={() => send(false)}>
        <ThumbsDown aria-hidden="true" />
      </button>
      {good === false && !sent && (
        <form
          className="rate__note"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim()) void send(false, note.trim())
          }}
        >
          <input className="field__input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What was off? Your next drafts take it into account." aria-label="What was off" />
          <button type="submit" className="btn" disabled={!note.trim()}>
            Send
          </button>
        </form>
      )}
      {sent && <span className="rate__label">Thanks, noted.</span>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
