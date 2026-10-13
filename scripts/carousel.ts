// LinkedIn/Instagram carousel (1080×1350 PDF) for one test provider, from the same catalog as /docs/tests/<provider>.
// npx tsx scripts/carousel.ts pymetrics PYMETRICS   → ../marketing/carousel-pymetrics.pdf
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { PROVIDER_GAMES } from '../shared/assessment-catalog'
import { PROVIDERS } from '../shared/assessments'
import { defaultHowTo } from '../docs/.vitepress/catalog'
import { providerName, slug } from '../docs/.vitepress/names'

const [id, keyword = id.toUpperCase()] = process.argv.slice(2)
const games = PROVIDER_GAMES.filter((g) => g.provider === id)
if (!games.length) throw new Error(`No games for provider "${id}"`)
const name = providerName(id)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const length = (g: (typeof games)[number]) =>
  [g.realDuration ? (g.realDuration < 120 ? `${g.realDuration} s` : `${Math.round(g.realDuration / 60)} min`) : '', g.realRounds ? `${g.realRounds} rounds` : ''].filter(Boolean).join(' · ')

const tactic = (g: (typeof games)[number]) => g.guide?.match(/Tactics: ([^.]+\.)/)?.[1].replace(/^./, (c) => c.toUpperCase())
// Two short tasks per slide; a task with a tip gets its own.
const pairs = games.reduce<(typeof games)[]>((acc, g) => {
  const last = acc[acc.length - 1]
  if (last?.length === 1 && !tactic(last[0]) && !tactic(g)) last.push(g)
  else acc.push([g])
  return acc
}, [])
const total = pairs.length + 3
const mark = readFileSync(resolve('public/favicon.svg'), 'utf8')
const foot = (n: number) => `<footer><span>${mark}Agisse</span><span>${n}/${total}</span></footer>`
const slides = [
  `<section class="cover"><p class="kicker">Online tests, decoded</p><h1>The ${games.length} ${esc(name)} ${games.length > 1 ? 'tasks' : 'task'}, explained</h1><p class="sub">What each one measures, how long it runs, and how it plays. Save this before your invite lands.</p>${foot(1)}</section>`,
  `<section><p class="kicker">Before you start</p><h2>${esc(PROVIDERS.find((p) => p.id === id)?.note ?? `${name} is used by employers to screen graduates and interns.`)}</h2><p class="sub">Practice won't hand you answers. It removes the surprise, so the score reflects you, not the interface.</p>${foot(2)}</section>`,
  ...pairs.map(
    (pair, i) =>
      `<section>${pair
        .map(
          (g) =>
            `<article><h3>${esc(g.name)}</h3><p class="meta">${esc(g.measures)}${length(g) ? ` · ${length(g)}` : ''}</p><p>${esc(g.howTo ?? defaultHowTo(g.gameId))}</p>${tactic(g) ? `<p class="tip"><b>Tip</b> ${esc(tactic(g)!)}</p>` : ''}${g.note?.startsWith('Preference') ? '<p class="note">No better answer: answer as yourself.</p>' : ''}</article>`,
        )
        .join('')}${foot(i + 3)}</section>`,
  ),
  `<section class="cover"><p class="kicker">Practise all ${games.length}</p><h1>Comment “${esc(keyword)}”</h1><p class="sub">I'll send you the full guide and a beta invite to practise every task, timed like the real thing.</p><p class="url">agisse.xyz/docs/tests/${slug(id)}</p>${foot(total)}</section>`,
]

const font = resolve('node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2')
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: G; src: url(file://${font}); font-weight: 400 900 }
@page { size: 1080px 1350px; margin: 0 }
* { margin: 0; box-sizing: border-box }
body { font-family: G, sans-serif; color: #0b1a3a }
section { width: 1080px; height: 1350px; padding: 110px 96px; position: relative; display: flex; flex-direction: column; justify-content: center; gap: 48px; break-after: page; background: #fff }
section.cover { background: radial-gradient(1200px 900px at 100% 0%, #3d63ff 0, #1f45e0 55%, #1636b8 100%); color: #fff }
.cover .kicker, .cover .sub, .cover footer, .cover footer span:first-child { color: rgba(255,255,255,.82) } .cover .url { color: #fff; text-decoration: underline 3px; text-underline-offset: 8px }
.kicker { font-size: 32px; font-weight: 650; color: #1636b8 }

h1 { font-size: 104px; line-height: 1.04; font-weight: 750; letter-spacing: -.035em }
h2 { font-size: 64px; line-height: 1.12; font-weight: 700; letter-spacing: -.02em }
h3 { font-size: 60px; font-weight: 750; letter-spacing: -.03em }
.sub { font-size: 40px; line-height: 1.35; color: #45526e }

article { display: flex; flex-direction: column; gap: 16px; padding-bottom: 40px; border-bottom: 2px solid #e3e8f0 }
article:last-of-type { border: 0 }
.meta { font-size: 30px; font-weight: 600; color: #1636b8 }
article p { font-size: 38px; line-height: 1.38 }
.note { color: #5c6782; font-style: italic }
.tip { background: #e9eefe; padding: 20px 26px; border-radius: 20px } .tip b { color: #1636b8 }
.url { font-size: 36px; font-weight: 700; color: #1f45e0 }
footer { position: absolute; left: 96px; right: 96px; bottom: 56px; display: flex; justify-content: space-between; align-items: center; font-size: 26px; font-weight: 650; color: #5c6782 } footer span:first-child { display: flex; align-items: center; gap: 12px; color: #0b1a3a; font-weight: 800; letter-spacing: -.03em } footer svg { width: 40px; height: 40px }
</style>${slides.join('')}`

const out = resolve('../marketing', `carousel-${slug(id)}.pdf`)
const src = resolve(tmpdir(), `carousel-${slug(id)}.html`)
writeFileSync(src, html)
execFileSync('chromium', ['--headless', '--no-pdf-header-footer', `--print-to-pdf=${out}`, `file://${src}`], { stdio: 'ignore' })
console.log(`${out} (${slides.length} slides)`)
