import { useEffect, useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { EMPTY_PROFILE, type AiProvider, type Profile } from '../../shared/types'
import { ANSWER_FIELDS } from '../../shared/answer-bank'
import { api, profileIsEmpty, type Me } from '../lib/api'
import { Field, TextField } from '../components/Field'
import { ChipInput } from '../components/ChipInput'
import { ResumeImport } from '../components/ResumeImport'
import { BudgetMeter } from '../components/BudgetMeter'
import { MemoryPanel } from '../components/MemoryPanel'
import { Link } from 'wouter'
import { mergeResume } from '../lib/profile'
import posthog from '../lib/posthog'
import { authClient } from '../lib/auth-client'

const eur = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })

export function ProfileRoute({ me, refreshMe }: { me: Me; refreshMe: () => Promise<void> }) {
  const [p, setP] = useState<Profile>({ ...EMPTY_PROFILE, ...(me.profile ?? {}) })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Filled from the résumé but not saved yet; the fields only count once saved.
  const [unsaved, setUnsaved] = useState(false)
  // Saved from a blank profile: point on to the next first-run step.
  const [firstSave, setFirstSave] = useState(false)
  const [more, setMore] = useState(() => moreCount(p) > 0)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false)
    setP((x) => ({ ...x, [k]: v }))
  }
  const fillFromResume = (fromResume: Profile) => {
    const { profile, filled } = mergeResume(p, fromResume)
    setSaved(false)
    setP(profile)
    if (filled > 0) setUnsaved(true)
    if (moreCount(profile) > moreCount(p)) setMore(true) // show what the résumé filled behind the fold
    return filled
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { profile } = await api.saveProfile(p)
      posthog.capture('profile_saved', {
        has_university: Boolean(profile.university),
        employer_count: profile.employers.length,
        internship_count: profile.internships.length,
        organization_count: profile.organizations.length,
        skill_count: profile.skills.length,
        has_background: Boolean(profile.background),
      })
      setP(profile)
      setSaved(true)
      setUnsaved(false)
      setFirstSave(profileIsEmpty(me))
      await refreshMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="map profile-page">
      <header className="profile-page__head">
        <h1 className="display profile-page__title">Profile &amp; settings</h1>
        <p className="muted">Private. Used only to find shared ground and draft your notes.</p>
      </header>

      <form className="profile__form" onSubmit={submit} noValidate>
        <ResumeImport onExtracted={fillFromResume} />

        <section className="profile__group" aria-labelledby="about-heading">
          <h2 className="profile__h" id="about-heading">About you</h2>
          <Field id="headline" label="Headline" placeholder="e.g. Final-year CS student, KU Leuven" value={p.headline} onChange={(e) => set('headline', e.target.value)} />
          <Field id="university" label="University" placeholder="e.g. KU Leuven" value={p.university} onChange={(e) => set('university', e.target.value)} autoComplete="organization" />
          <div className="index-card__row">
            <Field id="degree" label="Degree" placeholder="e.g. MSc Computer Science" value={p.degree} onChange={(e) => set('degree', e.target.value)} />
            <Field id="gradYear" label="Graduation year" placeholder="e.g. 2026" value={p.gradYear} onChange={(e) => set('gradYear', e.target.value)} inputMode="numeric" />
          </div>
        </section>

        <section className="profile__group" aria-labelledby="experience-heading">
          <h2 className="profile__h" id="experience-heading">Experience</h2>
          <ChipInput label="Employers" hint="Enter after each" values={p.employers} onChange={(v) => set('employers', v)} placeholder="e.g. Colruyt Group" />
          <ChipInput label="Internships" values={p.internships} onChange={(v) => set('internships', v)} placeholder="e.g. Deloitte" />
          <ChipInput label="Organizations" hint="societies, clubs, volunteering" values={p.organizations} onChange={(v) => set('organizations', v)} placeholder="e.g. AFC Leuven" />
        </section>

        <details className="index-card__options profile__more" open={more} onToggle={(e) => setMore(e.currentTarget.open)}>
          <summary>
            <span>Skills, interests, background</span>
            <span className="index-card__options-hint">{moreCount(p) ? `${moreCount(p)} filled` : 'Optional'}</span>
          </summary>
          <div className="index-card__options-fields">
            <ChipInput label="Skills" hint="tools, languages, methods" values={p.skills} onChange={(v) => set('skills', v)} placeholder="e.g. Python, SQL, Figma" />
            <ChipInput label="Interests" values={p.interests} onChange={(v) => set('interests', v)} placeholder="e.g. cloud, cycling" />
            <ChipInput label="Target industries" values={p.targetIndustries} onChange={(v) => set('targetIndustries', v)} placeholder="e.g. consulting" />
            <TextField
              id="background"
              label="Background"
              hint="a few sentences; sharpens the ranking and the note"
              placeholder="e.g. Built a demand-forecasting model during a Colruyt internship; two years treasurer of AFC Leuven; thesis on…"
              value={p.background}
              onChange={(e) => set('background', e.target.value.slice(0, 1200))}
              rows={4}
            />
          </div>
        </details>

        <details className="index-card__options profile__more">
          <summary>
            <span>Answers for application forms</span>
            <span className="index-card__options-hint">{answerCount(p) ? `${answerCount(p)} filled` : 'For the extension'}</span>
          </summary>
          <div className="index-card__options-fields">
            <p className="field__hint">On an application form, the browser extension shows the answer a field asks for, ready to copy.</p>
            {ANSWER_FIELDS.map((f) => (
              <TextField key={f.key} id={`answer-${f.key}`} label={f.label} placeholder={f.placeholder} value={p.answers[f.key]} onChange={(e) => set('answers', { ...p.answers, [f.key]: e.target.value.slice(0, 400) })} rows={2} />
            ))}
          </div>
        </details>

        <label className="field--check profile__check" htmlFor="linkedinPremium">
          <input id="linkedinPremium" type="checkbox" checked={p.linkedinPremium} onChange={(e) => set('linkedinPremium', e.target.checked)} />
          <span>LinkedIn Premium</span>
          <span className="field__hint">300-character notes</span>
        </label>

        <div className="profile__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved ? (
            <span className="profile__saved" role="status">
              <Check aria-hidden="true" /> Saved
              {firstSave && !me.trial && <>. Next: <Link href="/jobs?view=feed">say what you are looking for</Link></>}
            </span>
          ) : (
            unsaved && <span className="field__hint">Filled from your résumé, not saved yet</span>
          )}
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </div>
      </form>

      {!me.trial && <MemoryPanel me={me} refreshMe={refreshMe} />}

      <section className="profile__group" aria-labelledby="ai-heading">
        <h2 className="profile__h" id="ai-heading">AI</h2>
        <UsagePanel me={me} />
        <p className="profile__note">{me.aiKey ? 'Runs on your own AI key.' : 'Runs on Claude Haiku. Smarter models with a subscription are not available yet.'}</p>
        {!me.trial && <OwnKey me={me} refreshMe={refreshMe} />}
      </section>

      <DeleteAccount />
    </main>
  )
}

const PROVIDERS: Array<{ id: AiProvider; label: string; model: string }> = [
  { id: 'openrouter', label: 'OpenRouter', model: 'Agisse picks' },
  { id: 'openai', label: 'OpenAI', model: 'gpt-5-mini' },
  { id: 'anthropic', label: 'Anthropic (Claude)', model: 'claude-opus-5-5' },
  { id: 'gemini', label: 'Google Gemini', model: 'gemini-3.8-flash' },
  { id: 'mistral', label: 'Mistral (EU)', model: 'mistral-large-latest' },
]

/** Switch the own key's model; suggestions come from the provider, any id it accepts works. */
function ModelSwitch({ current, run, busy }: { current: string; run: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean }) {
  const [model, setModel] = useState(current)
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    api.aiModels().then((r) => setModels(r.models), () => {})
  }, [])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => api.setAiModel(model))
      }}
    >
      <Field id="ai-model-switch" label="Model" hint={current ? undefined : 'empty: Agisse picks'} list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} />
      <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      <button type="submit" className="btn btn--quiet" disabled={busy || model.trim() === current}>{busy ? 'Checking…' : 'Use this model'}</button>
    </form>
  )
}

// "Connect OpenRouter": OpenRouter's OAuth PKCE flow hands back a key for the seeker's own account, which is then
// saved like a pasted key (checked, encrypted, write-only). Runs in the browser; the verifier waits in sessionStorage.
const OR_PKCE = 'agisse-openrouter-pkce'
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function connectOpenRouter() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem(OR_PKCE, JSON.stringify({ verifier, state }))
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const q = new URLSearchParams({ callback_url: `${location.origin}/profile`, code_challenge: challenge, code_challenge_method: 'S256', state, key_label: 'Agisse' })
  location.href = `https://openrouter.ai/auth?${q}`
}

/** On the way back from OpenRouter: the key for ?code=, or null when this page load is not a callback. */
async function openRouterCallback(): Promise<string | null> {
  const q = new URLSearchParams(location.search)
  const code = q.get('code')
  let saved: { verifier: string; state: string } | null = null
  try {
    saved = JSON.parse(sessionStorage.getItem(OR_PKCE) ?? 'null')
    sessionStorage.removeItem(OR_PKCE) // single use; also stops a second effect run from exchanging twice
  } catch {}
  if (!code || !saved) return null
  history.replaceState(null, '', location.pathname)
  if (q.get('state') !== saved.state) throw new Error('OpenRouter sign-in did not match; try again.')
  const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: saved.verifier, code_challenge_method: 'S256' }),
  })
  const { key } = (await res.json().catch(() => ({}))) as { key?: string }
  if (!res.ok || !key) throw new Error('OpenRouter did not hand over a key; try again.')
  return key
}

/** Bring your own key: AI then runs on the seeker's account instead of their Agisse budget. The key is write-only. */
function OwnKey({ me, refreshMe }: { me: Me; refreshMe: () => Promise<void> }) {
  const [provider, setProvider] = useState<AiProvider>('openai')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setKey('')
      await refreshMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the key.')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('code')) return
    void run(async () => {
      const k = await openRouterCallback()
      if (k) await api.saveAiKey({ provider: 'openrouter', key: k, model: '' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const current = me.aiKey
  const meta = PROVIDERS.find((x) => x.id === provider)!
  return (
    <details className="index-card__options profile__more">
      <summary>
        <span>Your own AI key</span>
        <span className="index-card__options-hint">{current ? `${PROVIDERS.find((x) => x.id === current.provider)?.label} · ${current.model || 'Agisse picks'}` : 'Optional'}</span>
      </summary>
      <div className="index-card__options-fields ph-no-capture">
        {current ? (
          <>
            <p className="profile__key">
              <span>
                {PROVIDERS.find((x) => x.id === current.provider)?.label} · key ending <span className="tnum">{current.last4}</span>
              </span>
              <button type="button" className="btn btn--quiet btn--sm" disabled={busy} onClick={() => run(() => api.removeAiKey())}>Remove</button>
            </p>
            <ModelSwitch key={current.model} current={current.model} run={run} busy={busy} />
          </>
        ) : (
          <>
            <p className="field__hint">AI then runs on your account and stops counting against your budget. Stored encrypted, never shown again.</p>
            <div>
              <button type="button" className="btn" disabled={busy} onClick={() => void connectOpenRouter()}>Connect OpenRouter</button>
            </div>
            <form
              className="profile__key-form"
              onSubmit={(e) => {
                e.preventDefault()
                run(() => api.saveAiKey({ provider, key, model }))
              }}
            >
              <div className="field">
                <label className="field__label label" htmlFor="key-provider"><span>Or paste a key from</span></label>
                <select id="key-provider" className="field__input" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
                  {PROVIDERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              <Field id="ai-key" label="API key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} required />
              <Field id="ai-model" label="Model" hint="optional, change it any time" value={model} placeholder={meta.model} onChange={(e) => setModel(e.target.value)} />
              <div>
                <button type="submit" className="btn" disabled={busy || !key.trim()}>{busy ? 'Checking…' : 'Use this key'}</button>
              </div>
            </form>
          </>
        )}
        {error && <span className="field__error" role="alert">{error}</span>}
      </div>
    </details>
  )
}

/** GDPR export (worker/lib/export.ts) and erasure: the account, everything saved under it and the CV PDF (worker/auth.ts deleteUser). */
function DeleteAccount() {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const erase = async () => {
    setBusy(true)
    const res = await authClient.deleteUser({ callbackURL: '/' })
    setBusy(false)
    if (res.error) return setError(res.error.code === 'SESSION_EXPIRED' ? 'For safety, sign out and back in, then delete within a day.' : (res.error.message ?? 'Could not delete the account.'))
    posthog.capture('account_deleted')
    posthog.reset()
    window.location.href = '/'
  }
  return (
    <section className="profile__danger" aria-label="Your data">
      {!armed ? (
        <>
          <a className="btn btn--quiet" href="/api/me/export" download>Download my data</a>
          <button type="button" className="btn btn--quiet" onClick={() => setArmed(true)}>Delete account…</button>
        </>
      ) : (
        <>
          <span>This erases your profile, CV and everything you saved. It cannot be undone.</span>
          <button type="button" className="btn btn--danger" onClick={erase} disabled={busy}>{busy ? 'Deleting…' : 'Delete forever'}</button>
          <button type="button" className="btn btn--quiet" onClick={() => setArmed(false)} disabled={busy}>Cancel</button>
        </>
      )}
      {error && <span className="field__error" role="alert">{error}</span>}
    </section>
  )
}

/** Filled entries behind the "Skills, interests, background" fold. */
const moreCount = (p: Profile) => p.skills.length + p.interests.length + p.targetIndustries.length + (p.background.trim() ? 1 : 0)
const answerCount = (p: Profile) => Object.values(p.answers).filter((a) => a.trim()).length

function UsagePanel({ me }: { me: Me }) {
  if (me.trial) {
    return (
      <div className="profile__budget">
        <div className="meter">
          <span className="meter__label">
            <span>Free search</span>
            <span className="tnum">{me.trial.used ? '1 / 1' : '0 / 1'}</span>
          </span>
          <progress max={1} value={me.trial.used ? 1 : 0} aria-label="Free-search usage" />
        </div>
        <p className="profile__note">Your monthly allowance opens when your account is approved.</p>
      </div>
    )
  }
  const remaining = Math.max(0, me.budget.limit - me.budget.used)
  const resets = new Date(me.budget.resetsOn).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
  return (
    <div className="profile__budget">
      <BudgetMeter budget={me.budget} label="Budget this month" />
      <p className="profile__note">{eur.format(remaining)} left · resets {resets}</p>
    </div>
  )
}
