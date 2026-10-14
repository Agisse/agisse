import changelog from '../../CHANGELOG.md?raw'
import { inlineParts, parseChangelog } from '../lib/changelog'

const releases = parseChangelog(changelog)

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/** What's new: the user-facing part of CHANGELOG.md, newest first. Linked from the account menu. */
export function ChangelogRoute() {
  return (
    <main className="map map--stack changelog-page">
      <h1 className="display intake__title">What's new</h1>
      {releases.map((r) => (
        <section key={r.version} aria-labelledby={`v-${r.version}`}>
          <h2 id={`v-${r.version}`} className="label label--muted">
            {r.date ? `Version ${r.version}, ${dateLabel(r.date)}` : 'Latest'}
          </h2>
          <ul>
            {r.changes.map((c) => (
              <li key={c}>
                {inlineParts(c).map((p, i) =>
                  p.kind === 'code' ? <code key={i}>{p.text}</code> : p.kind === 'bold' ? <strong key={i}>{p.text}</strong> : p.kind === 'link' ? <a key={i} href={p.href}>{p.text}</a> : p.text,
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
