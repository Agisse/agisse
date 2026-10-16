import { AiWorking } from '@/components/AiWorking'
import { Rate } from '@/components/Rate'
import { useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { Check, ClipboardList, Copy, ExternalLink, Highlighter, Mail, MessageSquareText, PenLine, Undo2 } from 'lucide-react'
import type { Person, SharedGround } from '../../shared/types'
import { CONTACT_VALUE_LABEL, NOTE_LANGUAGE_LABEL, NOTE_LANGUAGES, REPLY_STATUSES, type NoteLanguage, type ReplyStatus } from '../../shared/types'
import { nextStep } from '../lib/followup'
import { api } from '../lib/api'
import { formatDate, NoteLimit, useCopy } from '../lib/hooks'
import posthog from '../lib/posthog'

const KIND_LABEL: Record<SharedGround['kind'], string> = {
  university: 'Same school',
  employer: 'Same employer',
  internship: 'Same internship',
  organization: 'Same org',
  interest: 'Shared interest',
  industry: 'Same industry',
  skill: 'Same skill',
  location: 'Same area',
  other: 'In common',
}

type Props = {
  person: Person
  draftingAvailable: boolean
  index?: number
  entering?: boolean
  onChange: (p: Person) => void
  /** Compact rows on the Visited page skip the summary. */
  compact?: boolean
}

export function Badge({ person, draftingAvailable, index = 0, entering = false, onChange, compact = false }: Props) {
  const [flipped, setFlipped] = useState(false)
  // Linked from Today or the board (#p-<id>): scroll to this badge and mark it. :target misses pushState navigations.
  const self = useRef<HTMLElement>(null)
  const [targeted] = useState(() => location.hash === `#p-${person.id}`)
  useEffect(() => {
    if (targeted) self.current?.scrollIntoView({ block: 'center' })
  }, [targeted])
  // The hidden face is inert, so focus follows the flip instead of falling to the page.
  const frontBtn = useRef<HTMLButtonElement>(null)
  const backBtn = useRef<HTMLButtonElement>(null)
  const flip = (to: boolean) => {
    setFlipped(to)
    requestAnimationFrame(() => (to ? backBtn : frontBtn).current?.focus({ preventScroll: true }))
  }
  const [note, setNote] = useState(person.outreach)
  const [saving, setSaving] = useState(false)
  const [writing, setWriting] = useState(false)
  // Which draft `writing` is for, so the right spot shows the working state.
  const [writingWhat, setWritingWhat] = useState<'message' | 'email' | 'follow-up'>('message')
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<NoteLanguage>('en')
  const { copied, copy } = useCopy()
  // Once the note is copied, the next step is marking them contacted: that becomes the one primary action.
  const [copiedOnce, setCopiedOnce] = useState(false)
  const [followup, setFollowup] = useState('')
  const followupCopy = useCopy()
  const [prepping, setPrepping] = useState(false)
  const [email, setEmail] = useState('')
  const emailCopy = useCopy()
  const prepCopy = useCopy()

  // The note is written the first time the badge is flipped, never during the search.
  const write = async (rewrite = false) => {
    setWritingWhat('message')
    setWriting(true)
    setError(null)
    try {
      const { person: updated } = await api.writeOutreach(person.id, rewrite, lang)
      posthog.capture('outreach_generated', {
        is_rewrite: rewrite,
        lang,
        contact_value: person.value,
        rank: person.rank,
        shared_ground_count: person.sharedGround.length,
      })
      onChange({ ...updated, alsoContacted: person.alsoContacted })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write the message')
    } finally {
      setWriting(false)
    }
  }
  const open = () => {
    flip(true)
    if (draftingAvailable && !person.outreach && !writing) void write()
  }

  // Reset the draft when the saved outreach changes underneath us (e.g. reload).
  const [seenOutreach, setSeenOutreach] = useState(person.outreach)
  if (seenOutreach !== person.outreach) {
    setSeenOutreach(person.outreach)
    setNote(person.outreach)
  }

  const contacted = !!person.contactedAt
  const limit = useContext(NoteLimit)
  const step = nextStep(person)
  const over = note.length > limit
  const personProperties = {
    contact_value: person.value,
    rank: person.rank,
    shared_ground_count: person.sharedGround.length,
  }

  const patch = async (p: Parameters<typeof api.updatePerson>[1]) => {
    setSaving(true)
    setError(null)
    try {
      const { person: updated } = await api.updatePerson(person.id, p)
      onChange({ ...updated, alsoContacted: person.alsoContacted })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveNoteIfChanged = () => {
    if (note !== person.outreach) void patch({ outreach: note })
  }

  const markContacted = async () => {
    const ok = await patch({ contacted: !contacted, ...(note !== person.outreach ? { outreach: note } : {}) })
    if (ok) {
      posthog.capture(contacted ? 'person_contact_reopened' : 'person_contacted', personProperties)
      if (!contacted) flip(false)
    }
  }

  const setStatus = async (status: ReplyStatus) => {
    const previous = person.status
    if (await patch({ status })) posthog.capture('person_status_changed', { ...personProperties, status, previous_status: previous })
  }

  const markFollowedUp = async () => {
    if (await patch({ followedUp: true })) {
      posthog.capture('person_followed_up', { ...personProperties, days_since_contact: Math.floor((Date.now() - Date.parse(person.contactedAt!)) / 86_400_000) })
    }
  }

  // A first email instead of a connection note, for when the seeker has their address. Shown to copy, not stored.
  const writeEmail = async () => {
    setWritingWhat('email')
    setWriting(true)
    setError(null)
    try {
      const { email } = await api.personEmail(person.id, lang)
      setEmail(`${email.subject}\n\n${email.body}`)
      posthog.capture('person_email_generated', { ...personProperties, lang })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write the email')
    } finally {
      setWriting(false)
    }
  }

  // One follow-up draft, shown on the badge to copy; the "Followed up" button is what records it.
  const writeFollowup = async () => {
    setWritingWhat('follow-up')
    setWriting(true)
    setError(null)
    try {
      const { followup } = await api.writeFollowup(person.id, lang)
      setFollowup(followup)
      posthog.capture('followup_generated', { ...personProperties, days_since_contact: Math.floor((Date.now() - Date.parse(person.contactedAt!)) / 86_400_000) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write the follow-up')
    } finally {
      setWriting(false)
    }
  }

  // Once they replied: five questions and three talking points for the call, stored on the person.
  const canPrep = person.status === 'replied' || person.status === 'call booked'
  const writePrep = async (rewrite = false) => {
    setPrepping(true)
    setError(null)
    try {
      const { person: updated } = await api.writePrep(person.id, rewrite)
      posthog.capture('prep_generated', { ...personProperties, is_rewrite: rewrite, status: person.status })
      onChange({ ...updated, alsoContacted: person.alsoContacted })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write the prep sheet')
    } finally {
      setPrepping(false)
    }
  }
  const prepText = person.prep
    ? `Questions\n${person.prep.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nTalking points\n${person.prep.talkingPoints.map((t) => `- ${t}`).join('\n')}`
    : ''

  return (
    <article
      ref={self}
      id={`p-${person.id}`}
      className={`badge${flipped ? ' is-flipped' : ''}${contacted ? ' is-contacted' : ''}${entering ? ' is-entering' : ''}${targeted ? ' is-target' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
      aria-label={`${person.rank > 0 ? `${person.rank}. ` : ''}${person.name}, ${person.title}`}
    >
      <div className="badge__inner">
        {/* FRONT: who, why, sources */}
        <div className="badge__face badge__face--front" inert={flipped}>
          <header className="badge__band">
            {person.rank > 0 && (
              <span className="badge__rank tnum" aria-label={`Rank ${person.rank}`} title={`Rank ${person.rank} · contact value ${person.score} of 100`}>
                {person.rank}
              </span>
            )}
            <span className="badge__value">{CONTACT_VALUE_LABEL[person.value]}</span>
            {contacted && (
              <span className="badge__stamp">
                <Highlighter aria-hidden="true" /> Contacted {formatDate(person.contactedAt!)}
              </span>
            )}
          </header>

          <div className="badge__body">
            <h3 className="badge__name">
              <span className="hl">{person.name}</span>
            </h3>
            <p className="badge__title">
              {person.title}
              {person.location ? ` · ${person.location}` : ''}
            </p>

            {person.sharedGround.length > 0 ? (
              <ul className="badge__ground" aria-label="Shared ground">
                {person.sharedGround.map((g, i) => (
                  <li key={i}>
                    <span className="badge__ground-kind">{KIND_LABEL[g.kind]}</span>
                    <span>{g.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="badge__ground--none">No shared ground found in their public profile.</p>
            )}

            <p className="badge__reason">{person.reason}</p>
            {!contacted && person.alsoContacted && (
              <p className="badge__also">
                {person.alsoContacted.searchId ? (
                  <Link href={`/s/${person.alsoContacted.searchId}`}>
                    Contacted {formatDate(person.alsoContacted.contactedAt)} from {person.alsoContacted.number ? `search #${person.alsoContacted.number}` : 'another search'} · {person.alsoContacted.company}
                  </Link>
                ) : (
                  <Link href="/contacts">Contacted {formatDate(person.alsoContacted.contactedAt)}, added by hand · {person.alsoContacted.company}</Link>
                )}
              </p>
            )}
            {!compact && person.summary && <p className="badge__summary">{person.summary}</p>}
            {step && (
              <div className="badge__next">
                <p>{step === 'follow up' ? 'A week without a reply. One short follow-up is fine; more reads as pressure.' : 'Still quiet a week after your follow-up. Mark it and move on.'}</p>
                {draftingAvailable && step === 'follow up' && person.outreach && (
                  <button type="button" className="btn" onClick={() => void writeFollowup()} disabled={writing}>
                    <PenLine aria-hidden="true" /> {writing ? 'Writing…' : followup ? 'Rewrite follow-up' : 'Write follow-up'}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => void (step === 'follow up' ? markFollowedUp() : setStatus('no reply'))} disabled={saving}>
                  {step === 'follow up' ? 'Followed up' : 'Mark no reply'}
                </button>
                {writing && writingWhat === 'follow-up' && <AiWorking steps={['Reading your first message', `Writing a follow-up to ${person.name.split(' ')[0]}`]} expected={15} />}
                {step === 'follow up' && followup && (
                  <>
                    <p className="badge__followup">{followup}</p>
                    <button type="button" className="btn" onClick={() => void followupCopy.copy(followup)}>
                      {followupCopy.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {followupCopy.copied ? 'Copied' : 'Copy follow-up'}
                    </button>
                  </>
                )}
              </div>
            )}
            {canPrep && (draftingAvailable || person.prep) && (
              <div className="badge__next">
                {person.prep ? (
                  <div className="badge__prep">
                    <span className="label">Questions</span>
                    <ol>
                      {person.prep.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                    <span className="label">Talking points</span>
                    <ul>
                      {person.prep.talkingPoints.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>They replied. Prep five questions and three talking points before the call.</p>
                )}
                {prepping && <AiWorking steps={['Reading their profile and the company', 'Writing questions to ask', 'Writing call prep']} expected={20} shape="lines" />}
                {draftingAvailable && (
                  <button type="button" className="btn" onClick={() => void writePrep(!!person.prep)} disabled={prepping}>
                    <ClipboardList aria-hidden="true" /> {prepping ? 'Writing…' : person.prep ? 'Rewrite prep' : 'Write call prep'}
                  </button>
                )}
                {person.prep && (
                  <button type="button" className="btn" onClick={() => void prepCopy.copy(prepText)}>
                    {prepCopy.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {prepCopy.copied ? 'Copied' : 'Copy all'}
                  </button>
                )}
              </div>
            )}
            {/* Front-side failures (mark contacted, status, follow-up, prep) show here, once. */}
            {error && !flipped && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
          </div>

          <footer className="badge__foot">
            {person.profileUrl && (
              <a className="badge__link" href={person.profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture('person_profile_opened', { ...personProperties, source: 'badge_front' })}>
                Open profile <ExternalLink aria-hidden="true" />
              </a>
            )}
            <span style={{ flex: 1 }} />
            {contacted && (
              <select className="badge__status" aria-label={`Reply status for ${person.name}`} value={person.status ?? 'contacted'} onChange={(e) => void setStatus(e.target.value as ReplyStatus)} disabled={saving}>
                {REPLY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'contacted' ? 'Waiting' : s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            )}
            <button ref={frontBtn} type="button" className={`btn${copiedOnce ? '' : ' btn--ink'}`} onClick={open} aria-expanded={flipped}>
              <MessageSquareText aria-hidden="true" /> {person.outreach ? 'Message' : 'Write message'}
            </button>
            {!contacted && (
              <button type="button" className={`btn${copiedOnce ? ' btn--primary' : ''}`} onClick={markContacted} disabled={saving || writing}>
                <Highlighter aria-hidden="true" /> Mark contacted
              </button>
            )}
          </footer>
        </div>

        {/* BACK: the note to send */}
        <div className="badge__face badge__face--back" inert={!flipped}>
          <header className="badge__band badge__band--back">
            <span className="label">Note to send · {person.name.split(' ')[0]}</span>
            <span className={`badge__count tnum${over ? ' is-over' : ''}`} aria-live="polite">
              {note.length} / {limit}
            </span>
          </header>
          <label className="sr-only" htmlFor={`note-${person.id}`}>
            Message for {person.name}
          </label>
          {writing && writingWhat === 'message' ? (
            <div className="badge__note badge__note--writing">
              <AiWorking steps={['Reading their profile', 'Finding what you have in common', `Writing a message to ${person.name.split(' ')[0]}`]} expected={15} />
            </div>
          ) : (
            <textarea
              id={`note-${person.id}`}
              className="badge__note"
              value={note}
              placeholder={error ? '' : draftingAvailable ? 'No message yet. Press Write to draft one.' : 'Write your own message here.'}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNoteIfChanged}
              spellCheck
              aria-invalid={over ? 'true' : undefined}
            />
          )}
          {!draftingAvailable && <p className="badge__draft-hint">Drafting opens after approval. You can still write and copy your own message.</p>}
          {draftingAvailable && person.outreach && !writing && <Rate key={person.outreach} task="agisse_outreach" refId={person.id} />}
          {writing && writingWhat === 'email' && <AiWorking steps={['Reading their profile', `Writing an email to ${person.name.split(' ')[0]}`]} expected={15} />}
          {email && (
            <>
              <p className="badge__followup" style={{ whiteSpace: 'pre-wrap' }}>{email}</p>
              <button type="button" className="btn" onClick={() => void emailCopy.copy(email)}>
                {emailCopy.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {emailCopy.copied ? 'Copied' : 'Copy email'}
              </button>
            </>
          )}
          <footer className="badge__back-foot">
            <button ref={backBtn} type="button" className="btn btn--quiet" onClick={() => flip(false)} aria-label="Back to the person">
              <Undo2 aria-hidden="true" /> Back
            </button>
            <button type="button" className={`btn${copiedOnce || contacted ? '' : ' btn--primary'}`} onClick={() => { void copy(note); setCopiedOnce(true); posthog.capture('outreach_copied', personProperties) }} disabled={!note || writing}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
            </button>
            {person.profileUrl && (
              <a className="btn" href={person.profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture('person_profile_opened', { ...personProperties, source: 'badge_back' })}>
                Open profile <ExternalLink aria-hidden="true" />
              </a>
            )}
            <button type="button" className={`btn btn--mark${copiedOnce && !contacted ? ' btn--primary' : ''}`} onClick={markContacted} disabled={saving || writing}>
              <Highlighter aria-hidden="true" /> {contacted ? 'Undo contacted' : 'Mark contacted'}
            </button>
            {draftingAvailable && (
              <details className="badge__more">
                <summary>More</summary>
                <div className="badge__more-actions">
                  <select className="badge__status" aria-label="Message language" value={lang} onChange={(e) => setLang(e.target.value as NoteLanguage)} disabled={writing}>
                    {NOTE_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {NOTE_LANGUAGE_LABEL[l]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn" onClick={() => write(true)} disabled={writing} title="Draft the message again">
                    <PenLine aria-hidden="true" /> {person.outreach ? 'Rewrite' : 'Write'}
                  </button>
                  <button type="button" className="btn" onClick={() => void writeEmail()} disabled={writing} title="Draft a longer email instead of a LinkedIn note">
                    <Mail aria-hidden="true" /> {email ? 'Email again' : 'Email instead'}
                  </button>
                </div>
              </details>
            )}
            {over && (
              <p className="field__error" role="alert">
                LinkedIn connection notes stop at {limit} characters. Trim {note.length - limit}.
              </p>
            )}
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
          </footer>
        </div>
      </div>
    </article>
  )
}

export function GhostBadge({ rank, live = false }: { rank: number; live?: boolean }) {
  return (
    <div className={`badge badge--ghost${live ? ' is-live' : ''}`} aria-hidden="true">
      <div className="badge__inner">
        <div className="badge__face">
          <header className="badge__band">
            <span className="badge__rank">{rank}</span>
          </header>
          <div className="badge__body">
            <div className="ghost-line" style={{ width: '58%', height: 18 }} />
            <div className="ghost-line" style={{ width: '42%' }} />
            <div className="ghost-line" style={{ width: '70%', marginTop: 4 }} />
            <div className="ghost-line" style={{ width: '92%' }} />
            <div className="ghost-line" style={{ width: '80%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
