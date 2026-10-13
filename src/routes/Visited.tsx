import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { AlertCircle, Check } from 'lucide-react'
import { REPLY_STATUSES, type ContactedPerson, type Person, type ReplyStatus } from '../../shared/types'
import { api } from '../lib/api'
import { Field, TextField } from '../components/Field'
import { useResource } from '../lib/hooks'
import { Badge, GhostBadge } from '../components/Badge'
import { nextStep } from '../lib/followup'

/** Everyone contacted, across searches and added by hand: People → Contacted. */
export function Visited({ trial }: { trial: boolean }) {
  const jobs = useResource(() => (trial ? Promise.resolve([]) : api.jobs().then((r) => r.jobs)), [trial])
  const applicationAt = (company: string) => jobs.data?.find((j) => j.company.trim().toLowerCase() === company.trim().toLowerCase())
  const res = useResource(() => api.contacted().then((r) => r.people), [])
  const people = res.data ?? []

  const onChange = (p: Person) =>
    res.setData((prev) => (prev ? prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)) : prev))
  const onAdded = (p: Person) => res.setData((prev) => [{ ...p, search: null }, ...(prev ?? [])])

  // The browser extension hands over the LinkedIn profile it was opened on (see extension/content-agisse.js).
  // With a name and a company it is saved as contacted; otherwise the form opens prefilled for the user to finish.
  const [draft, setDraft] = useState<Contact | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const { setData } = res
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (e.source !== window || d?.source !== 'agisse-ext' || d.kind !== 'contact') return
      window.postMessage({ source: 'agisse-app', ack: true }, location.origin)
      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
      const c: Contact = { name: str(d.name), title: str(d.title), company: str(d.company), profileUrl: str(d.url) }
      if (!c.name || !c.company) return setDraft(c)
      api.createPerson({ ...c, status: 'contacted' }).then(
        ({ person }) => {
          setData((prev) => [{ ...person, search: null }, ...(prev ?? [])])
          setSaved(person.name)
        },
        () => setDraft(c),
      )
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setData])

  // Keep due people in one place, with a link back to their booth for context.
  const followUp = people.filter((p) => nextStep(p) === 'follow up')
  // Contacts added by hand have no search: they group by their company instead.
  const groups = new Map<string, { search: ContactedPerson['search']; company: string; people: ContactedPerson[] }>()
  for (const p of people) {
    if (nextStep(p) === 'follow up') continue
    const key = p.search?.id ?? `hand:${p.company.trim().toLowerCase()}`
    const g = groups.get(key) ?? { search: p.search, company: p.search?.company ?? p.company, people: [] }
    g.people.push(p)
    groups.set(key, g)
  }

  return (
    <section className="visited" aria-labelledby="visited-title">
      {/* The tab already names the view; the head only earns its line once there is a count to show. */}
      {people.length > 0 ? (
        <div className="section-head">
          <h2 id="visited-title" className="label">Contacted</h2>
          <span className="label label--muted tnum">{people.length} contacted</span>
        </div>
      ) : (
        <h2 id="visited-title" className="sr-only">Contacted</h2>
      )}

      {res.error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{res.error}</span>
        </p>
      )}

      {saved && (
        <p className="notice notice--ok" role="status">
          <Check aria-hidden="true" /> <span>{saved} saved from LinkedIn and marked contacted.</span>
        </p>
      )}
      {!trial && <AddContact key={draft?.profileUrl} draft={draft} onAdded={onAdded} />}

      {res.loading && !res.data ? (
        <div className="badge-grid">
          <GhostBadge rank={1} live />
          <GhostBadge rank={2} live />
        </div>
      ) : people.length === 0 ? (
        <p className="empty-hall__text">Nobody yet. Mark someone contacted and they show up here.</p>
      ) : (
        <>
          {followUp.length > 0 && (
            <section className="visited__group" aria-label="Follow up">
              <div className="visited__group-head">
                <h3 className="display">Follow up</h3>
              </div>
              <div className="badge-grid">
                {followUp.map((p, i) => (
                  <div key={p.id} className="visited__follow-up-item">
                    {p.search ? <Link href={`/s/${p.search.id}`}>{p.search.company} · {p.search.role}</Link> : <span className="muted">{p.company} · added by hand</span>}
                    <Badge person={p} draftingAvailable={!trial && !!p.search} index={i} onChange={onChange} compact />
                  </div>
                ))}
              </div>
            </section>
          )}
          {[...groups].map(([key, { search, company, people }]) => (
            <section key={key} className="visited__group" aria-label={search ? `${company}, ${search.role}` : company}>
              <div className="visited__group-head">
                <h3 className="display">{company}</h3>
                <span className="muted">{search ? search.role : 'Added by hand'}</span>
                {search && <Link href={`/s/${search.id}`}>Open search</Link>}
                {applicationAt(company) && <Link href={`/jobs/${applicationAt(company)!.id}`}>Your application</Link>}
              </div>
              <div className="badge-grid">
                {people.map((p, i) => (
                  <Badge key={p.id} person={p} draftingAvailable={!trial && !!search} index={i} onChange={onChange} compact />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  )
}

/** Someone met outside Agisse (a fair, a friend's intro): stored like a contacted person, without a search. */
type Contact = { name: string; title: string; company: string; profileUrl: string }

function AddContact({ draft, onAdded }: { draft: Contact | null; onAdded: (p: Person) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const text = (k: string) => String(f.get(k) ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      const { person } = await api.createPerson({
        name: text('name'),
        title: text('title'),
        company: text('company'),
        profileUrl: text('profileUrl') || undefined,
        notes: text('notes') || undefined,
        status: text('status') as ReplyStatus,
      })
      onAdded(person)
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the contact.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="index-card__options add-contact" open={!!draft}>
      <summary>
        <span>Add contact</span>
        <span className="index-card__options-hint">Someone you met outside Agisse</span>
      </summary>
      <form className="add-contact__form" onSubmit={(e) => void submit(e)}>
        {draft && (
          <p className="notice" role="status">
            <AlertCircle aria-hidden="true" /> <span>Filled from LinkedIn. Add what is missing, then save. <Link href="/extension">About the extension</Link>.</span>
          </p>
        )}
        <Field id="contact-name" name="name" label="Name" required maxLength={200} autoComplete="off" defaultValue={draft?.name} />
        <Field id="contact-title" name="title" label="Title" hint="optional" maxLength={200} autoComplete="off" defaultValue={draft?.title} />
        <Field id="contact-company" name="company" label="Company" required maxLength={200} autoComplete="off" defaultValue={draft?.company} />
        <Field id="contact-url" name="profileUrl" label="Profile URL" hint="optional" type="url" maxLength={500} defaultValue={draft?.profileUrl} />
        <div className="field">
          <label className="field__label label" htmlFor="contact-status">
            <span>Status</span>
          </label>
          <select id="contact-status" className="field__input" name="status" defaultValue="contacted">
            {REPLY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <TextField id="contact-notes" name="notes" label="Notes" hint="optional" rows={2} maxLength={2000} />
        {error && (
          <p className="notice notice--error" role="alert">
            <AlertCircle aria-hidden="true" /> <span>{error}</span>
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add contact'}
        </button>
      </form>
    </details>
  )
}
