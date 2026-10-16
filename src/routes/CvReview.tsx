import { AskAssistant } from '@/components/AskAssistant'
import { AiWorking } from '@/components/AiWorking'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { AlertCircle, Check, ClipboardPaste, Copy, FileText, Sparkles, Upload, Wand2 } from 'lucide-react'
import { CHECK_GROUPS, CHECK_GROUP_LABEL, reviewCv, type CvCheck } from '../../shared/cv-review'
import { LINKEDIN_GROUPS, LINKEDIN_GROUP_LABEL, LINKEDIN_TEXT_LIMIT, reviewLinkedin, type LinkedinReview } from '../../shared/linkedin-review'
import { JD_TEXT_LIMIT, RESUME_TEXT_LIMIT } from '../../shared/types'
import { Field, TextField } from '../components/Field'
import { Rate } from '../components/Rate'
import { api, type CvMatch, type JudgedOption, type Me } from '../lib/api'
import { useCopy, useResource } from '../lib/hooks'
import { readPdfText } from '../lib/pdf-text'
import posthog from '../lib/posthog'

export type CvReviewTab = 'score' | 'match' | 'linkedin'

type Source = { text: string; from: 'imported' | 'pdf' | 'pasted'; name?: string }

/** Resume Worded-style review: a rule-based CV score, a keyword match against a posting, and a LinkedIn profile check.
 *  The scores are computed on this device; only rewrites, pasted-posting keywords and headline ideas call a model. */
export function CvReviewRoute({ me, refreshMe, tab }: { me: Me; refreshMe: () => Promise<void>; tab: CvReviewTab }) {
  const stored = useResource(() => api.cv(), [])
  const [picked, setPicked] = useState<Source | null>(null)
  const imported = stored.data?.resumeText?.trim()
  const source: Source | null = picked ?? (imported ? { text: imported, from: 'imported' } : null)
  const exhausted = me.budget.used >= me.budget.limit

  return (
    <main className="map map--stack cv-review">
      <div className="intake">
        <nav className="posting-tabs" aria-label="CV review">
          <Link href="/prepare/cv" aria-current={tab === 'score' ? 'page' : undefined}>Score my CV</Link>
          <Link href="/prepare/cv/match" aria-current={tab === 'match' ? 'page' : undefined}>Job match</Link>
          <Link href="/prepare/cv/linkedin" aria-current={tab === 'linkedin' ? 'page' : undefined}>LinkedIn</Link>
        </nav>
        {tab !== 'linkedin' &&
          (stored.loading && !stored.data ? (
            <CvSourceGhost />
          ) : (
            <CvSource source={source} hasImported={!!imported} onPick={setPicked} />
          ))}
        {tab === 'score' && source && <ScoreTab me={me} source={source} exhausted={exhausted} refreshMe={refreshMe} />}
        {tab === 'match' && source && <MatchTab cv={source.text} stored={source.from === 'imported'} exhausted={exhausted} onSpend={refreshMe} />}
        {tab === 'linkedin' && <LinkedinTab me={me} exhausted={exhausted} onSpend={refreshMe} />}
      </div>
    </main>
  )
}

/* ---------- Which CV is checked ---------- */

/** The source line and its upload button, drawn before the stored résumé answers. */
function CvSourceGhost() {
  return (
    <section className="cv-source" aria-busy="true" aria-label="CV to check">
      <p>
        <FileText aria-hidden="true" />{' '}
        <span aria-hidden="true">
          {/* The real sentence, invisible: the placeholder wraps exactly like the loaded line at every width. */}
          <span className="feed-ghost cv-source__ghost-text">Checking the résumé you imported on your profile. Nothing you drop or paste here is stored.</span>
        </span>
      </p>
      <div className="posting__actions" aria-hidden="true">
        <span className="feed-ghost cv-source__ghost-btn" />
      </div>
      <p className="sr-only" role="status">Loading your résumé…</p>
    </section>
  )
}

function CvSource({ source, hasImported, onPick }: { source: Source | null; hasImported: boolean; onPick: (s: Source | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setReading(true)
    try {
      const t = await readPdfText(file)
      if (t.length < 200) throw new Error('That PDF has almost no readable text. If it is a scan, export a text version and try again.')
      onPick({ text: t, from: 'pdf', name: file.name })
      setPasting(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that PDF')
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  const checking = !source ? null : source.from === 'imported' ? 'the résumé you imported on your profile' : source.from === 'pdf' ? source.name : 'the text you pasted'

  return (
    <section className="cv-source" aria-label="CV to check">
      <p>
        <FileText aria-hidden="true" />{' '}
        <span>
          {checking ? (
            <>
              Checking <strong>{checking}</strong>. Nothing you drop or paste here is stored.
            </>
          ) : (
            'No résumé imported yet. Drop a PDF or paste your CV to check it.'
          )}
        </span>
      </p>
      <div className="posting__actions">
        <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void readFile(e.target.files?.[0])} />
        <button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={reading} aria-busy={reading}>
          <Upload aria-hidden="true" /> {reading ? 'Reading…' : source ? 'Check another PDF' : 'Upload a PDF'}
        </button>
        <button type="button" className="btn btn--sm btn--quiet" onClick={() => setPasting((v) => !v)} aria-expanded={pasting}>
          <ClipboardPaste aria-hidden="true" /> Paste text
        </button>
        {source && source.from !== 'imported' && hasImported && (
          <button type="button" className="btn btn--sm btn--quiet" onClick={() => onPick(null)}>
            Back to my imported résumé
          </button>
        )}
      </div>
      {pasting && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim().length < 100) return setError('Paste the whole CV: that is too short to review.')
            setError(null)
            onPick({ text: text.trim(), from: 'pasted' })
            setPasting(false)
          }}
        >
          <TextField id="cv-paste" label="Your CV" hint="plain text, one line per bullet" rows={10} maxLength={RESUME_TEXT_LIMIT} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            Check this CV
          </button>
        </form>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
    </section>
  )
}

/* ---------- Score ---------- */

function ScoreSign({ score, band, children }: { score: number; band: string; children?: ReactNode }) {
  return (
    <div className={`verdict${score >= 85 ? ' verdict--apply_now' : ''}`}>
      <span className="verdict__score display tnum">
        {score}
        <small>/100</small>
      </span>
      <div>
        <p className="verdict__label label">{band}</p>
        {children}
      </div>
    </div>
  )
}

function ScoreTab({ me, source, exhausted, refreshMe }: { me: Me; source: Source; exhausted: boolean; refreshMe: () => Promise<void> }) {
  const review = useMemo(() => reviewCv(source.text, me.profile), [source.text, me.profile])
  const saved = useRef('')

  // Each distinct CV is scored once into the profile summary (the Today tile), not on every render.
  useEffect(() => {
    const key = `${source.from}:${review.score}:${source.text.length}`
    if (saved.current === key) return
    saved.current = key
    const failed = review.checks.filter((c) => !c.pass).map((c) => c.id)
    posthog.capture('cv_reviewed', { score: review.score, source: source.from })
    api.saveCvReview({ score: review.score, failed }).then(() => refreshMe(), () => {})
  }, [review, source, refreshMe])

  const passed = review.checks.filter((c) => c.pass).length
  return (
    <div className="cv-review__body">
      <ScoreSign score={review.score} band={review.band}>
        <p className="verdict__tldr">
          {passed} of {review.checks.length} checks pass · {review.bullets} bullet{review.bullets === 1 ? '' : 's'} · about {review.words} words
        </p>
        <p className="verdict__note">85 or above is a strong CV; 90 or above is exceptional.</p>
      </ScoreSign>

      {/* Lines to fix come first; passing checks wait behind one fold. */}
      {[false, true].map((pass) => {
        const groups = CHECK_GROUPS.map((g) => {
          const all = review.checks.filter((c) => c.group === g)
          const checks = all.filter((c) => c.pass === pass)
          if (!checks.length) return null
          return (
            <section key={g} className="posting__block" aria-labelledby={`grp-${g}-${pass}`}>
              <h2 id={`grp-${g}-${pass}`} className="label">
                {CHECK_GROUP_LABEL[g]} · {all.filter((c) => c.pass).length}/{all.length}
              </h2>
              <ol className="reqs">
                {checks.map((c) => (
                  <CheckRow key={c.id} check={c} cv={source.from === 'imported' ? undefined : source.text} exhausted={exhausted} onSpend={refreshMe} />
                ))}
              </ol>
            </section>
          )
        })
        if (!pass) return groups
        return passed > 0 && (
          <details key="passed" className="posting__block posting__fold">
            <summary className="label">Show the {passed} passing {passed === 1 ? 'check' : 'checks'}</summary>
            {groups}
          </details>
        )
      })}
      <p className="booth__model">Rule checks on your text, run on this device. They are a recruiter's skim, not a verdict: a line can break a rule for a good reason. Rewrites use only facts already in your CV; still read each one.</p>
    </div>
  )
}

function CheckRow({ check, cv, exhausted, onSpend }: { check: CvCheck | LinkedinReview['checks'][number]; cv?: string; exhausted?: boolean; onSpend?: () => Promise<void> }) {
  const rewritable = 'rewritable' in check && check.rewritable && !!onSpend
  return (
    <li className={`req req--${check.pass ? 'strong' : 'missing'}`}>
      <span className="req__match label">{check.pass ? 'Pass' : 'Fix'}</span>
      <div>
        <p className="req__name">{check.label}</p>
        <p className="req__evidence">{check.tip}</p>
        {!check.pass && <AskAssistant question={`My CV fails the check “${check.label}”. How do I fix it, using only what is already true in my CV?`}>How do I fix this?</AskAssistant>}
        {check.lines.length > 0 && (
          <ul className="cv-lines">
            {check.lines.map((line) => (
              <li key={line}>
                <span className="cv-lines__text">{line}</span>
                {rewritable && <Rewrite line={line} check={check.id} cv={cv} exhausted={!!exhausted} onSpend={onSpend!} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function CopyLine({ text, pick, unsupported }: { text: string; pick?: boolean; unsupported?: boolean }) {
  const { copied, copy } = useCopy()
  return (
    <li className={unsupported ? 'is-unsupported' : undefined}>
      <span>
        {pick && <span className="jev-pick label">Jev's pick</span>}
        {text}
        {unsupported && <small className="jev-warn">Jev: may claim more than your CV says. Check before you use it.</small>}
      </span>
      <button type="button" className="btn btn--quiet btn--sm" onClick={() => void copy(text)} aria-label={`Copy: ${text}`}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
      </button>
    </li>
  )
}

/** The LLM writes three versions of a flagged line; code drops invented numbers and names, Jev drops unsupported claims and picks the strongest. */
function Rewrite({ line, check, cv, exhausted, onSpend }: { line: string; check: string; cv?: string; exhausted: boolean; onSpend: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [out, setOut] = useState<{ options: JudgedOption[]; note: string; refId: string } | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.rewriteLine({ line, check, cv })
      posthog.capture('bullet_rewritten', { check, options: r.options.length })
      setOut(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rewrite the line')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  if (!out)
    return (
      <>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => void run()} disabled={busy || exhausted} aria-busy={busy}>
          <Wand2 aria-hidden="true" /> {busy ? 'Rewriting…' : 'Rewrite'}
        </button>
        {error && <span className="field__error" role="alert">{error}</span>}
      </>
    )
  return (
    <div className="rewrite" aria-live="polite">
      <ol className="rewrite__options">
        {out.options.map((o) => (
          <CopyLine key={o.text} text={o.text} pick={o.pick} unsupported={o.unsupported} />
        ))}
      </ol>
      {out.note && <p className="req__evidence">{out.note}</p>}
      <Rate key={out.refId} task="agisse_bullet" refId={out.refId} />
    </div>
  )
}

/* ---------- Job match ---------- */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The CV with each matched keyword marked, so the seeker sees where a screener would find it. */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <pre className="cv-text">{text}</pre>
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${keywords.map(escape).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const parts = text.split(re)
  return <pre className="cv-text">{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</pre>
}

function MatchTab({ cv, stored, exhausted, onSpend }: { cv: string; stored: boolean; exhausted: boolean; onSpend: () => Promise<void> }) {
  const jobs = useResource(() => api.jobs().then((r) => r.jobs), [])
  const [jobId, setJobId] = useState('')
  const [jd, setJd] = useState('')
  const [busy, setBusy] = useState<'board' | 'pasted' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ cv: string; match: CvMatch } | null>(null)
  // A match describes the CV it was run on; another PDF or pasted text hides it.
  const result = done?.cv === cv ? done.match : null

  // A CV picked on this page goes along; the imported one is read on the server.
  const run = async (body: { jobId?: string; jdText?: string }, source: 'board' | 'pasted') => {
    setError(null)
    setBusy(source)
    try {
      const r = await api.cvMatch({ ...body, cv: stored ? undefined : cv })
      posthog.capture('cv_matched', { match_pct: r.pct, recruiter_pct: r.recruiterPct, in_other_words: r.inOtherWords.length, fit: r.fit?.fit ?? null, source })
      setDone({ cv, match: r })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not match the posting')
    } finally {
      setBusy(null)
      void onSpend()
    }
  }

  return (
    <div className="cv-review__body">
      <section className="posting__block" aria-label="Posting to match">
        {!!jobs.data?.length && (
          <div className="field">
            <label className="field__label label" htmlFor="match-job">
              <span>A posting on your board</span>
              <span className="field__hint">its keywords are already known</span>
            </label>
            <select
              id="match-job"
              className="field__input"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={!!busy || exhausted}
            >
              <option value="">Pick a posting…</option>
              {jobs.data.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} · {j.role}
                </option>
              ))}
            </select>
          </div>
        )}
        <TextField id="match-jd" label={jobs.data?.length ? 'Or paste a posting' : 'Paste a posting'} hint="the whole text · a model pulls its keywords" rows={6} maxLength={JD_TEXT_LIMIT} value={jd}
          onChange={(e) => {
            setJd(e.target.value)
            setJobId('')
          }}
        />
        <div className="posting__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void (jobId ? run({ jobId }, 'board') : run({ jdText: jd }, 'pasted'))}
            disabled={!!busy || exhausted || (!jobId && jd.trim().length < 200)}
            aria-busy={!!busy}
          >
            <Sparkles aria-hidden="true" /> {busy ? 'Reading…' : 'Match my CV'}
          </button>
        </div>
        {busy && <AiWorking steps={[...(busy === 'pasted' ? ['Pulling the keywords from the posting'] : []), 'Reading your CV for each keyword', 'Marking what is missing']} shape="lines" />}
        {error && (
          <p className="notice notice--error" role="alert">
            <AlertCircle aria-hidden="true" /> <span>{error}</span>
          </p>
        )}
      </section>

      {result && !busy && (
        <div aria-live="polite" className="cv-review__body">
          <ScoreSign score={result.pct} band={result.pct >= 75 ? 'Strong match' : result.pct >= 50 ? 'Partial match' : 'Weak match'}>
            <p className="verdict__tldr">
              {result.matched.length} of {result.keywords.length} keywords from {result.label} are in your CV word for word
              {result.inOtherWords.length > 0 && <>, and {result.inOtherWords.length} more in other words ({result.recruiterPct}% to a recruiter)</>}.
            </p>
            {result.fit && <p className="verdict__note">Jev's fit verdict: {result.fit.label}.</p>}
            {result.jobId && (
              <p className="verdict__note">
                <Link href={`/jobs/${result.jobId}/cv`}>Tailor my CV for this posting</Link>
              </p>
            )}
          </ScoreSign>
          <section className="posting__block" aria-labelledby="kw-missing">
            <h2 id="kw-missing" className="label">Missing · {result.missing.length}</h2>
            {result.missing.length ? (
              <ul className="kw-chips">
                {result.missing.map((k) => (
                  <li key={k} className="kw kw--miss">{k}</li>
                ))}
              </ul>
            ) : (
              <p>Nothing missing: every keyword is in your CV, word for word or in other words.</p>
            )}
            {result.inOtherWords.length > 0 && (
              <>
                <h2 className="label">In other words · {result.inOtherWords.length}</h2>
                <p className="req__evidence">Your CV shows these, but not in the posting's words. A recruiter will see them; a simple applicant tracking system will not. Use the posting's wording where it is true.</p>
                <ul className="kw-chips">
                  {result.inOtherWords.map((k) => (
                    <li key={k} className="kw kw--near">{k}</li>
                  ))}
                </ul>
              </>
            )}
            <h2 className="label">Word for word · {result.matched.length}</h2>
            <ul className="kw-chips">
              {result.matched.map((k) => (
                <li key={k} className="kw kw--hit">
                  <Check aria-hidden="true" /> {k}
                </li>
              ))}
            </ul>
            <p className="booth__model">The percentage is the exact match a simple applicant tracking system does. "In other words" and the fit verdict come from Jev, a decision model, reading your CV. Add a keyword only where your experience backs it.</p>
          </section>
          <details className="posting__block posting__fold">
            <summary className="label">Show where they appear in my CV</summary>
            <Highlighted text={cv} keywords={result.matched} />
          </details>
        </div>
      )}
    </div>
  )
}

/* ---------- LinkedIn ---------- */

function LinkedinTab({ me, exhausted, onSpend }: { me: Me; exhausted: boolean; onSpend: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [headline, setHeadline] = useState('')
  const [review, setReview] = useState<LinkedinReview | null>(null)
  const [ideas, setIdeas] = useState<JudgedOption[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    if (text.trim().length < 50) return setError('Paste the text of your profile page first.')
    setError(null)
    const r = reviewLinkedin({ text, url, headline }, me.profile)
    posthog.capture('linkedin_reviewed', { score: r.score, source: 'pasted' })
    setReview(r)
    setIdeas(null)
  }

  const suggest = async () => {
    setBusy(true)
    setError(null)
    try {
      setIdeas((await api.headlines(review?.headline ?? headline)).headlines)
      posthog.capture('headlines_suggested')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write headlines')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <div className="cv-review__body">
      <section className="posting__block" aria-label="Your LinkedIn profile">
        <p>
          Open your own LinkedIn profile and click the <Link href="/extension">Agisse extension</Link> for a review in one click. Or select all the text on your profile page (Ctrl+A, Ctrl+C) and paste it here. Agisse never opens LinkedIn itself.
        </p>
        <TextField id="li-text" label="Your profile page" hint="pasted text · not stored" rows={8} maxLength={LINKEDIN_TEXT_LIMIT} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="index-card__row">
          <Field id="li-url" label="Profile URL" hint="optional" placeholder="linkedin.com/in/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Field id="li-headline" label="Headline" hint="optional · read from the page if empty" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div className="posting__actions">
          <button type="button" className="btn btn--primary" onClick={run}>
            Review my profile
          </button>
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            <AlertCircle aria-hidden="true" /> <span>{error}</span>
          </p>
        )}
      </section>

      {review && (
        <div aria-live="polite" className="cv-review__body">
          <ScoreSign score={review.score} band={review.band}>
            <p className="verdict__tldr">{review.headline ? <>Headline read as “{review.headline}”.</> : 'No headline found.'}</p>
          </ScoreSign>
          {LINKEDIN_GROUPS.map((g) => {
            const checks = review.checks.filter((c) => c.group === g)
            if (!checks.length) return null
            return (
              <section key={g} className="posting__block" aria-labelledby={`li-${g}`}>
                <h2 id={`li-${g}`} className="label">
                  {LINKEDIN_GROUP_LABEL[g]} · {checks.filter((c) => c.pass).length}/{checks.length}
                </h2>
                <ol className="reqs">
                  {checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </ol>
              </section>
            )
          })}
          <section className="posting__block" aria-labelledby="li-ideas">
            <h2 id="li-ideas" className="label">Headline ideas</h2>
            {ideas ? (
              <ol className="rewrite__options">
                {ideas.map((h) => (
                  <CopyLine key={h.text} text={h.text} pick={h.pick} unsupported={h.unsupported} />
                ))}
              </ol>
            ) : (
              <p>Written from your CV and the roles on your board, then checked by Jev for claims your CV does not back.</p>
            )}
            <div className="posting__actions">
              <button type="button" className="btn" onClick={() => void suggest()} disabled={busy || exhausted} aria-busy={busy}>
                <Wand2 aria-hidden="true" /> {busy ? 'Writing…' : ideas ? 'Three more' : 'Suggest headlines'}
              </button>
            </div>
            {busy && <AiWorking steps={['Reading your CV and your board', 'Writing headlines', 'Checking each one against your CV']} expected={20} shape="lines" />}
          </section>
        </div>
      )}
    </div>
  )
}
