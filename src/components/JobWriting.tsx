import { useState, type FormEvent } from 'react'
import { AlertCircle, Check, Copy, Mail, MessageSquareText } from 'lucide-react'
import { NOTE_LANGUAGE_LABEL, NOTE_LANGUAGES, type DraftedEmail, type Job, type NoteLanguage } from '../../shared/types'
import { api } from '../lib/api'
import { useCopy } from '../lib/hooks'
import { Field, TextField } from './Field'
import { AiWorking } from './AiWorking'
import posthog from '../lib/posthog'

type Props = { job: Job; disabled: boolean; onSpend: () => Promise<void> }

/** The Write tab: answers to application-form questions and short emails about this application. Nothing here is stored. */
export function JobWriting(props: Props) {
  return (
    <>
      <FormAnswer {...props} />
      <ApplicationEmail {...props} />
    </>
  )
}

function FormAnswer({ job, disabled, onSpend }: Props) {
  const [question, setQuestion] = useState('')
  const [maxChars, setMaxChars] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const limit = Number.parseInt(maxChars, 10)
      const r = await api.answerQuestion(job.id, question.trim(), Number.isFinite(limit) ? limit : null)
      setAnswer(r.answer)
      posthog.capture('form_answer_written', { has_limit: Number.isFinite(limit), score: job.score })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer the question')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <details className="posting__block posting__fold">
      <summary className="label">Answer an application question</summary>
      <p className="muted">Answers use only what your CV says; anything it can't know is left as a [placeholder].</p>
      <form onSubmit={submit}>
        <TextField id="answer-question" label="Question" rows={3} required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Why do you want to work at this company?" />
        <Field id="answer-limit" label="Character limit" hint="optional" inputMode="numeric" value={maxChars} onChange={(e) => setMaxChars(e.target.value.replace(/\D/g, ''))} />
        <div className="posting__actions">
          <button type="submit" className="btn" disabled={busy || disabled || question.trim().length < 3}>
            <MessageSquareText aria-hidden="true" /> {answer ? 'Answer again' : 'Draft an answer'}
          </button>
        </div>
      </form>
      {busy && <AiWorking steps={['Reading the question', 'Finding what your CV can back', 'Writing the answer']} expected={15} shape="lines" />}
      {error && <p className="notice notice--error" role="alert"><AlertCircle aria-hidden="true" /> <span>{error}</span></p>}
      {answer && !busy && (
        <>
          <TextField id="answer-text" label={`Answer · ${answer.length} characters`} rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="posting__actions">
            <button type="button" className="btn" onClick={() => void copy(answer)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy answer'}
            </button>
          </div>
        </>
      )}
    </details>
  )
}

function ApplicationEmail({ job, disabled, onSpend }: Props) {
  const [kind, setKind] = useState<'followup' | 'thankyou'>(job.status === 'interview' ? 'thankyou' : 'followup')
  const [lang, setLang] = useState<NoteLanguage>('en')
  const [notes, setNotes] = useState('')
  const [email, setEmail] = useState<DraftedEmail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.jobEmail(job.id, { kind, lang, notes: notes.trim() })
      setEmail(r.email)
      posthog.capture('job_email_written', { kind, lang, status: job.status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write the email')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <details className="posting__block posting__fold">
      <summary className="label">Write a follow-up or thank-you email</summary>
      <form onSubmit={submit}>
        <div className="index-card__row">
          <label className="field" htmlFor="email-kind">
            <span className="field__label label">Kind</span>
            <select id="email-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="followup">Follow up on my application</option>
              <option value="thankyou">Thank you after an interview</option>
            </select>
          </label>
          <label className="field" htmlFor="email-lang">
            <span className="field__label label">Language</span>
            <select id="email-lang" className="field__input" value={lang} onChange={(e) => setLang(e.target.value as NoteLanguage)}>
              {NOTE_LANGUAGES.map((l) => <option key={l} value={l}>{NOTE_LANGUAGE_LABEL[l]}</option>)}
            </select>
          </label>
        </div>
        <TextField
          id="email-notes"
          label={kind === 'thankyou' ? 'Who you met and what came up' : 'Anything to mention'}
          hint="optional"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={kind === 'thankyou' ? 'e.g. Sofie, team lead; we talked about the pricing dashboard' : ''}
        />
        <div className="posting__actions">
          <button type="submit" className="btn" disabled={busy || disabled}>
            <Mail aria-hidden="true" /> {email ? 'Write again' : 'Write the email'}
          </button>
        </div>
      </form>
      {busy && <AiWorking steps={['Reading the posting', 'Writing the email']} expected={15} shape="letter" />}
      {error && <p className="notice notice--error" role="alert"><AlertCircle aria-hidden="true" /> <span>{error}</span></p>}
      {email && !busy && (
        <>
          <Field id="email-subject" label="Subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
          <TextField id="email-body" label="Body" rows={10} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} />
          <div className="posting__actions">
            <button type="button" className="btn" onClick={() => void copy(`${email.subject}\n\n${email.body}`)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy email'}
            </button>
          </div>
        </>
      )}
    </details>
  )
}
