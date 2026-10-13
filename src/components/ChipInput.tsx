import { useId, useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'

type Props = { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; onDraftChange?: (v: string) => void; commitOnBlur?: boolean; placeholder?: string; id?: string; error?: string | null; autoFocus?: boolean }

/** A list field: type a value, press Enter or Add; each entry becomes a removable chip. */
export function ChipInput({ label, hint, values, onChange, onDraftChange, commitOnBlur = true, placeholder, id: idProp, error, autoFocus }: Props) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setDraft('')
    onDraftChange?.('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="field">
      <label className="field__label label" htmlFor={id}>
        <span>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      {values.length > 0 && (
        <ul className="chips" aria-label={`${label} entries`}>
          {values.map((v) => (
            <li key={v} className="chip">
              {v}
              <button type="button" className="chip__x" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="chip-input">
        <div className="field">
          <input id={id} autoFocus={autoFocus} className="field__input" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} value={draft} placeholder={placeholder} onChange={(e) => { setDraft(e.target.value); onDraftChange?.(e.target.value) }} onKeyDown={onKey} onBlur={commitOnBlur ? add : undefined} />
        </div>
        <button type="button" className="btn" onClick={add} aria-label={`Add to ${label}`}>
          <Plus /> Add
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
