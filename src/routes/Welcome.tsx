import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { Check } from 'lucide-react'
import { EMPTY_PROFILE, type Profile } from '../../shared/types'
import { EMPTY_FEED_PREFS, VACANCY_COUNTRIES, VACANCY_FUNCTIONS, type FeedPrefs } from '../../shared/listings'
import { api, type Me } from '../lib/api'
import { localeCountry, mergeResume, suggestFields } from '../lib/profile'
import { ResumeImport } from '../components/ResumeImport'
import { BoothSignMark } from '../components/BoothSignMark'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import posthog from '../lib/posthog'
import { AuthError } from './SignIn'

// The countries most seekers start from; the feed has every other one.
const FIRST_COUNTRIES = ['BE', 'NL', 'FR', 'DE', 'LU', 'GB', 'IE', 'CH', 'ES', 'IT', 'DK', 'SE', 'EU'] as const

const chip =
  'h-11 gap-1.5 rounded-lg border-border px-4 text-[0.9375rem] font-normal text-foreground aria-pressed:border-primary aria-pressed:bg-primary/8 aria-pressed:text-primary dark:aria-pressed:bg-primary/15'

/**
 * First run after sign-up: the CV, then fields and where (one question a screen, both prefilled), then the feed ranked
 * against that CV. Level is left at "both"; the feed's filters change it. Every step can be skipped.
 */
export function Welcome({ me, refreshMe }: { me: Me; refreshMe: () => Promise<void> }) {
  const [, navigate] = useLocation()
  // "looking" is one saved step shown as two screens.
  const steps = ['cv', 'fields', 'where'] as const
  // ?step=looking reopens at that step (the Today checklist links there).
  const [step, setStep] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('step') ?? ''
    return Math.max(0, (steps as readonly string[]).indexOf(q === 'looking' ? 'fields' : q))
  })
  const at = steps[step]!
  const [profile, setProfile] = useState<Profile>(() => ({ ...EMPTY_PROFILE, ...me.profile }))
  // Smart defaults: fields from the CV, the country from the browser's language. Both are visible and one tap to undo.
  // Only before the seeker has saved any: after that, an empty list is their answer ("every field", "all of Europe").
  const [fresh] = useState(() => JSON.stringify({ ...EMPTY_FEED_PREFS, ...me.profile?.jobFeed }) === JSON.stringify(EMPTY_FEED_PREFS))
  const [prefs, setPrefs] = useState<FeedPrefs>(() => {
    const p = { ...EMPTY_FEED_PREFS, ...me.profile?.jobFeed }
    const here = localeCountry(VACANCY_COUNTRIES)
    return fresh ? { ...p, functions: suggestFields(profile), countries: here ? [here] : [] } : p
  })
  const [fromCv, setFromCv] = useState(() => fresh && prefs.functions.length > 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = me.user.name.split(' ')[0]
  // Google sends a new account here with ?new=google, the one place its sign-up is known; dropped so a reload doesn't count it twice.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') !== 'google') return
    posthog.capture('account_created', { method: 'google' })
    url.searchParams.delete('new')
    window.history.replaceState(null, '', url)
  }, [])

  const save = async (next: Profile) => {
    setBusy(true)
    setError(null)
    try {
      await api.saveProfile(next)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  // Read the CV, then straight on: the next screen already shows what it found.
  const fromResume = (p: Profile) => {
    const { profile: next, filled } = mergeResume(profile, p)
    setProfile(next)
    const fields = suggestFields(next)
    if (fresh && fields.length) {
      setPrefs((prev) => ({ ...prev, functions: fields }))
      setFromCv(true)
    }
    if (at === 'cv') advance()
    if (filled) void save(next)
    return filled
  }

  const go = (to: number) => {
    setError(null)
    setStep(Math.max(0, Math.min(to, steps.length - 1)))
    window.scrollTo(0, 0)
  }

  const advance = () => {
    if (at === 'cv') posthog.capture('onboarding_step', { step: 'cv' })
    go(step + 1)
  }

  const saveLooking = async () => {
    const withFeed = { ...profile, jobFeed: prefs }
    if (await save(withFeed)) {
      setProfile(withFeed)
      posthog.capture('onboarding_step', { step: 'looking' })
      // The answers just shaped the feed, so that's where to start. Busy until it opens, so a second click can't finish twice.
      setBusy(true)
      await finish('/jobs?view=feed')
    }
  }

  const finish = async (href: string) => {
    posthog.capture('onboarding_finished', { href })
    await refreshMe()
    navigate(href)
  }

  const toggles = (label: string, list: string[], set: (v: string[]) => void, options: readonly (readonly [string, string])[]) => (
    <ToggleGroup multiple aria-label={label} value={list} onValueChange={(v) => set(v as string[])} className="w-full flex-wrap">
      {options.map(([k, label]) => (
        <ToggleGroupItem key={k} value={k} variant="outline" className={chip}>
          {list.includes(k) && <Check aria-hidden="true" />} {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto grid w-full max-w-2xl gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex h-9 items-center justify-between">
          <span className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight">
            <BoothSignMark className="size-7!" /> Agisse
          </span>
          <Button type="button" variant="ghost" className="h-9 px-3 text-muted-foreground" onClick={() => void finish('/')}>
            Skip for now
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of {steps.length}
        </p>
        <ol className="flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s} className={cn('h-1 flex-1 rounded-full transition-colors duration-200', i <= step ? 'bg-primary' : 'bg-border')} />
          ))}
        </ol>
      </header>

      <main key={at} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-10 pb-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 sm:px-6 sm:pt-16">
        {at === 'cv' && (
          <Screen title={<>Welcome{first ? `, ${first}` : ''}. Start with your CV.</>} lede="Agisse reads it once and ranks open roles by how well they fit you.">
            <ResumeImport onExtracted={fromResume} autosave />
          </Screen>
        )}

        {at === 'fields' && (
          <Screen title="Which fields interest you?" lede={fromCv ? 'Picked from your CV. Change any.' : 'Pick as many as you like, or none for every field.'}>
            {toggles('Fields', prefs.functions, (functions) => setPrefs({ ...prefs, functions }), Object.entries(VACANCY_FUNCTIONS))}
          </Screen>
        )}

        {at === 'where' && (
          <Screen title="Where do you want to work?" lede="None picked means all of Europe.">
            {toggles('Countries', prefs.countries, (countries) => setPrefs({ ...prefs, countries }), FIRST_COUNTRIES.map((k) => [k, VACANCY_COUNTRIES[k]] as const))}
            <label className="mt-2 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 text-base">
              Remote only
              <Switch checked={prefs.remoteOnly} onCheckedChange={(remoteOnly) => setPrefs({ ...prefs, remoteOnly })} />
            </label>
          </Screen>
        )}

        {error && <div className="mt-6"><AuthError>{error}</AuthError></div>}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:static sm:border-0">
        <div className="mx-auto flex w-full max-w-xl flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-0 sm:pb-10">
          {step > 0 ? (
            <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => go(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {/* The CV screen's own action is Choose PDF and it moves on by itself, so its footer only offers the way past. */}
          <Button type="button" variant={at === 'cv' ? 'ghost' : 'default'} className={cn('h-11 w-full text-[0.9375rem] sm:w-auto sm:min-w-36', at === 'cv' && 'text-muted-foreground')} disabled={busy} onClick={at === 'where' ? () => void saveLooking() : advance}>
            {busy && <Spinner />} {at === 'cv' ? 'Continue without a CV' : at === 'fields' ? 'Continue' : busy ? 'Saving…' : 'See my roles'}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function Screen({ title, lede, children }: { title: ReactNode; lede: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-8" aria-labelledby="w-title">
      <div className="flex flex-col gap-3">
        <h1 id="w-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="max-w-[52ch] text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">{lede}</p>
      </div>
      {children}
    </section>
  )
}
