import { useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { api, type Me } from '@/lib/api'
import { MEMORY_KINDS, MEMORY_TEXT_LIMIT, type Memory, type MemoryKind } from '../../shared/types'

const KIND_LABEL: Record<MemoryKind, string> = { goal: 'Goal', preference: 'Preference', constraint: 'Dealbreaker', about: 'About you', style: 'Writing style' }

/** Everything the assistant may use beyond the CV, all of it the seeker's to edit or delete. */
export function MemoryPanel({ me, refreshMe }: { me: Me; refreshMe: () => Promise<void> }) {
  const [kind, setKind] = useState<MemoryKind>('goal')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refreshMe()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && (await run(() => api.addMemory({ kind, text: text.trim() })))) setText('')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (editing?.text.trim() && (await run(() => api.updateMemory(editing.id, { text: editing.text.trim() })))) setEditing(null)
  }

  const memories: Memory[] = me.memories ?? []

  return (
    <section className="profile__group" aria-labelledby="memory-heading">
      <h2 className="profile__h" id="memory-heading">What the assistant knows</h2>
      <p className="profile__note">Only what you wrote here or approved in a chat. Used to personalize answers and drafts; delete anything, any time.</p>
      {memories.length > 0 && (
        <ul className="memory-list">
          {memories.map((m) => (
            <li key={m.id} className="memory-item">
              <span className="label memory-item__kind">{KIND_LABEL[m.kind]}</span>
              {editing?.id === m.id ? (
                <form className="memory-item__edit" onSubmit={save}>
                  <input className="field__input" aria-label="Edit memory" value={editing.text} maxLength={MEMORY_TEXT_LIMIT} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} autoFocus />
                  <button type="submit" className="btn btn--sm btn--ink" disabled={busy}>Save</button>
                  <button type="button" className="btn btn--sm btn--quiet" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <div className="memory-item__row">
                  <p>{m.text}</p>
                  <button type="button" className="btn btn--sm btn--quiet" aria-label={`Edit: ${m.text}`} onClick={() => setEditing({ id: m.id, text: m.text })}>
                    <Pencil aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn--sm btn--quiet" aria-label={`Delete: ${m.text}`} disabled={busy} onClick={() => void run(() => api.deleteMemory(m.id))}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="memory-add" onSubmit={add}>
        <select className="field__input" aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)}>
          {MEMORY_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <input className="field__input" aria-label="Tell the assistant something" placeholder="e.g. No Big Four audit roles" value={text} maxLength={MEMORY_TEXT_LIMIT} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn" disabled={busy || !text.trim()}>Add</button>
      </form>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </section>
  )
}
