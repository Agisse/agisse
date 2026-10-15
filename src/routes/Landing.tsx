import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { ArrowRight, Check, Copy, ExternalLink, Plus, Send, X } from 'lucide-react'
import '../styles/landing.css'
import posthog from '../lib/posthog'
import { BoothSignMark } from '../components/BoothSignMark'
import { Button } from '../components/ui/button'
import { cn } from '@/lib/utils'

const SIGN_UP = '/sign-in?mode=sign-up'
const track = (position: string) => () => posthog.capture('landing_cta_clicked', { position })

type Stats = { open: number; companies: number; countries: number; stars?: number | null; hired?: number | null }

const WRAP = 'mx-auto w-full max-w-[1080px] px-4 sm:px-8'
/** The Worker sets it when PUBLIC_LAUNCH=1; known before the first paint, so nothing shifts. */
const LAUNCH = document.documentElement.hasAttribute('data-launch')

/** Marketing homepage for signed-out visitors. The open-role count is live; every person, company and score is an example. */
export function Landing() {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setStats(typeof s?.open === 'number' ? s : null))
      .catch(() => {})
  }, [])

  return (
    <div className="home min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className={cn(WRAP, 'flex h-14 items-center gap-2')}>
          <Link href="/" className="mr-auto flex items-center gap-2 rounded-lg font-semibold tracking-tight text-foreground no-underline" aria-label="Agisse home">
            <BoothSignMark className="size-7!" />
            <span aria-hidden="true">Agisse</span>
          </Link>
          <Button variant="ghost" nativeButton={false} className="h-10 px-3 text-sm" render={<Link href="/sign-in" />}>
            Sign in
          </Button>
          <Button nativeButton={false} className="h-10 rounded-full px-4 text-sm" render={<Link href={SIGN_UP} onClick={track('nav')} />}>
            Get started
          </Button>
        </div>
      </header>

      <main>
        <section aria-labelledby="home-title" className={cn(WRAP, 'pt-16 pb-12 text-center sm:pt-28 sm:pb-16')}>
          <h1 id="home-title" className="mx-auto max-w-[22ch] text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {LAUNCH ? (
              <>Stop applying everywhere. <span className="text-muted-foreground sm:block">Act where you fit.</span></>
            ) : (
              <>Land your first job in Europe. <span className="text-muted-foreground sm:block">With AI on your side.</span></>
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-lg text-pretty text-muted-foreground sm:text-xl">
            Agisse ranks the roles that fit your CV, tells you which are worth it, and helps you apply, reach out and prepare.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <Button nativeButton={false} className="h-12 rounded-full px-7 text-base" render={<Link href={SIGN_UP} onClick={track('hero')} />}>
              Get started <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
            <p className="text-sm text-balance text-muted-foreground">{LAUNCH ? 'Free with your own AI key · Open source · Made in Europe' : 'Invite-only beta, free while it lasts.'}</p>
          </div>
        </section>

        <HeroShot stats={stats} />

        <div id="product" className="mt-24 space-y-24 sm:mt-36 sm:space-y-36">
          <Feature
            id="find"
            title="Roles that fit, ranked for you."
            text="A feed of European internships, graduate programmes and first jobs, filtered by your dealbreakers and ranked by your skills. The deadline is always in view."
          >
            <FeedShot />
          </Feature>
          <Feature
            flip
            id="fit"
            title="Know if it is worth applying."
            text="Check fit scores a posting against your CV, requirement by requirement. Below 4.0, skip it. Above, tailor your CV in one click: it rewords what you have and never adds to it."
          >
            <VerdictShot />
          </Feature>
          <Feature
            id="people"
            title="Reach someone who will answer."
            text="Agisse finds people at the company you share something with: your school, your old employer, your student club. It drafts a short note. You send it from your own account."
          >
            <OutreachDemo />
          </Feature>
          <Feature
            flip
            id="prepare"
            title="Walk into every round prepared."
            text="See how each company's rounds run and what candidates were asked. Practise tests and interviews with feedback built only from what you did, then get a sourced salary range when the offer comes."
          >
            <RoundsShot />
          </Feature>
          <p className={cn(WRAP, 'max-w-2xl text-center text-pretty text-muted-foreground')}>
            Also: CV review, a browser extension that brings Agisse to any job posting, an application board, and use from Claude, Codex, Cursor or any MCP client (
            <a href="/docs/mcp" className="text-primary underline-offset-4 hover:underline">
              how to connect
            </a>
            ).
          </p>
        </div>

        <section aria-labelledby="belief-title" className={cn(WRAP, 'mt-28 sm:mt-40')}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="belief-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              A co-pilot, not an autopilot.
            </h2>
            {LAUNCH ? (
              // The founder's note takes the paragraph's place (the table below says the same); the launch-day PR fills it and links the manifesto.
              <figure className="mt-5">
                <blockquote className="text-lg text-pretty text-muted-foreground">“[founder quote]”</blockquote>
                <figcaption className="mt-3 text-sm font-medium">[photo] [founder name], who started Agisse</figcaption>
              </figure>
            ) : (
              <p className="mt-5 text-lg text-pretty text-muted-foreground">
                Bots that fire off hundreds of applications in your name get you ignored. Agisse does the research and the drafting, then hands you the wheel. You press every send.
              </p>
            )}
          </div>
          <div role="table" aria-label="Auto-apply bots compared with Agisse" className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border">
            <div role="row" className="grid grid-cols-2 gap-6 py-3 text-sm font-medium text-muted-foreground">
              <span role="columnheader">Auto-apply bots</span>
              <span role="columnheader" className="text-foreground">
                Agisse
              </span>
            </div>
            {COMPARE.map(([bot, us]) => (
              <div role="row" key={us} className="grid grid-cols-2 gap-6 py-4 text-[0.95rem] sm:text-base">
                <span role="cell" className="flex gap-2.5 text-muted-foreground">
                  <X className="mt-1 size-4 shrink-0" aria-hidden="true" /> {bot}
                </span>
                <span role="cell" className="flex gap-2.5 font-medium">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /> {us}
                </span>
              </div>
            ))}
          </div>
          {LAUNCH && (
            <p className="mt-6 text-center text-sm">
              <a href="/docs/compare/" className="text-primary underline-offset-4 hover:underline">
                See comparisons
              </a>
            </p>
          )}
        </section>

        <section id="faq" aria-labelledby="faq-title" className={cn(WRAP, 'mt-28 grid gap-8 sm:mt-40 md:grid-cols-[1fr_2fr] md:gap-16')}>
          <h2 id="faq-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {(LAUNCH ? LAUNCH_FAQ : FAQ).map(([q, a]) => (
              <details key={q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-3 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="max-w-[60ch] pb-5 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="close-title" className={cn(WRAP, 'mt-28 mb-24 text-center sm:mt-40 sm:mb-32')}>
          <BoothSignMark className="mx-auto size-12!" />
          <h2 id="close-title" className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {LAUNCH ? 'Apply less. Act more.' : 'Your next job, on your terms.'}
          </h2>
          {!LAUNCH && <p className="mt-4 text-lg text-muted-foreground">Free during the beta. Your first search works while you wait.</p>}
          <Button nativeButton={false} className="mt-8 h-12 rounded-full px-7 text-base" render={<Link href={SIGN_UP} onClick={track('close')} />}>
            Get started <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
          {LAUNCH && <OnboardAgent />}
        </section>
      </main>

      <footer className="border-t border-border bg-muted">
        <div className={cn(WRAP, 'flex flex-col gap-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center')}>
          <div className="flex items-center gap-2 md:mr-auto">
            <BoothSignMark className="size-6!" />
            <span className="font-semibold text-foreground">Agisse</span>
            <span aria-hidden="true">·</span>
            <span>{LAUNCH ? 'On your side only: Agisse never works for employers.' : 'Made in Europe, for Europe'}</span>
          </div>
          <nav aria-label="Footer" className="-mx-2 flex flex-wrap">
            {(LAUNCH ? launchFooter(stats) : FOOTER).map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-2 py-2.5 text-muted-foreground no-underline hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

function Feature({ id, title, text, flip, children }: { id: string; title: string; text: string; flip?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn(WRAP, 'grid grid-cols-[minmax(0,1fr)] items-center gap-10 md:grid-cols-2 md:gap-16')}>
      <div className={cn('max-w-md', flip && 'md:order-2')}>
        <h2 id={`${id}-title`} className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">
          {title}
        </h2>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">{text}</p>
      </div>
      <figure className="min-w-0 rounded-3xl bg-muted p-4 sm:p-8">{children}</figure>
    </section>
  )
}

/* ---------- Example UI, built from the app's own objects ---------- */

const CARD = 'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.14)]'
const PILL = 'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap'
const TONE = {
  green: 'bg-[var(--green-tint)] text-[var(--green-ink)]',
  amber: 'bg-[var(--amber-tint)] text-[var(--amber)]',
  blue: 'bg-[var(--blue-soft)] text-[var(--blue-ink)]',
}

const AGENT_PROMPT = 'Read https://agisse.xyz/agent.md and set up my own Agisse.'

/** Self-hosting in one prompt: copies a line for Claude Code, Codex or Cursor, which reads /agent.md and does the setup. */
function OnboardAgent() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    posthog.capture('landing_cta_clicked', { position: 'agent' })
    navigator.clipboard.writeText(AGENT_PROMPT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }, () => {})
  }
  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <Button variant="outline" className="h-12 rounded-full px-7 text-base" onClick={copy}>
        {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
        {copied ? 'Copied. Paste it into your agent' : 'Onboard your agent'}
      </Button>
      <p className="text-sm text-balance text-muted-foreground">
        Run your own copy: Claude Code, Codex or Cursor sets it up from <a href="/agent.md" className="underline underline-offset-4 hover:text-foreground">one prompt</a>.
      </p>
      <span className="sr-only" aria-live="polite">{copied ? 'Prompt copied' : ''}</span>
    </div>
  )
}

function Initials({ text, round }: { text: string; round?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center bg-muted text-sm font-semibold text-muted-foreground', round ? 'rounded-full' : 'rounded-xl')}>
      {text}
    </span>
  )
}

function JobRow({ job }: { job: (typeof FEED)[number] }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Initials text={job.co.slice(0, 2)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{job.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {job.co} · {job.city}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn(PILL, job.fit === 'Strong fit' ? TONE.green : TONE.blue)}>{job.fit}</span>
        <span className={cn('text-xs tabular-nums', job.days <= 3 ? 'font-medium text-[var(--amber)]' : 'text-muted-foreground')}>Closes in {job.days} days</span>
      </div>
    </li>
  )
}

/** The one authored moment: the feed and a person card rise in once. */
function HeroShot({ stats }: { stats: Stats | null }) {
  return (
    <figure aria-label="Agisse with example data" className={WRAP}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-[28px] bg-muted p-3 sm:p-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-6 lg:p-12">
        <div className={cn(CARD, 'home-rise px-4 pt-4 pb-1 [--rise-delay:100ms] sm:px-5')}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold tracking-tight">Jobs for you</p>
            <p className="text-sm text-muted-foreground tabular-nums">{stats ? `${stats.open.toLocaleString('en')} open in Europe` : 'Best match'}</p>
          </div>
          <ol className="mt-1 divide-y divide-border/70">
            {FEED.slice(0, 3).map((f) => (
              <JobRow key={f.title} job={f} />
            ))}
          </ol>
        </div>
        <div className={cn(CARD, 'home-rise flex flex-col p-4 [--rise-delay:300ms] sm:p-5')}>
          <PersonHead />
          <p className="mt-4 text-sm font-medium text-muted-foreground">Your note to Sam</p>
          <div className="mt-1.5 rounded-xl bg-muted p-3 text-sm leading-relaxed"><p className="line-clamp-3">{NOTE}</p></div>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
            <span className="text-muted-foreground">You send it yourself</span>
            <span className={cn(PILL, 'gap-1.5 bg-primary text-primary-foreground')} aria-hidden="true">
              <Copy className="size-3" /> Copy
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">Example data{stats ? ' · live role count' : ''}</figcaption>
    </figure>
  )
}

function PersonHead() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Initials text="SE" round />
        <div className="min-w-0">
          <p className="font-medium">Sam Example</p>
          <p className="truncate text-sm text-muted-foreground">Data Analyst · Example Co · Brussels</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cn(PILL, TONE.green)}>Same university</span>
        <span className={cn(PILL, TONE.green)}>Same student club</span>
      </div>
    </div>
  )
}

function FeedShot() {
  return (
    <div className={cn(CARD, 'px-4 pt-4 pb-1 sm:px-5')}>
      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" aria-hidden="true">
        {['Best match', 'Closing soon', 'Just opened'].map((v, i) => (
          <span key={v} className={cn('flex-1 truncate rounded-md px-2 py-1 text-center', i === 1 ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground')}>
            {v}
          </span>
        ))}
      </div>
      <ol className="mt-1 divide-y divide-border/70">
        {[...FEED].sort((a, b) => a.days - b.days).map((f) => (
          <JobRow key={f.title} job={f} />
        ))}
      </ol>
    </div>
  )
}

function VerdictShot() {
  return (
    <div className={cn(CARD, 'p-4 sm:p-5')}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--green-tint)] text-lg font-semibold text-[var(--green-ink)] tabular-nums">4.4</span>
        <div className="min-w-0">
          <p className="font-medium">Apply now</p>
          <p className="truncate text-sm text-muted-foreground">Junior Data Analyst · Northwind · Ghent</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3 border-t border-border/70 pt-4">
        {REQS.map((r) => (
          <li key={r.name} className="flex items-start gap-3">
            <span className={cn(PILL, 'w-16 shrink-0 justify-center', r.have ? TONE.green : TONE.amber)}>{r.have ? 'Have it' : 'Partly'}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-sm text-muted-foreground">{r.evidence}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2" aria-hidden="true">
        <span className={cn(PILL, 'h-8 bg-primary px-3 text-primary-foreground')}>Tailor my CV</span>
        <span className={cn(PILL, 'h-8 border border-border px-3')}>Cover letter</span>
      </div>
    </div>
  )
}

/** Works like the real thing, minus the real account: the visitor presses Send themselves. */
function OutreachDemo() {
  const [sent, setSent] = useState(false)
  const [pressed, setPressed] = useState(false) // no fade on first render
  const lift = pressed ? 'home-lift' : ''
  return (
    <div className={cn(CARD, 'p-4 sm:p-5')}>
      <PersonHead />
      <p className="mt-4 text-sm font-medium text-muted-foreground">Your note to Sam</p>
      <p className="mt-1.5 rounded-xl bg-muted p-3 text-sm leading-relaxed">{NOTE}</p>
      <div className="mt-4 flex min-h-11 items-center">
        {sent ? (
          <p role="status" className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', lift)}>
            <Check className="size-4 text-[var(--green)]" aria-hidden="true" /> Marked contacted. Follow-up reminder in 7 days.
            <button type="button" className="min-h-11 rounded-md px-1 font-medium text-primary hover:underline" onClick={() => setSent(false)}>
              Undo
            </button>
          </p>
        ) : (
          <div className={cn('flex flex-wrap gap-2', lift)}>
            <Button
              className="h-11 px-4 sm:h-9"
              onClick={() => {
                setSent(true)
                setPressed(true)
                posthog.capture('landing_demo_sent')
              }}
            >
              <Send data-icon="inline-start" aria-hidden="true" /> I sent it
            </Button>
            <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
              <ExternalLink className="size-3.5" aria-hidden="true" /> Open profile
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function RoundsShot() {
  return (
    <div className={cn(CARD, 'p-4 sm:p-5')}>
      <ol className="flex gap-2">
        {ROUNDS.map((r, i) => (
          <li key={r.name} className={cn('min-w-0 flex-1 rounded-xl p-2.5', i === 1 ? 'bg-[var(--blue-soft)] text-[var(--blue-ink)]' : 'bg-muted')}>
            <p className="text-xs tabular-nums opacity-80">Round {i + 1}</p>
            <p className="text-sm leading-snug font-medium">{r.name}</p>
            <p className={cn('mt-0.5 text-xs leading-snug', i !== 1 && 'text-muted-foreground')}>{r.tests}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm font-medium text-muted-foreground">A question candidates reported</p>
      <p className="mt-1 font-medium">Tell us about a time data changed a decision.</p>
      <p className="mt-3 flex flex-wrap gap-1.5">
        {STAR.map(([k, ok]) => (
          <span key={k} className={cn(PILL, 'gap-1', ok ? TONE.green : TONE.amber)}>
            {ok ? <Check className="size-3" role="img" aria-label="covered" /> : <X className="size-3" role="img" aria-label="missing" />} {k}
          </span>
        ))}
      </p>
      <p className="mt-3 rounded-xl bg-muted p-3 text-sm leading-relaxed">“My internship dashboard showed one region losing margin on promotions. We cut two of them. [Say what changed after.]”</p>
    </div>
  )
}

/* ---------- Copy ---------- */

const COMPARE: [string, string][] = [
  ['Spray hundreds of applications', 'Tells you the ten worth your time'],
  ['Send generic messages from your account', 'Drafts a personal note you send yourself'],
  ['Invent skills to beat the filter', 'Rewords your CV, never adds to it'],
]

const FEED = [
  { title: 'Junior Data Analyst', co: 'Northwind', city: 'Ghent', fit: 'Strong fit', days: 6 },
  { title: 'Business Analyst Intern', co: 'Example Co', city: 'Brussels', fit: 'Strong fit', days: 2 },
  { title: 'Graduate Programme, Finance', co: 'Fabrikam', city: 'Amsterdam', fit: 'Worth applying', days: 12 },
  { title: 'Pricing Analyst Intern', co: 'Contoso', city: 'Lisbon', fit: 'Worth applying', days: 3 },
]

const REQS = [
  { have: true, name: 'SQL and a BI tool', evidence: 'Built the sales dashboard during your internship' },
  { have: true, name: 'Degree in a quantitative field', evidence: 'Business Engineering, final year' },
  { have: false, name: 'Python for analysis', evidence: 'Coursework only; mention the thesis project' },
]

const NOTE =
  "Hi Sam, I'm finishing Business Engineering at the same university you did and I'm applying for the Data Analyst role at Example Co. Could I ask you two quick questions about how the team works?"

const ROUNDS = [
  { name: 'Online test', tests: 'Numerical reasoning' },
  { name: 'Case interview', tests: 'Structure and SQL' },
  { name: 'Team final', tests: 'Motivation and fit' },
]

const STAR: [string, boolean][] = [
  ['Situation', true],
  ['Task', true],
  ['Action', true],
  ['Result', false],
]

const FAQ: [string, string][] = [
  ['Does Agisse apply or message people for me?', 'No, and that is on purpose. It drafts answers and messages; you fill in, submit and send them yourself, from your own accounts. Recruiters notice the difference.'],
  ['Who is Agisse for?', 'Students and graduates in their first few years of work who are looking for internships, graduate programmes and first jobs in Europe.'],
  ['How do I get in?', 'Create an account and you join the waitlist. We let people in a few at a time. Share your personal invite link: each friend who joins with it moves you up. Already a member? You have three invites that let friends skip the waitlist entirely.'],
  ['What does it cost?', 'Agisse is free during the beta. Your first search works while you wait on the waitlist.'],
  ['What does it need from me?', 'Your CV. Import it as a PDF and check the fields it fills: your background is what the ranking and the drafts are built on.'],
  ['What does “Agisse” mean?', 'It is French: the present subjunctive of agir, to act. As in « il faut que j’agisse », I have to act.'],
]

const Doc = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="text-primary underline-offset-4 hover:underline">
    {children}
  </a>
)

// The objections a launch visitor brings, eight at most ("why not an auto-apply bot" is answered under "does it apply for me"). Shown with PUBLIC_LAUNCH.
const LAUNCH_FAQ: [string, ReactNode][] = [
  ['How is the score made?', <>Agisse lists what a posting asks for and checks each point against your CV. Below 4.0 out of 5 it calls the role a long shot and names the gaps. <Doc href="/docs/methodology">How the score works</Doc></>],
  ['Does it apply for me?', 'No, on purpose. Auto-apply bots flood recruiters, who then filter harder. Agisse drafts; you submit and send, from your own accounts.'],
  ['Is it free, and how is it funded?', 'Yes, it’s free: no paid plan, no ads, and your data is never sold. Try it on free AI models. For real use, connect your own OpenRouter key and pay OpenRouter directly. The hosting costs little.'],
  ['Where does my data live?', <>In a database in the EU. With your own AI key, requests go straight to your provider. Download your data or delete your account in Profile at any time. <Doc href="/docs/data-flow">What goes where</Doc></>],
  ['Does Agisse work for employers?', 'No. Agisse is on your side only: it never scores or ranks candidates for employers, never sells or shares your data with them, and no employer can pay to appear in your feed.'],
  ['Who’s behind it?', '[founder name], [one line about you]. Agisse is an open-source project, not a company.'],
  ['Can I use it from Claude, ChatGPT or Codex?', <>From Claude, Codex, Cursor and other MCP clients: sign in with your Agisse account and they can read your feed and tracker. <Doc href="/docs/mcp">Set it up</Doc></>],
  ['Is it open source, and what isn’t open?', <>All the code is open source (AGPL). The job data on agisse.xyz isn’t: the hosted service collects and maintains it. Your own copy starts with an empty feed. <Doc href="/docs/self-host">Run it yourself</Doc></>],
]

const FOOTER: [string, string][] = [
  ['/docs/', 'Docs'],
  ['/docs/mcp', 'MCP'],
  ['/docs/extension', 'Browser extension'],
  ['/docs/privacy', 'Privacy'],
  ['/docs/terms', 'Terms'],
  ['/docs/imprint', 'Imprint'],
  ['mailto:hello@agisse.xyz', 'hello@agisse.xyz'],
]

// MCP and the extension sit in the docs' own menu. Manifesto joins once its docs page exists; the changelog is the repo's file (the flag is on only once the repo is public).
const LAUNCH_FOOTER: [string, string][] = [
  ['/docs/', 'Docs'],
  ['/docs/methodology', 'Methodology'],
  ['/docs/compare/', 'Compare'],
  ['/docs/privacy', 'Privacy'],
  ['/docs/terms', 'Terms'],
  ['/docs/imprint', 'Imprint'],
  ['https://github.com/Agisse/agisse/blob/main/CHANGELOG.md', 'Changelog'],
  ['https://github.com/Agisse/agisse', 'GitHub'],
  ['mailto:hello@agisse.xyz', 'hello@agisse.xyz'],
]

/** The launch footer with GitHub's live numbers (N5). A number GitHub didn't give, or a zero, isn't shown. */
function launchFooter(stats: Stats | null): [string, ReactNode][] {
  return LAUNCH_FOOTER.flatMap(([href, label]): [string, ReactNode][] => {
    if (label !== 'GitHub') return [[href, label]]
    const stars = stats?.stars ? (
      <span className="tabular-nums">
        {' '}
        <span aria-hidden="true">★</span> {stats.stars.toLocaleString('en')}
        <span className="sr-only"> stars</span>
      </span>
    ) : null
    const hired: [string, ReactNode][] = stats?.hired ? [[`${href}/blob/main/HIRED.md`, `${stats.hired} hired with Agisse`]] : []
    return [[href, <>GitHub{stars}</>], ...hired]
  })
}
