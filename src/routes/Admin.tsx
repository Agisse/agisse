import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Check } from 'lucide-react'
import { api, type AccessStatus, type AdminToday, type AdminUser, type Invite } from '../lib/api'
import { BudgetMeter } from '../components/BudgetMeter'
import { MIN_N, type Bucket, type QualityReport } from '../../shared/quality'

const order: Record<AccessStatus, number> = { pending: 0, approved: 1, rejected: 2 }

export function Admin({ onBudgetChange }: { onBudgetChange: () => Promise<void> }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [today, setToday] = useState<AdminToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<AccessStatus | 'all'>('all')

  const load = async () => {
    try { const r = await api.adminUsers(); setUsers(r.users); setToday(r.today); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load accounts.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const setAccess = async (user: AdminUser, status: AccessStatus) => {
    setBusyId(user.id)
    setError(null)
    try {
      await api.setAccess(user.id, status)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accessStatus: status, reviewedAt: status === 'pending' ? null : new Date().toISOString() } : item))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update access.') }
    finally { setBusyId(null) }
  }

  const setBudget = async (user: AdminUser, budgetEur: number | null) => {
    setBusyId(user.id)
    setError(null)
    try {
      await api.setBudget(user.id, budgetEur)
      await load()
      // The admin's own meter in the strip reads from /api/me.
      if (user.isAdmin) await onBudgetChange()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the budget.') }
    finally { setBusyId(null) }
  }

  const setReferralCredit = async (user: AdminUser, eur: number | null) => {
    setBusyId(user.id)
    setError(null)
    try {
      const { user: saved } = await api.setReferralCredit(user.id, eur)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, referralCreditEur: saved.referralCreditEur } : item))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the credit.') }
    finally { setBusyId(null) }
  }

  const visible = users.filter((u) => filter === 'all' || u.accessStatus === filter).sort((a, b) => order[a.accessStatus] - order[b.accessStatus] || b.createdAt.localeCompare(a.createdAt))
  const count = (status: AccessStatus) => users.filter((u) => u.accessStatus === status).length

  return <main className="admin-page">
    <header className="admin-page__head">
      <div>
        <h1 className="display">Guest list</h1>
        <p className="admin-page__today tnum">{today ? todayLine(today) : '\u00a0'}</p>
      </div>
      <button type="button" className="btn btn--quiet" onClick={() => void load()} disabled={loading}>Refresh</button>
    </header>
    <Invites />
    <h2 className="admin-page__section">Accounts</h2>
    <div className="admin-page__filters" role="group" aria-label="Filter accounts">
      {(['pending', 'approved', 'rejected', 'all'] as const).map((item) => <button key={item} type="button" className="admin-page__filter" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)} <span>{loading ? null : item === 'all' ? users.length : count(item)}</span></button>)}
    </div>
    {error && <p className="field__error" role="alert">{error}</p>}
    {loading ? <AccountsGhost /> : visible.length === 0 ? <p className="admin-page__empty">{filter === 'pending' ? 'No requests are waiting for approval.' : 'No accounts in this view.'}</p> : <ul className="admin-page__list">
      {visible.map((user) => <li className="admin-page__row" key={user.id}>
        <div className="admin-page__identity"><strong>{user.name}</strong><span>{user.email}</span><small>Joined {new Date(user.createdAt).toLocaleDateString()}</small>{user.feedCapDays > 0 && <small>Hit the feed limit {times(user.feedCapDays)} in 30 days</small>}{user.freeLimitDays > 0 && <small>Hit the free AI limit {times(user.freeLimitDays)} in 30 days</small>}</div>
        <span className={`admin-page__status admin-page__status--${user.accessStatus}`}>{user.isAdmin ? 'Administrator' : user.accessStatus}</span>
        <BudgetForm key={user.budget.limit} user={user} busy={busyId === user.id} onSave={(n) => void setBudget(user, n)} />
        <div className="admin-page__actions">
          {user.isAdmin && <CreditForm key={user.referralCreditEur} user={user} busy={busyId === user.id} onSave={(n) => void setReferralCredit(user, n)} />}
          {!user.isAdmin && user.accessStatus !== 'approved' && <button className="btn btn--primary" disabled={busyId === user.id} onClick={() => void setAccess(user, 'approved')}>Approve</button>}
          {!user.isAdmin && user.accessStatus !== 'rejected' && <button className="btn" disabled={busyId === user.id} onClick={() => void setAccess(user, 'rejected')}>Decline</button>}
          {!user.isAdmin && user.accessStatus === 'approved' && <button className="btn" disabled={busyId === user.id} onClick={() => void setAccess(user, 'pending')}>Revoke access</button>}
          {!user.isAdmin && <AccountData user={user} onDeleted={() => setUsers((current) => current.filter((item) => item.id !== user.id))} />}
        </div>
      </li>)}
    </ul>}
    <Quality />
  </main>
}

const times = (n: number) => (n === 1 ? 'once' : `${n} times`)

const usd = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Everyone's AI use today on the server's key, against the daily limits that pause it. */
const todayLine = (t: AdminToday) =>
  `Today: ${usd(t.usd)}${t.usdCap ? ` of ${usd(t.usdCap)}` : ''} spent · ${t.actions.toLocaleString()}${t.actionsCap ? ` of ${t.actionsCap.toLocaleString()}` : ''} free actions`

/** Account rows while the list loads, each placeholder the height of the line it stands for. */
function AccountsGhost() {
  return <><ul className="admin-page__list" aria-busy="true">
    {[0, 1, 2].map((i) => <li key={i} className="admin-page__row admin-page__ghost" aria-hidden="true">
      <div className="admin-page__identity"><span className="feed-ghost admin-page__ghost-name" /><span className="feed-ghost admin-page__ghost-email" /><span className="feed-ghost admin-page__ghost-date" /></div>
      <span className="feed-ghost admin-page__ghost-status" />
      <div className="admin-page__budget">
        <div className="meter"><span className="feed-ghost admin-page__ghost-label" /><span className="feed-ghost admin-page__ghost-bar" /></div>
        <span className="feed-ghost admin-page__ghost-date" />
        <span className="feed-ghost admin-page__ghost-btn" />
      </div>
      <div className="admin-page__actions"><span className="feed-ghost admin-page__ghost-btn" /></div>
    </li>)}
  </ul><p className="sr-only" role="status">Loading accounts</p></>
}

/** A user's GDPR request by email: the same export and erasure they have in Profile, each confirmed first and logged. */
function AccountData({ user, onDeleted }: { user: AdminUser; onDeleted: () => void }) {
  const [armed, setArmed] = useState<'export' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const erase = async () => {
    setBusy(true)
    setError(null)
    try { await api.deleteAccount(user.id); onDeleted() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the account.'); setBusy(false) }
  }
  if (!armed) return <>
    <button type="button" className="btn btn--sm btn--quiet" onClick={() => setArmed('export')}>Export data…</button>
    <button type="button" className="btn btn--sm btn--quiet" onClick={() => setArmed('delete')}>Delete…</button>
  </>
  return <div className="admin-page__confirm" role="group" aria-label={`${armed === 'export' ? 'Export' : 'Delete'} ${user.name}'s data`}>
    <span>{armed === 'export' ? `Download everything ${user.name} saved? This is logged.` : `Erase ${user.name}'s account, CV and everything saved? It cannot be undone, and it is logged.`}</span>
    {armed === 'export'
      ? <a className="btn btn--sm" href={`/api/admin/users/${encodeURIComponent(user.id)}/export`} download onClick={() => setArmed(null)}>Download</a>
      : <button type="button" className="btn btn--sm btn--danger" onClick={() => void erase()} disabled={busy}>{busy ? 'Deleting…' : 'Delete forever'}</button>}
    <button type="button" className="btn btn--sm btn--quiet" onClick={() => setArmed(null)} disabled={busy}>Cancel</button>
    {error && <span className="field__error" role="alert">{error}</span>}
  </div>
}

function BudgetForm({ user, busy, onSave }: { user: AdminUser; busy: boolean; onSave: (budgetEur: number | null) => void }) {
  const [value, setValue] = useState(String(user.budget.limit))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(value)
    if (value.trim() && Number.isFinite(n) && n >= 0) onSave(Math.round(n * 100) / 100)
  }
  return <form className="admin-page__budget" onSubmit={submit}>
    <BudgetMeter budget={user.budget} />
    <small className="admin-page__cost tnum">Our cost {user.budget.cost.toLocaleString(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 })} · {user.actions === 1 ? '1 action' : `${user.actions.toLocaleString()} actions`} · {user.budget.tokens.toLocaleString()} tokens{user.creditGrantedEur !== null && ` · ${eur(user.creditEur ?? 0)} of ${eur(user.creditGrantedEur)} credit left`}</small>
    <div className="admin-page__budget-edit">
      <label className="sr-only" htmlFor={`budget-${user.id}`}>Monthly budget in euros for {user.name}</label>
      <input id={`budget-${user.id}`} className="field__input tnum" type="number" min={0} step={0.5} value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn btn--sm" disabled={busy || value === String(user.budget.limit)}>Set budget</button>
      {user.budgetEur !== null && <button type="button" className="btn btn--sm btn--quiet" disabled={busy} onClick={() => onSave(null)}>Use default</button>}
    </div>
  </form>
}

/** The one-time credit each friend gets when they join with this admin's share link. */
function CreditForm({ user, busy, onSave }: { user: AdminUser; busy: boolean; onSave: (eur: number | null) => void }) {
  const [value, setValue] = useState(user.referralCreditEur === null ? '' : String(user.referralCreditEur))
  const n = euros(value)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (n !== undefined) onSave(n)
  }
  return <form className="admin-page__budget-edit" onSubmit={submit}>
    <label className="sr-only" htmlFor={`ref-credit-${user.id}`}>One-time credit in euros for each friend who joins with {user.name}'s share link</label>
    <input id={`ref-credit-${user.id}`} className="field__input tnum" type="number" min={0} max={100} step={0.5} placeholder="Credit €" value={value} onChange={(e) => setValue(e.target.value)} />
    <button className="btn btn--sm" disabled={busy || n === undefined || n === user.referralCreditEur}>Set friend credit</button>
  </form>
}

/** Euros from an optional field: null when empty or 0, undefined when not a valid amount (over €100 included). */
const euros = (value: string): number | null | undefined => {
  if (!value.trim()) return null
  const n = Math.round(Number(value) * 100) / 100
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n || null : undefined
}

const eur = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })

const inviteLink = (code: string) => `${window.location.origin}/?invite=${encodeURIComponent(code)}`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Invites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [note, setNote] = useState('')
  const [credit, setCredit] = useState('')
  const [fresh, setFresh] = useState<Invite | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { api.invites().then((r) => setInvites(r.invites), (e) => setError(e instanceof Error ? e.message : 'Could not load invites.')) }, [])

  // quiet: the automatic copy after making a link fails silently; the link is on screen anyway.
  const copy = async (code: string, quiet = false) => {
    try { await navigator.clipboard.writeText(inviteLink(code)); setCopied(code) }
    catch { if (!quiet) setError('Copying was blocked. Select the link and copy it by hand.') }
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return setError('Say who the invite is for, so you know who joined.')
    const creditEur = euros(credit)
    if (creditEur === undefined) return setError('Give a credit between €0 and €100, or leave it empty.')
    setBusy('new')
    setError(null)
    try {
      const { invite } = await api.createInvite(note.trim(), creditEur)
      setInvites((current) => [invite, ...current])
      setFresh(invite)
      setNote('')
      setCredit('')
      await copy(invite.code, true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not make the invite.') }
    finally { setBusy(null) }
  }

  const revoke = async (invite: Invite) => {
    setBusy(invite.code)
    setError(null)
    try {
      await api.revokeInvite(invite.code)
      setInvites((current) => current.map((i) => i.code === invite.code ? { ...i, revokedAt: new Date().toISOString() } : i))
      if (fresh?.code === invite.code) setFresh(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not withdraw the invite.') }
    finally { setBusy(null) }
  }

  const open = invites.filter((i) => !i.usedAt && !i.revokedAt).length

  return <section className="invites" aria-labelledby="invites-title">
    <h2 id="invites-title" className="admin-page__section">Invites <span className="tnum">{open} open</span></h2>
    <form className="invites__new" onSubmit={create} noValidate>
      <label className="sr-only" htmlFor="invite-note">Who is this invite for</label>
      <input id="invite-note" className="field__input" placeholder="Who is it for? e.g. Sara, thesis group" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
      <label className="sr-only" htmlFor="invite-credit">One-time AI credit in euros, optional</label>
      <input id="invite-credit" className="field__input tnum invites__credit" type="number" min={0} max={100} step={0.5} placeholder="Credit €" value={credit} onChange={(e) => setCredit(e.target.value)} />
      <button className="btn btn--primary" disabled={busy === 'new'}>{busy === 'new' ? 'Making…' : 'Make invite link'}</button>
    </form>
    {fresh && <div className="invites__fresh" role="status">
      <p>Link for <strong>{fresh.note}</strong>{copied === fresh.code ? ', copied to your clipboard. Send it yourself; it works once.' : '. Send it yourself; it works once.'}</p>
      <div className="invites__link">
        <input className="tnum" readOnly value={inviteLink(fresh.code)} aria-label={`Invite link for ${fresh.note}`} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn--sm btn--ink" onClick={() => void copy(fresh.code)}>{copied === fresh.code ? <><Check aria-hidden="true" /> Copied</> : <><Copy aria-hidden="true" /> Copy</>}</button>
      </div>
    </div>}
    {error && <p className="field__error" role="alert">{error}</p>}
    {invites.length > 0 && <ul className="invites__list">
      {invites.map((invite) => {
        const state = invite.usedAt ? 'used' : invite.revokedAt ? 'withdrawn' : 'open'
        return <li key={invite.code} className={`invites__row invites__row--${state}`}>
          <div className="invites__who"><strong>{invite.note}</strong><small>Made {shortDate(invite.createdAt)}{invite.creditEur ? ` · ${eur(invite.creditEur)} credit` : ''}</small></div>
          <span className={`admin-page__status admin-page__status--${state === 'used' ? 'approved' : state === 'withdrawn' ? 'rejected' : 'pending'}`}>
            {state === 'used' ? `Joined ${shortDate(invite.usedAt!)}` : state === 'withdrawn' ? 'Withdrawn' : 'Open'}
          </span>
          <span className="invites__detail">{state === 'used' ? `${invite.usedByEmail ?? 'Account deleted'}${invite.creditEur && invite.creditUsedEur !== null ? ` · ${eur(invite.creditUsedEur)} of credit used` : ''}` : null}</span>
          <div className="admin-page__actions">
            {state === 'open' && <>
              <button type="button" className="btn btn--sm" onClick={() => void copy(invite.code)}>{copied === invite.code ? 'Copied' : 'Copy link'}</button>
              <button type="button" className="btn btn--sm btn--quiet" disabled={busy === invite.code} onClick={() => void revoke(invite)}>Withdraw</button>
            </>}
          </div>
        </li>
      })}
    </ul>}
  </section>
}

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)

/** How generated outputs fare per task, prompt version and model; loaded when opened. Same data as `npm run quality`. */
function Quality() {
  const [report, setReport] = useState<QualityReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => { if (!report) api.quality().then((r) => setReport(r.report), (e) => setError(e instanceof Error ? e.message : 'Could not load the quality report.')) }
  const buckets = (title: string, rows: Bucket[]) => <table className="quality__table">
    <caption>{title}</caption>
    <thead><tr><th>Bucket</th><th>n</th><th>Hits</th><th>Rate</th></tr></thead>
    <tbody>{rows.map((b) => <tr key={b.bucket}><td>{b.bucket}</td><td className="tnum">{b.n}</td><td className="tnum">{b.hits}</td><td className="tnum">{b.rate === null ? `n < ${MIN_N}` : pct(b.rate)}</td></tr>)}</tbody>
  </table>
  return <details className="quality" onToggle={(e) => { if (e.currentTarget.open) load() }}>
    <summary className="admin-page__section">Quality</summary>
    {error && <p className="field__error" role="alert">{error}</p>}
    {!report && !error && <p role="status">Loading the quality report…</p>}
    {report && <>
      <div className="quality__scroll"><table className="quality__table">
        <caption>Since {new Date(report.since).toLocaleDateString()}, per task, prompt version and model</caption>
        <thead><tr><th>Task</th><th>Prompt</th><th>Model</th><th>n</th><th>Failover</th><th>Flagged</th><th>Up</th><th>Down</th><th>Edited</th><th>Sent</th><th>Top flags</th></tr></thead>
        <tbody>{report.prompts.map((p) => <tr key={`${p.task}${p.prompt}${p.model}`}>
          <td>{p.task.replace(/^agisse_/, '')}</td><td className="tnum">{p.prompt}</td><td>{p.model}</td><td className="tnum">{p.n}</td>
          <td className="tnum">{pct(p.failover)}</td><td className="tnum">{pct(p.flagged)}</td><td className="tnum">{p.up}</td><td className="tnum">{p.down}</td>
          <td className="tnum">{pct(p.edited)}</td><td className="tnum">{pct(p.contacted)}</td>
          <td>{Object.entries(p.flags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="quality__scroll">{buckets('Evaluation score → progressed (responded or further)', report.scoreCalibration)}</div>
      <div className="quality__scroll">{buckets('Person rank → replied (contacted over a week ago)', report.rankCalibration)}</div>
      <h3 className="label">Latest thumbs-down notes</h3>
      {report.complaints.length ? <ul className="quality__notes">{report.complaints.map((c, i) => <li key={i}><small>{new Date(c.at).toLocaleDateString()} · {c.task.replace(/^agisse_/, '')} · {c.model ?? '?'}</small> {c.note}</li>)}</ul> : <p className="admin-page__empty">None yet.</p>}
    </>}
  </details>
}
