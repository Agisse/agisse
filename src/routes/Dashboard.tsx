import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { AlertCircle, ArrowRight, BriefcaseBusiness, Check, ChevronRight, Pencil, Search, UserRound } from 'lucide-react'
import type { JobStatus } from '../../shared/types'
import { EMPTY_FEED_PREFS } from '../../shared/listings'
import { api, profileIsEmpty, type Me } from '../lib/api'
import { formatDate, remembered, useResource } from '../lib/hooks'
import { dueItems } from '../lib/followup'
import { weekCounts } from '../lib/week'
import { InviteCard } from '../components/InviteCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** The pipeline at a glance: each stage's count, one link to My jobs. */
const STAGES: [string, JobStatus[]][] = [
  ['Saved', ['saved']],
  ['To decide', ['evaluated']],
  ['Applied', ['applied', 'responded']],
  ['Interviewing', ['assessment', 'interview']],
  ['Offer', ['offer']],
]

const DAY = 86_400_000
/** "Today", "Tomorrow", or the date; past ones are marked overdue. */
function when(iso: string, now = new Date()) {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((midnight(new Date(iso)) - midnight(now)) / DAY)
  return { text: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDate(iso), overdue: days < 0 }
}

function greeting(name: string, now = new Date()) {
  const h = now.getHours()
  const hello = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0]
  return first && !first.includes('@') ? `${hello}, ${first}` : hello
}

/** A section heading: small, semibold, sentence case; an optional quiet action on the right. */
function SectionHead({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
      <h2 id={id} className="m-0 text-[15px] font-semibold tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  )
}

/** One inset grouped list (iOS Settings style): hairline ring, rows divided by hairlines. */
const GROUP = 'overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10'

/** Today: what to do next, the shape of the search, and what is coming up. The assistant lives in the dock. */
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
  const steps: { done: boolean; label: string; href: string }[] = [
    { done: !profileIsEmpty(me), label: 'Import your résumé', href: '/welcome' },
    ...(trial
      ? []
      : [
          { done: JSON.stringify({ ...EMPTY_FEED_PREFS, ...me.profile?.jobFeed }) !== JSON.stringify(EMPTY_FEED_PREFS), label: 'Say what you are looking for', href: '/welcome?step=looking' },
          { done: allJobs.length > 0, label: 'Save a role', href: '/jobs?view=feed' },
          { done: allJobs.some((j) => j.appliedAt), label: 'Apply to one', href: '/jobs?view=track' },
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
  const checklist = nextStep && steps.length > 1

  // The one primary: the next first-run step, else the first thing due (then left out of the list).
  const first = nextStep ? undefined : due[0]
  const rest = first ? due.slice(1) : due
  // Until the lists answer, this browser's last answer decides whether Coming up's placeholder draws, so it doesn't vanish under the seeker.
  const [hadMore] = useState(() => remembered('coming-up', ['some', 'none'], 'none') === 'some')
  useEffect(() => {
    if (!loading) remembered('coming-up', ['some', 'none'], 'none', rest.length ? 'some' : 'none')
  }, [loading, rest.length])
  const personHref = (p: { id: string; search: { id: string } | null }) => (p.search ? `/s/${p.search.id}#p-${p.id}` : '/contacts?view=contacted')
  const offers = allJobs.filter((j) => j.status === 'offer').length

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pt-6 pb-8 md:px-10 md:pt-10 md:pb-16">
      <h1 className="m-0 px-1 text-[28px] leading-tight font-semibold tracking-tight text-balance text-foreground md:text-[32px]">{greeting(me.user.name)}</h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* The one primary: first-run checklist, else the next thing due, else a way in. */}
      {loading ? (
        <Card className="gap-3 rounded-2xl p-5" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </Card>
      ) : checklist ? (
        <Card className="gap-0 rounded-2xl p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-4">
            <h2 className="m-0 text-xl font-semibold tracking-tight">Get started</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {steps.filter((s) => s.done).length} of {steps.length} done
            </span>
          </div>
          <ol className="m-0 list-none border-t border-border p-0" aria-label="Getting started">
            {steps.map((s) => {
              const isNext = s === nextStep
              return (
                <li key={s.label} className={cn('flex min-h-14 items-center gap-3 border-b border-border px-5 py-3 last:border-b-0', isNext && 'bg-primary/5')}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full',
                      s.done ? 'bg-primary text-primary-foreground' : isNext ? 'ring-2 ring-primary ring-inset' : 'ring-1 ring-foreground/20 ring-inset',
                    )}
                  >
                    {s.done && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  {s.done ? (
                    <span className="flex-1 text-[15px] text-muted-foreground">
                      {s.label}
                      <span className="sr-only"> (done)</span>
                    </span>
                  ) : isNext ? (
                    <>
                      <span className="flex-1 text-[15px] font-medium">{s.label}</span>
                      <Button size="lg" className="h-10 px-4 max-md:h-11" render={<Link href={s.href} />}>
                        Start <ArrowRight data-icon="inline-end" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <Link href={s.href} className="flex-1 text-[15px] text-foreground no-underline hover:underline underline-offset-4">
                      {s.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      ) : (
        <UpNext
          {...(nextStep
            ? { title: nextStep.label, detail: 'Your next step', href: nextStep.href, action: 'Start', icon: <ArrowRight /> }
            : first?.kind === 'person'
              ? {
                  title: first.label === 'follow up' ? `Follow up with ${first.person.name}` : `Close ${first.person.name}: no reply`,
                  detail: `${first.person.company} · ${when(first.at).text}`,
                  overdue: when(first.at).overdue,
                  href: personHref(first.person),
                  action: first.label === 'follow up' ? 'Follow up' : 'Close',
                  icon: <UserRound />,
                }
              : first
                ? {
                    title: `${first.job.company}: ${first.label}`,
                    detail: `${first.job.role} · ${when(first.at).text}`,
                    overdue: when(first.at).overdue,
                    href: first.href,
                    action: 'Open',
                    icon: <BriefcaseBusiness />,
                  }
                : {
                    title: 'Nothing due',
                    detail: 'Set a date on an application and it shows up here when it comes close.',
                    href: trial ? '/contacts' : '/jobs',
                    action: trial ? 'Find people' : 'Find a job',
                    icon: <Search />,
                    quiet: true,
                  })}
        />
      )}

      {/* Coming up: everything else due, soonest first; hidden when there's nothing else. */}
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
                {rest.map((d) => {
                  const w = when(d.at)
                  const person = d.kind === 'person'
                  return (
                    <li key={person ? `p-${d.person.id}` : `j-${d.job.id}`} className="border-b border-border last:border-b-0">
                      <Link
                        href={person ? personHref(d.person) : d.href}
                        className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                          {person ? <UserRound /> : <BriefcaseBusiness />}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-medium">{person ? `${d.person.name} · ${d.person.company}` : `${d.job.company} · ${d.job.role}`}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{d.label}</span>
                        </span>
                        <span className={cn('flex shrink-0 items-center gap-1 text-[13px] tabular-nums', w.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {w.overdue && <AlertCircle className="size-3.5" aria-hidden="true" />}
                          {w.text}
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
        </section>
      )}

      {!trial && allJobs.length > 0 && (
        <section aria-labelledby="pipeline-title" className="flex flex-col gap-2">
          <SectionHead
            id="pipeline-title"
            action={
              offers > 1 && (
                <Button variant="link" size="sm" className="h-8 px-1" render={<Link href="/jobs?view=offers" />}>
                  Compare offers
                </Button>
              )
            }
          >
            Pipeline
          </SectionHead>
          <Link
            href="/jobs?view=track"
            className={cn(GROUP, 'grid grid-cols-5 divide-x divide-border text-foreground no-underline transition-colors duration-150 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring')}
          >
            {STAGES.map(([label, statuses]) => {
              const n = allJobs.filter((j) => statuses.includes(j.status)).length
              return (
                <span key={label} className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-3">
                  <span className={cn('text-xl font-semibold tracking-tight tabular-nums', n === 0 && 'text-muted-foreground/60')}>{n}</span>
                  <span className="max-w-full truncate text-[11px] text-muted-foreground sm:text-xs">{label}</span>
                </span>
              )
            })}
          </Link>

          {/* This week: applications sent against an optional goal, one slim line. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-1 text-sm text-muted-foreground">
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
            <span className="ml-auto">
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
                <Button variant="ghost" size="sm" className="text-muted-foreground max-md:h-11" onClick={() => setEditGoal(true)}>
                  <Pencil data-icon="inline-start" aria-hidden="true" />
                  {goal ? 'Change goal' : 'Set a weekly goal'}
                </Button>
              )}
            </span>
          </div>
        </section>
      )}

      {/* A nudge only while the CV has room to grow; a strong score needs no reminder. */}
      {!profileIsEmpty(me) && (me.cvReview?.score ?? 0) < 85 && (
        <p className="m-0 px-1 text-sm text-muted-foreground">
          {me.cvReview ? (
            <>
              CV score <span className="tabular-nums">{me.cvReview.score}/100</span>.{' '}
              <Link href="/prepare/cv" className="text-primary underline-offset-4 hover:underline">Fix the flagged lines</Link>
            </>
          ) : (
            <>
              <Link href="/prepare/cv" className="text-primary underline-offset-4 hover:underline">Score your CV</Link>, free.
            </>
          )}
        </p>
      )}

      {/* Invites wait until the seeker has used Agisse once; a waitlisted account (no checklist) still sees its place and the code field. */}
      {!loading && !checklist && <InviteCard />}
    </main>
  )
}

/** The one thing to do next: a prominent card with its single primary action. `quiet` is the nothing-due state. */
function UpNext({ title, detail, href, action, icon, overdue, quiet }: { title: string; detail: string; href: string; action: string; icon: ReactNode; overdue?: boolean; quiet?: boolean }) {
  return (
    <section aria-labelledby="next-title" className="flex flex-col gap-2">
      <SectionHead id="next-title">{quiet ? 'All clear' : 'Up next'}</SectionHead>
      <Card className="flex-row flex-wrap items-center gap-4 rounded-2xl p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] sm:flex-nowrap">
        <span
          aria-hidden="true"
          className={cn('grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5', quiet ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <p className="m-0 text-lg leading-snug font-semibold tracking-tight text-balance text-foreground">{title}</p>
          <p className={cn('m-0 text-sm', overdue ? 'text-destructive' : 'text-muted-foreground')}>
            {detail}
            {overdue && ', overdue'}
          </p>
        </div>
        <Button size="lg" className="h-10 px-4 max-sm:w-full max-md:h-11" render={<Link href={href} />}>
          {action}
        </Button>
      </Card>
    </section>
  )
}
