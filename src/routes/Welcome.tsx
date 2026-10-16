import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { Check } from 'lucide-react'
import { EMPTY_PROFILE, type Profile } from '../../shared/types'
import { EMPTY_FEED_PREFS, VACANCY_COUNTRIES, VACANCY_FUNCTIONS, type FeedLevel, type FeedPrefs } from '../../shared/listings'
import { api, type Me } from '../lib/api'
import { mergeResume } from '../lib/profile'
import { ResumeImport } from '../components/ResumeImport'
import { BoothSignMark } from '../components/BoothSignMark'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import posthog from '../lib/posthog'
import { AuthError } from './SignIn'

const LEVELS = { internship: 'Internship', entry: 'Graduate or junior role', any: 'Open to both' } as const
// The countries most seekers start from; the feed has every other one.
const FIRST_COUNTRIES = ['BE', 'NL', 'FR', 'DE', 'LU', 'GB', 'IE', 'CH', 'ES', 'IT', 'DK', 'SE', 'EU'] as const

const chip =
  'h-11 gap-1.5 rounded-lg border-border px-4 text-[0.9375rem] font-normal text-foreground aria-pressed:border-primary aria-pressed:bg-primary/8 aria-pressed:text-primary dark:aria-pressed:bg-primary/15'

/** First run after sign-up: the CV, then what the seeker is after (level, fields, where; one question a screen), then the feed those answers shape. Every step can be skipped. */
export function Welcome({ me, refreshMe }: { me: Me; refreshMe: () => Promise<void> }) {
  const [, navigate] = useLocation()
  // "looking" is one saved step shown as three screens.
  const steps = ['cv', 'level', 'fields', 'where'] as const
  // ?step=looking reopens at that step (the Today checklist links there).
  const [step, setStep] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('step') ?? ''
    return Math.max(0, (steps as readonly string[]).indexOf(q === 'looking' ? 'level' : q))
  })
  const at = steps[step]!
  const [profile, setProfile] = useState<Profile>(() => ({ ...EMPTY_PROFILE, ...me.profile }))
  const [prefs, setPrefs] = useState<FeedPrefs>(() => ({ ...EMPTY_FEED_PREFS, ...me.profile?.jobFeed }))
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

  const fromResume = (p: Profile) => {
    const { profile: next, filled } = mergeResume(profile, p)
    setProfile(next)
    if (filled) void save(next)
    return filled
  }

  const go = (to: number) => {
    setError(null)
    setStep(Math.max(0, Math.min(to, steps.length - 1)))
    window.scrollTo(0, 0)
  }

  const next = () => {
    if (at === 'cv') posthog.capture('onboarding_step', { step: 'cv' })
    go(step + 1)
  }

  const saveLooking = async () => {
    const next_ = { ...profile, jobFeed: prefs }
    if (await save(next_)) {
      setProfile(next_)
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
          <Screen title={<>Welcome{first ? `, ${first}` : ''}. Start with your CV.</>} lede="Agisse reads it once to learn your school, work and skills. That is what it matches roles against and what makes your messages personal.">
            <ResumeImport onExtracted={fromResume} autosave />
          </Screen>
        )}

        {at === 'level' && (
          <Screen title="What level are you aiming for?" lede="This shapes your job feed. Change it whenever you like from Jobs.">
            <ToggleGroup
              value={[prefs.level]}
              onValueChange={(v) => v[0] && setPrefs({ ...prefs, level: v[0] as FeedLevel })}
              orientation="vertical"
              aria-label="Level"
              className="w-full"
            >
              {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((l) => (
                <ToggleGroupItem key={l} value={l} variant="outline" className={cn(chip, 'h-14 justify-between rounded-xl text-base')}>
                  {LEVELS[l]}
                  <span className="grid size-5 place-items-center rounded-full border border-border group-aria-pressed/toggle:border-primary group-aria-pressed/toggle:bg-primary group-aria-pressed/toggle:text-primary-foreground">
                    {prefs.level === l && <Check aria-hidden="true" className="size-3!" strokeWidth={3} />}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Screen>
        )}

        {at === 'fields' && (
          <Screen title="Which fields interest you?" lede="Pick as many as you like.">
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
          {at === 'cv' ? (
            <Button
              variant="ghost"
              className="h-11 text-muted-foreground"
              render={<Link href="/profile" onClick={() => posthog.capture('onboarding_step', { step: 'cv-manual' })} />}
              nativeButton={false}
            >
              Fill it in by hand instead
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => go(step - 1)}>
              Back
            </Button>
          )}
          <Button type="button" className="h-11 w-full text-[0.9375rem] sm:w-auto sm:min-w-36" disabled={busy} onClick={at === 'where' ? () => void saveLooking() : next}>
            {busy && <Spinner />} {at !== 'where' ? 'Continue' : busy ? 'Saving…' : 'See my roles'}
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
