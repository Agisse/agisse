import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './solve.css'

type Rand = () => number
export const ATTRS = ['Temperature', 'Salinity', 'Acidity'] as const
export const TRAITS = ['Aerobic', 'Motile', 'Spore-forming', 'Filamentous', 'Phototrophic', 'Biofilm'] as const
export type Microbe = { id: string; attrs: number[]; traits: string[]; uptake: number }
/** ranges[i] = [lo, hi] on the 1–10 scale for ATTRS[i]; want must appear in the set, avoid must not. */
export type Site = { name: string; ranges: [number, number][]; want: string; avoid: string; pool: Microbe[] }

export const SHORTLIST_MAX = 10
const SITES = ['Kelp shelf', 'Harbour basin', 'Reef lagoon', 'Estuary mouth', 'Trench slope', 'Fjord inlet']
const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const pickN = <T,>(xs: readonly T[], n: number, rand: Rand) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a.slice(0, n)
}

/** Range width shrinks from 4 points (level 1) to 1 (level 9+); the pool grows from 15 to 24 microbes. A valid set is planted, so one always exists. */
export function makeSite(level: number, rand: Rand = Math.random): Site {
  const w = Math.max(1, 4 - Math.floor(level / 3))
  const ranges = ATTRS.map((): [number, number] => {
    const lo = int(1, 10 - w, rand)
    return [lo, lo + w]
  })
  const [want, avoid] = pickN(TRAITS, 2, rand) as [string, string]
  const ids = pickN(Array.from({ length: 900 }, (_, i) => i + 100), 14 + level, rand)
  const pool: Microbe[] = ids.map((n) => ({
    id: `SW-${n}`,
    attrs: ATTRS.map(() => int(1, 10, rand)),
    traits: pickN(TRAITS, int(1, 3, rand), rand),
    uptake: int(1, 9, rand),
  }))
  // Plant a valid trio: integer attribute sums whose average lands in range, the wanted trait on one, the avoided trait on none.
  const planted = pickN(pool, 3, rand)
  ranges.forEach(([lo, hi], i) => {
    const s = int(3 * lo, 3 * hi, rand)
    const a = int(Math.max(1, s - 20), Math.min(10, s - 2), rand)
    const b = int(Math.max(1, s - a - 10), Math.min(10, s - a - 1), rand)
    ;[a, b, s - a - b].forEach((v, k) => (planted[k]!.attrs[i] = v))
  })
  for (const m of planted) m.traits = m.traits.filter((t) => t !== avoid)
  if (!planted[0]!.traits.includes(want)) planted[0]!.traits.push(want)
  for (const m of planted) if (!m.traits.length) m.traits.push(want)
  return { name: SITES[int(0, SITES.length - 1, rand)]!, ranges, want, avoid, pool }
}

export const average = (set: Microbe[], i: number) => set.reduce((s, m) => s + m.attrs[i]!, 0) / set.length
export const uptake = (set: Microbe[]) => set.reduce((s, m) => s + m.uptake, 0)

/** Three microbes whose attribute averages sit in every range, with the wanted trait at least once and the avoided trait never. */
export function isValid(site: Site, set: Microbe[]) {
  return (
    set.length === 3 &&
    site.ranges.every(([lo, hi], i) => average(set, i) >= lo - 1e-9 && average(set, i) <= hi + 1e-9) &&
    set.some((m) => m.traits.includes(site.want)) &&
    !set.some((m) => m.traits.includes(site.avoid))
  )
}

/** Highest total uptake over valid trios and every trio reaching it. ponytail: brute force, C(24,3) = 2024 trios. */
export function solveSite(site: Site) {
  const p = site.pool
  let best = 0
  let sets: Microbe[][] = []
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++)
      for (let k = j + 1; k < p.length; k++) {
        const s = [p[i]!, p[j]!, p[k]!]
        if (!isValid(site, s)) continue
        const u = uptake(s)
        if (u > best) [best, sets] = [u, [s]]
        else if (u === best) sets.push(s)
      }
  return { best, sets }
}

/** Scores a submitted site. ratio = uptake / best uptake when valid, else 0. */
export function judgeSite(site: Site, final: Microbe[], shortlist: Microbe[]) {
  const { best, sets } = solveSite(site)
  const valid = isValid(site, final)
  const inList = new Set(shortlist.map((m) => m.id))
  const optimal = new Set(sets.flat().map((m) => m.id))
  const optimalShortlisted = sets.some((s) => s.every((m) => inList.has(m.id)))
  const pct = valid ? Math.round((uptake(final) / best) * 100) : 0
  return {
    valid,
    ratio: valid ? uptake(final) / best : 0,
    best,
    optimalShortlisted,
    picks: final.map((m) => optimal.has(m.id)),
    kind: `site:${valid ? 1 : 0}:${pct}:${shortlist.length}:${optimalShortlisted ? 1 : 0}`,
  }
}

/** validRate, scoreRatio (mean of uptake / best, 0 for invalid sets), shortlistSize, optimalShortlisted, pickAccuracy. */
export function seaWolfDetails(trials: Trial[]) {
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  const sites = trials.flatMap((t) => (t.kind?.startsWith('site:') ? [t.kind.split(':').map(Number)] : []))
  if (!sites.length) return { validRate: 0, scoreRatio: 0, shortlistSize: 0, optimalShortlisted: 0, pickAccuracy: 0 }
  const mean = (i: number, f = 1) => r3(sites.reduce((s, x) => s + x[i]!, 0) / sites.length / f)
  return {
    validRate: mean(1),
    scoreRatio: mean(2, 100),
    shortlistSize: mean(3),
    optimalShortlisted: mean(4),
    pickAccuracy: mean(5, 3),
  }
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString()

function SeaWolfGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [site, setSite] = useState(() => makeSite(level))
  const [shortlist, setShortlist] = useState<string[]>([])
  const [final, setFinal] = useState<string[]>([])
  const [result, setResult] = useState<ReturnType<typeof judgeSite> | null>(null)
  const [played, setPlayed] = useState(0)
  const startedAt = useRef(0)
  const siteLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    startedAt.current = performance.now()
    siteLevel.current = levelRef.current
  }, [site])

  const byId = (id: string) => site.pool.find((m) => m.id === id)!
  const chosen = final.map(byId)
  const showAverages = siteLevel.current <= 4

  function toggleShort(id: string) {
    if (result) return
    if (shortlist.includes(id)) {
      setShortlist(shortlist.filter((x) => x !== id))
      setFinal(final.filter((x) => x !== id))
    } else if (shortlist.length < SHORTLIST_MAX) setShortlist([...shortlist, id])
  }
  function toggleFinal(id: string) {
    if (result) return
    if (final.includes(id)) setFinal(final.filter((x) => x !== id))
    else if (final.length < 3) setFinal([...final, id])
  }
  function submit() {
    if (result || final.length !== 3) return
    const r = judgeSite(site, chosen, shortlist.map(byId))
    const rt = performance.now() - startedAt.current
    // One trial per site; how many of the three picks belong to an optimal trio rides along in the kind.
    onTrial({ correct: r.valid && r.ratio === 1, rt, level: siteLevel.current, kind: `${r.kind}:${r.picks.filter(Boolean).length}` })
    setPlayed(played + 1)
    if (feedback) setResult(r)
    else next(played + 1)
  }
  function next(done = played) {
    if (rounds && done >= rounds) return onDone?.()
    setResult(null)
    setShortlist([])
    setFinal([])
    setSite(makeSite(levelRef.current))
  }

  return (
    <div className="game solve">
      <div className="game__prompt">
        Site {played + (result ? 0 : 1)}
        {rounds ? ` of ${rounds}` : ''} · {site.name}. Shortlist up to {SHORTLIST_MAX} microbes, then pick 3 whose average attributes fit every range. Include the wanted trait, never the
        avoided one, and maximise total uptake.
      </div>
      <div className="solve-cols">
        <section className="solve-panel" aria-label="Site requirements">
          <h3 className="solve-panel__head">Site requirements</h3>
          <table className="solve-table">
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Range</th>
                {showAverages && <th>Your average</th>}
              </tr>
            </thead>
            <tbody>
              {ATTRS.map((a, i) => {
                const [lo, hi] = site.ranges[i]!
                const avg = chosen.length ? average(chosen, i) : null
                const off = avg !== null && chosen.length === 3 && (avg < lo - 1e-9 || avg > hi + 1e-9)
                return (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>
                      {lo}–{hi}
                    </td>
                    {showAverages && <td data-bad={off}>{avg === null ? '–' : fmt(avg)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="solve-note">
            Wanted trait: <strong>{site.want}</strong> · Avoid: <strong>{site.avoid}</strong>
          </p>
        </section>
        <section className="solve-panel" aria-label="Shortlist">
          <h3 className="solve-panel__head">
            Shortlist {shortlist.length}/{SHORTLIST_MAX} · treatment {final.length}/3
          </h3>
          {shortlist.length === 0 && <p className="solve-note">Add microbes from the catalogue below.</p>}
          <ul className="solve-list">
            {shortlist.map((id) => (
              <li key={id}>
                <label className="field--check">
                  <input type="checkbox" checked={final.includes(id)} disabled={!!result || (!final.includes(id) && final.length >= 3)} onChange={() => toggleFinal(id)} />
                  {id}
                </label>
                <span className="solve-muted">uptake {byId(id).uptake}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ink" disabled={final.length !== 3 || !!result} onClick={submit}>
            Release treatment
          </button>
        </section>
      </div>
      <section className="solve-panel solve-wide" aria-label="Microbe catalogue">
        <h3 className="solve-panel__head">Microbe catalogue</h3>
        <div className="solve-scroll">
          <table className="solve-table">
            <thead>
              <tr>
                <th>Microbe</th>
                {ATTRS.map((a) => (
                  <th key={a}>{a}</th>
                ))}
                <th>Uptake</th>
                <th>Traits</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {site.pool.map((m) => {
                const on = shortlist.includes(m.id)
                return (
                  <tr key={m.id} data-on={on}>
                    <td>{m.id}</td>
                    {m.attrs.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                    <td>{m.uptake}</td>
                    <td className="solve-traits">{m.traits.join(', ')}</td>
                    <td>
                      <button type="button" className="btn btn--sm" disabled={!!result || (!on && shortlist.length >= SHORTLIST_MAX)} onClick={() => toggleShort(m.id)}>
                        {on ? 'Remove' : 'Shortlist'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="game__keys">Tab to move · Space or Enter to shortlist or release · Enter for next site</div>
      <div className={`game__feedback ${result ? (result.valid ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {result &&
          (result.valid
            ? `Valid treatment: uptake ${uptake(chosen)} of a possible ${result.best}.`
            : `Invalid: check the averages and traits. The best valid set reaches uptake ${result.best}.`)}
      </div>
      {result && (
        <button type="button" className="btn" autoFocus onClick={() => next()}>
          {rounds && played >= rounds ? 'Finish' : 'Next site'}
        </button>
      )}
    </div>
  )
}

export const seaWolf: GameDef = {
  id: 'sea-wolf',
  name: 'Sea Wolf',
  skills: ['logical-reasoning'],
  howTo: 'For each site, shortlist microbes and release three whose average attributes fit the ranges, with the wanted trait and without the avoided one, at the highest total uptake.',
  duration: 1950,
  targetRt: 240000,
  Component: SeaWolfGame satisfies ComponentType<GameProps>,
  details: seaWolfDetails,
}
