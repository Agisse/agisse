import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { AlertCircle, ArrowRight, BriefcaseBusiness, Check, ChevronRight, Pencil, Play, Search, UserRound } from 'lucide-react'
import type { JobStatus } from '../../shared/types'
import { EMPTY_FEED_PREFS } from '../../shared/listings'
import { api, profileIsEmpty, type Me } from '../lib/api'
import { remembered, useResource } from '../lib/hooks'
import { dueItems } from '../lib/followup'
import { dueCard, personHref, todayNext, when, type Step, type TodayCard } from '../lib/today'
import { weekCounts } from '../lib/week'
import { InviteCard } from '../components/InviteCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** The pipeline in one line: each stage that has jobs, one link to My jobs. */
const STAGES: [string, JobStatus[]][] = [
  ['saved', ['saved']],
  ['to decide', ['evaluated']],
  ['applied', ['applied', 'responded']],
  ['interviewing', ['assessment', 'interview']],
  ['with an offer', ['offer']],
]

/** Coming up shows this many rows; the rest open on tap. */
const SHOWN = 3

const ICON: Record<TodayCard['kind'], ReactNode> = { step: <ArrowRight />, job: <BriefcaseBusiness />, person: <UserRound />, practice: <Play />, role: <BriefcaseBusiness />, clear: <Search /> }

function greeting(name: string, now = new Date()) {
  const h = now.getHours()
  const hello = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0]
  return first && !first.includes('@') ? `${hello}, ${first}` : hello
}

/** A section heading: small, semibold, sentence case. */
function SectionHead({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="m-0 flex min-h-8 items-center px-1 text-[15px] font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  )
}

/** One inset grouped list (iOS Settings style): hairline ring, rows divided by hairlines. */
const GROUP = 'overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10'
const QUIET_LINK = 'text-primary underline-offset-4 hover:underline'

/** Today: the one thing to do next, then what else is coming up, then the search in a line or two. The assistant lives in the dock. */
export function DashboardRoute({ me }: { me: Me; refreshMe: () => Promise<void> }) {
  const trial = !!me.trial
  const people = useResource(() => api.contacted().then((r) => r.people), [])
  // Trial accounts have no Jobs.
  const jobs = useResource(() => (trial ? Promise.resolve([]) : api.jobs().then((r) => r.jobs)), [trial])

  const due = dueItems(jobs.data ?? [], people.data ?? [])
  const error = people.error ?? jobs.error
  const loading = !people.data || !jobs.data
  const allJobs = jobs.data ?? []

  // First run: four steps from an empty profile to a first application, each read from data already loaded.
  const steps: Step[] = [
    { done: !profileIsEmpty(me), label: 'Upload your CV', detail: 'Agisse matches roles and practice to it.', action: 'Upload CV', href: '/welcome' },
    ...(trial
      ? []
      : [
          {
            done: JSON.stringify({ ...EMPTY_FEED_PREFS, ...me.profile?.jobFeed }) !== JSON.stringify(EMPTY_FEED_PREFS),
            label: 'Say what you’re looking for',
            detail: 'Field and country. Your feed fills from it.',
            action: 'Choose',
            href: '/welcome?step=looking',
          },
          { done: allJobs.length > 0, label: 'Save a role', detail: 'Pick one from your feed to track it here.', action: 'Open feed', href: '/jobs?view=feed' },
          { done: allJobs.some((j) => j.appliedAt), label: 'Apply to one', detail: 'Mark it applied and Today reminds you to follow up.', action: 'Open my jobs', href: '/jobs?view=track' },
        ]),
  ]
  const week = weekCounts(allJobs)
  // ponytail: goal lives in this browser only; move it to the profile if seekers want it across devices.
  const goalKey = `agisse.week-goal.${me.user.id}`
  const [goal, setGoal] = useState(() => {
    try {
      return Number(localStorage.getItem(goalKey)) || 0
    } catch {
      return 0
    }
  })
  const [editGoal, setEditGoal] = useState(false)
  const changeGoal = (n: number) => {
    const g = Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0
    setGoal(g)
    try {
      if (g) localStorage.setItem(goalKey, String(g))
      else localStorage.removeItem(goalKey)
    } catch {
      /* private window: the goal lasts this visit */
    }
  }

  const nextStep = loading ? undefined : steps.find((s) => !s.done)
  const checklist = !!nextStep && steps.length > 1
  const card = loading ? undefined : todayNext({ step: nextStep, due, jobs: allJobs, trial })
  // The card shows the first thing due, so the list leaves it out.
  const rest = card?.kind === 'job' || card?.kind === 'person' ? due.slice(1) : due
  const [showAll, setShowAll] = useState(false)
  // Until the lists answer, this browser's last answer decides whether Coming up's placeholder draws, so it doesn't vanish under the seeker.
  const [hadMore] = useState(() => remembered('coming-up', ['some', 'none'], 'none') === 'some')
  useEffect(() => {
    if (!loading) remembered('coming-up', ['some', 'none'], 'none', rest.length ? 'some' : 'none')
  }, [loading, rest.length])
  const offers = allJobs.filter((j) => j.status === 'offer').length
  const pipeline = STAGES.map(([label, statuses]) => [allJobs.filter((j) => statuses.includes(j.status)).length, label] as const).filter(([n]) => n > 0)
  const cvNudge = !profileIsEmpty(me) && (me.cvReview?.score ?? 0) < 85

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pt-6 pb-8 md:px-10 md:pt-10 md:pb-16">
      <h1 className="m-0 px-1 text-[28px] leading-tight font-semibold tracking-tight text-balance text-foreground md:text-[32px]">{greeting(me.user.name)}</h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* The one primary: the next first-run step, else the first thing due, else a test or a role, else a way in. */}
      {!card ? (
        <Card className="gap-3 rounded-2xl p-5" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </Card>
      ) : (
        <UpNext card={card}>
          {checklist && (
            <details className="group px-1 text-sm text-muted-foreground">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-md outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Getting started: <span className="tabular-nums">{steps.filter((s) => s.done).length} of {steps.length}</span> done
                <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
              </summary>
              <ol className="m-0 flex list-none flex-col gap-1 p-0 pb-1" aria-label="Getting started">
                {steps.map((s) => (
                  <li key={s.label} className="flex min-h-9 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn('grid size-5 shrink-0 place-items-center rounded-full', s.done ? 'bg-primary text-primary-foreground' : s === nextStep ? 'ring-2 ring-primary ring-inset' : 'ring-1 ring-foreground/20 ring-inset')}
                    >
                      {s.done && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {s.done ? (
                      <span>
                        {s.label}
                        <span className="sr-only"> (done)</span>
                      </span>
                    ) : (
                      <Link href={s.href} className="text-foreground no-underline underline-offset-4 hover:underline">
                        {s.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </UpNext>
      )}

      {/* Coming up: everything else due, soonest first; the first few, the rest on tap; hidden when there's nothing else. */}
      {(loading ? hadMore : rest.length > 0) && (
        <section aria-labelledby="due-title" aria-busy={loading} className="flex flex-col gap-2">
          <SectionHead id="due-title">Coming up</SectionHead>
          <div className={GROUP}>
            {loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))
            ) : (
              <ul className="m-0 list-none p-0">
                {(showAll ? rest : rest.slice(0, SHOWN)).map((d) => {
                  const w = when(d.at)
                  const c = dueCard(d)
                  return (
                    <li key={d.kind === 'person' ? `p-${d.person.id}` : `j-${d.job.id}`} className="border-b border-border last:border-b-0">
                      <Link
                        href={d.kind === 'person' ? personHref(d.person) : d.href}
                        className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                          {ICON[c.kind]}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-medium">{c.title}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{c.detail.split(' · ')[0]}</span>
                        </span>
                        <span className={cn('flex shrink-0 items-center gap-1 text-[13px] tabular-nums', w.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {w.overdue && <AlertCircle className="size-3.5" aria-hidden="true" />}
                          {w.text.charAt(0).toUpperCase() + w.text.slice(1)}
                          {w.overdue && <span className="sr-only">, overdue</span>}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {!loading && rest.length > SHOWN && (
            <Button variant="ghost" size="sm" className="self-start text-muted-foreground max-md:h-11" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show ${rest.length - SHOWN} more`}
            </Button>
          )}
        </section>
      )}

      {/* The search in a line or two: the pipeline, this week against an optional goal, and a CV nudge while it has room to grow. */}
      {((!trial && allJobs.length > 0) || cvNudge) && (
        <section aria-labelledby="search-title" className="flex flex-col gap-1 px-1 text-sm text-muted-foreground">
          <h2 id="search-title" className="sr-only">
            Your search
          </h2>
          {!trial && allJobs.length > 0 && (
            <>
              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href="/jobs?view=track" className="inline-flex min-h-9 flex-wrap items-center gap-y-1 text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline">
                  {pipeline.map(([n, label], i) => (
                    <span key={label} className="whitespace-nowrap">
                      {i > 0 && <span aria-hidden="true" className="px-1.5">·</span>}
                      <span className="font-medium text-foreground tabular-nums">{n}</span> {label}
                    </span>
                  ))}
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
                {offers > 1 && (
                  <Link href="/jobs?view=offers" className={QUIET_LINK}>
                    Compare offers
                  </Link>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  This week: <span className="font-medium text-foreground tabular-nums">{goal ? `${week.applied} of ${goal}` : week.applied}</span> applied
                  {week.interviews > 0 && (
                    <>
                      {' · '}
                      <span className="font-medium text-foreground tabular-nums">{week.interviews}</span> {week.interviews === 1 ? 'interview' : 'interviews'}
                    </>
                  )}
                  {goal > 0 && week.applied >= goal && <Check className="size-4 text-[var(--green)]" role="img" aria-label="goal reached" />}
                </span>
                {goal > 0 && <Progress value={Math.min(100, (week.applied / goal) * 100)} aria-label="Weekly goal" className="w-24 flex-none sm:w-32" />}
                {editGoal ? (
                  <label className="flex items-center gap-2">
                    Weekly goal
                    <Input
                      className="h-9 w-16 text-center tabular-nums max-md:h-11"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      placeholder="–"
                      autoFocus
                      value={goal || ''}
                      onChange={(e) => changeGoal(e.target.valueAsNumber)}
                      onBlur={() => setEditGoal(false)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditGoal(false)}
                    />
                  </label>
                ) : (
                  <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground max-md:h-11" onClick={() => setEditGoal(true)}>
                    <Pencil data-icon="inline-start" aria-hidden="true" />
                    {goal ? 'Change goal' : 'Set a weekly goal'}
                  </Button>
                )}
              </div>
            </>
          )}
          {cvNudge && (
            <p className="m-0 flex min-h-9 items-center">
              {me.cvReview ? (
                <span>
                  CV score <span className="tabular-nums">{me.cvReview.score}/100</span>.{' '}
                  <Link href="/prepare/cv" className={QUIET_LINK}>
                    Fix the flagged lines
                  </Link>
                </span>
              ) : (
                <span>
                  <Link href="/prepare/cv" className={QUIET_LINK}>
                    Score your CV
                  </Link>
                  , free.
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {/* Invites wait until the seeker has used Agisse once; a waitlisted account (no checklist) still sees its place and the code field. */}
      {!loading && !checklist && <InviteCard />}
    </main>
  )
}

/** The one thing to do next: a prominent card with its single primary action; `children` sit quietly under it. */
function UpNext({ card, children }: { card: TodayCard; children?: ReactNode }) {
  const quiet = card.kind === 'clear'
  return (
    <section aria-labelledby="next-title" className="flex flex-col gap-2">
      <h2 id="next-title" className="sr-only">
        {quiet ? 'All clear' : 'Up next'}
      </h2>
      <Card className="flex-row flex-wrap items-center gap-4 rounded-2xl p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] sm:flex-nowrap">
        <span
          aria-hidden="true"
          className={cn('grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5', quiet ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}
        >
          {ICON[card.kind]}
        </span>
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <p className="m-0 text-lg leading-snug font-semibold tracking-tight text-balance text-foreground">{card.title}</p>
          <p className={cn('m-0 text-sm text-pretty', card.overdue ? 'text-destructive' : 'text-muted-foreground')}>
            {card.detail}
            {card.overdue && <span className="sr-only">, overdue</span>}
          </p>
        </div>
        <Button size="lg" className="h-10 px-4 max-sm:w-full max-md:h-11" render={<Link href={card.href} />}>
          {card.action}
        </Button>
      </Card>
      {children}
    </section>
  )
}
