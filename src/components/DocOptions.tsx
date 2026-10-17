import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { NOTE_LANGUAGE_LABEL, NOTE_LANGUAGES, type NoteLanguage } from '../../shared/types'
import { TextField } from './Field'

export type DocAsk = { note: string; lang: NoteLanguage }

/** A menu that writes the CV or letter again with the seeker's own instructions; cover letters also pick a language. */
export function DocOptions({ id, label, action, withLang, disabled, onRun }: { id: string; label: ReactNode; action: string; withLang?: boolean; disabled?: boolean; onRun: (ask: DocAsk) => void }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [note, setNote] = useState('')
  const [lang, setLang] = useState<NoteLanguage>('en')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ref.current?.removeAttribute('open')
    onRun({ note: note.trim(), lang })
  }
  return (
    <details className="feed-menu" ref={ref}>
      <summary className="btn btn--quiet" aria-disabled={disabled || undefined}>{label}</summary>
      <form className="feed-menu__panel feed-menu__panel--wide" onSubmit={submit}>
        {withLang && (
          <label className="field" htmlFor={`${id}-lang`}>
            <span className="field__label label">Language</span>
            <select id={`${id}-lang`} className="field__input" value={lang} onChange={(e) => setLang(e.target.value as NoteLanguage)}>
              {NOTE_LANGUAGES.map((l) => <option key={l} value={l}>{NOTE_LANGUAGE_LABEL[l]}</option>)}
            </select>
          </label>
        )}
        <TextField
          id={`${id}-note`}
          label="What to change"
          hint="optional"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Lead with my thesis project. More formal. Mention I can start in March."
        />
        <button type="submit" className="btn btn--primary" disabled={disabled}>{action}</button>
      </form>
    </details>
  )
}
