import { useEffect } from 'react'
import { inlineParts, leadOf } from '../lib/changelog'
import { markNewsSeen, releases } from '../lib/whats-new'

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/** Keep a Changelog's headings, in a seeker's words. */
const GROUP: Record<string, string> = { Added: 'New', Changed: 'Improved', Fixed: 'Fixed', Removed: 'Removed', Security: 'Security', Deprecated: 'On the way out' }

function Inline({ text }: { text: string }) {
  return inlineParts(text).map((p, i) =>
    p.kind === 'code' ? (
      <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">{p.text}</code>
    ) : p.kind === 'bold' ? (
      <strong key={i} className="font-medium text-foreground">{p.text}</strong>
    ) : p.kind === 'link' ? (
      <a key={i} href={p.href} className="text-foreground underline underline-offset-4 hover:text-primary">{p.text}</a>
    ) : (
      p.text
    ),
  )
}

/** What's new: the user-facing part of CHANGELOG.md, newest first, grouped as the changelog groups it. Linked from the account menu. */
export function ChangelogRoute() {
  useEffect(markNewsSeen, [])
  return (
    <main className="map">
      <div className="mx-auto max-w-[44rem]">
        <header>
          <h1 className="page-title">What's new</h1>
          <p className="mt-2 text-pretty text-muted-foreground">The changes that matter to you, newest first.</p>
        </header>

        {releases.map((r) => (
          <section key={r.version} aria-labelledby={`v-${r.version}`} className="mt-12 first-of-type:mt-10">
            <h2 id={`v-${r.version}`} className="flex items-baseline gap-2 border-b border-border pb-3 text-sm font-medium">
              {r.date ? (
                <>
                  <span>{dateLabel(r.date)}</span>
                  <span className="text-muted-foreground tabular-nums">Version {r.version}</span>
                </>
              ) : (
                <span>Recent changes</span>
              )}
            </h2>

            {r.groups.map((g) => (
              <section key={g.title} aria-label={GROUP[g.title] ?? (g.title || undefined)} className="mt-8">
                {g.title && (
                  <h3 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
                    {GROUP[g.title] ?? g.title}
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">{g.changes.length}</span>
                  </h3>
                )}
                <ul className="mt-2 divide-y divide-border/70">
                  {g.changes.map((c) => {
                    const split = leadOf(c)
                    return (
                      <li key={c} className="py-3.5 text-[0.9375rem] leading-relaxed text-pretty text-foreground/75">
                        {split ? (
                          <>
                            <span className="font-medium text-foreground"><Inline text={split.lead} />:</span> <Inline text={split.rest} />
                          </>
                        ) : (
                          <Inline text={c} />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </section>
        ))}
      </div>
    </main>
  )
}
