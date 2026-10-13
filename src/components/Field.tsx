import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Base = { label: string; hint?: string; error?: string | null; id: string }

export function Field({ label, hint, error, id, ...input }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label className="field__label label" htmlFor={id}>
        <span>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      <input id={id} className="field__input" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {error && (
        <p id={`${id}-err`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, id, ...input }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <label className="field__label label" htmlFor={id}>
        <span>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      <textarea id={id} className="field__input" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {error && (
        <p id={`${id}-err`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
