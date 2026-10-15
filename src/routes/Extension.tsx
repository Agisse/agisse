import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { BookmarkPlus, Check, Download, PenLine, Plus, ScanSearch, UserPlus, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Kbd } from '../components/ui/kbd'

const STEPS: ReactNode[] = [
  <>
    <a href="/agisse-extension.zip" download className="font-medium text-foreground underline underline-offset-4 hover:text-primary">Download the extension</a> and unzip it where it can stay. Deleting the folder removes it.
  </>,
  <>
    Open <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">chrome://extensions</code>, turn on <strong className="font-medium text-foreground">Developer mode</strong>, click <strong className="font-medium text-foreground">Load unpacked</strong> and pick the folder.
  </>,
  <>Pin it: puzzle icon next to the address bar, then the pin next to Agisse.</>,
]

const b = (text: string) => <strong className="font-medium text-foreground">{text}</strong>
const link = 'text-foreground underline underline-offset-4 hover:text-primary'

const USES: [LucideIcon, string, ReactNode][] = [
  [
    BookmarkPlus,
    'On a job posting',
    <>
      Click the Agisse icon, then {b('Save posting')}. It lands in <Link href="/jobs?view=track&status=saved" className={link}>Saved</Link> for free, with its deadline when the page states one. {b('Save and evaluate')} opens Jobs and scores it against your CV at once. Select part of the page first to send only that part. <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>S</Kbd> saves without opening the popup.
    </>,
  ],
  [
    ScanSearch,
    'On LinkedIn Jobs, Indeed, StepStone and the common application sites',
    <>
      Greenhouse, Lever, Ashby, Workday, Personio and more: a small Agisse button sits in the corner. Click it to see whether the posting is already on your board, when you applied and which of its keywords your CV misses. After you submit an application, it asks whether to mark the posting applied.
    </>,
  ],
  [
    UserPlus,
    'On a LinkedIn profile',
    <>
      Click {b('Save contact')}. <Link href="/contacts?view=contacted" className={link}>People</Link> opens with the person marked contacted.
    </>,
  ],
  [
    PenLine,
    'On an application form',
    <>
      Signed in, click {b("Draft answers to this form's questions")}. It drafts each answer from your CV in the popup; copy it, paste it in and submit yourself. {b('Your saved answers for this form')} shows the notice period, salary or work-permit answer a field asks for, from your <Link href="/profile" className={link}>Profile</Link>, ready to copy.
    </>,
  ],
]

const NEVER = [
  'Sends nothing until you click. The corner button on job sites reads only the posting on screen.',
  'No messages, connection requests, LinkedIn login, typing into forms or submitting.',
  'Holds no account or cookies: saving happens on the Agisse page it opens, signed in as you.',
]

const HELP: ReactNode[] = [
  '“This page cannot be read”: browser pages, PDFs and some app pages block extensions. Paste the text into Jobs instead.',
  'Agisse opens but nothing is filled: you are signed out. Sign in, go back and click again.',
  <>
    New version: download the zip again, replace the folder contents and click the reload arrow on <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">chrome://extensions</code>.
  </>,
]

const H2 = 'text-lg font-semibold tracking-tight'

/** How to install the browser extension and what it does. Linked from Jobs and the Visited page. */
export function ExtensionRoute() {
  return (
    <main className="map">
      <div className="mx-auto max-w-[44rem]">
        <header>
          <h1 className="page-title">Browser extension</h1>
          <p className="mt-2 max-w-[38rem] text-pretty text-muted-foreground">Save postings and LinkedIn contacts in one click, and draft answers to an application's questions for you to paste in.</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button nativeButton={false} className="h-11 rounded-full px-5" render={<a href="/agisse-extension.zip" download />}>
              <Download data-icon="inline-start" aria-hidden="true" /> Download the extension
            </Button>
            <span className="text-sm text-muted-foreground">Chrome, Edge and Brave</span>
          </div>
        </header>

        <section aria-labelledby="ext-install" className="mt-12">
          <h2 id="ext-install" className={H2}>Install</h2>
          <ol className="mt-4 grid gap-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ext-use" className="mt-12">
          <h2 id="ext-use" className={H2}>Use</h2>
          <ul className="mt-2 divide-y divide-border/70">
            {USES.map(([Icon, title, text]) => (
              <li key={title} className="flex gap-4 py-5">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-[1.125rem]" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium text-balance">{title}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ext-never" className="mt-12">
          <h2 id="ext-never" className={H2}>What it never does</h2>
          <ul className="mt-4 grid gap-3">
            {NEVER.map((t) => (
              <li key={t} className="flex gap-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
                <Check className="mt-1 size-4 shrink-0 text-[var(--green)]" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <details className="group mt-12 border-y border-border">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-3 font-medium [&::-webkit-details-marker]:hidden">
            If it does not work
            <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
          </summary>
          <ul className="grid gap-3 pb-5">
            {HELP.map((t, i) => (
              <li key={i} className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t}</li>
            ))}
          </ul>
        </details>
      </div>
    </main>
  )
}
