import { useState } from 'react'
import { Link } from 'wouter'
import { STORY_TEXT_LIMIT, coverage, storiesFor, tagsFor, type Story } from '../../shared/stories'
import type { Job } from '../../shared/types'
import { api } from '../lib/api'
import { useResource } from '../lib/hooks'
import posthog from '../lib/posthog'
import '../features/interviews/interviews.css'
import { ChipInput } from './ChipInput'
import { Field, TextField } from './Field'

type Draft = Pick<Story, 'title' | 'text' | 'tags'>
const EMPTY: Draft = { title: '', text: '', tags: [] }

/** Prepare › Interviews: the seeker's STAR stories, reused across applications. Add, edit, delete. */
export function StoryBank() {
  const res = useResource(() => api.stories(), [])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stories = res.data?.stories ?? []
  const saved = (s: Story) => res.setData((d) => ({ stories: [s, ...(d?.stories ?? []).filter((x) => x.id !== s.id)] }))

  return (
    <section className="profile__group stories" aria-labelledby="stories-heading">
      <h2 className="sr-only" id="stories-heading">Story bank</h2>
      <p className="field__hint">Your best examples, written once in STAR form (situation, task, action, result). Agisse shows the ones that fit each posting on its Prepare tab.</p>
      {(res.error || error) && <p className="field__error" role="alert">{res.error ?? error}</p>}
      {res.data && <Coverage stories={stories} />}
      <ul className="stories__list">
        {stories.map((s) =>
          editing === s.id ? (
            <li key={s.id}><StoryForm initial={s} id={s.id} onDone={(x) => { if (x) saved(x); setEditing(null) }} /></li>
          ) : (
            <li key={s.id} className="stories__item">
              <strong>{s.title}</strong>
              <p className="stories__text">{s.text}</p>
              {s.tags.length > 0 && <p className="label label--muted">{s.tags.join(' · ')}</p>}
              <span className="stories__actions">
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEditing(s.id)}>Edit</button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => {
                  if (!confirm(`Delete the story "${s.title}"?`)) return
                  setError(null)
                  api.deleteStory(s.id).then(() => res.setData((d) => ({ stories: (d?.stories ?? []).filter((x) => x.id !== s.id) })), (e) => setError(e instanceof Error ? e.message : 'Could not delete the story'))
                }}>Delete</button>
              </span>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <StoryForm initial={EMPTY} onDone={(x) => { if (x) saved(x); setEditing(null) }} />
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => setEditing('new')}>Add a story</button>
      )}
    </section>
  )
}

/** The eight graduate competencies: which the bank already has a story for, and which it lacks. */
function Coverage({ stories }: { stories: Story[] }) {
  const cov = coverage(stories)
  const missing = cov.filter((c) => !c.stories.length)
  return (
    <ul className="stories__coverage" aria-label="Competencies your stories cover">
      {cov.map((c) => (
        <li key={c.id} className={c.stories.length ? 'is-covered' : undefined} title={c.stories.map((s) => s.title).join(', ') || 'No story yet'}>
          {c.label}
          <span className="sr-only">{c.stories.length ? ': covered' : ': missing'}</span>
        </li>
      ))}
      {missing.length > 0 && <li className="stories__coverage-note">{missing.length === 8 ? 'Add a story to start covering these.' : `${missing.length} to go.`}</li>}
    </ul>
  )
}

function StoryForm({ initial, id, onDone }: { initial: Draft; id?: string; onDone: (s: Story | null) => void }) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = id ?? 'new'
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const { story } = await api.saveStory(d, id)
      if (!id) posthog.capture('story_saved', { from: 'profile' })
      onDone(story)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the story')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stories__form">
      <Field id={`story-title-${key}`} label="Title" placeholder="e.g. Rescued the society budget" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value.slice(0, 160) })} />
      <TextField id={`story-text-${key}`} label="The story" hint="situation, task, action, result" rows={6} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value.slice(0, STORY_TEXT_LIMIT) })} />
      <ChipInput label="Tags" hint="skills it shows" values={d.tags} onChange={(tags) => setD({ ...d, tags })} placeholder="e.g. leadership, Excel" />
      {error && <p className="field__error" role="alert">{error}</p>}
      <span className="stories__actions">
        <button type="button" className="btn btn--primary btn--sm" disabled={busy || !d.title.trim() || d.text.trim().length < 20} onClick={() => void save()}>{busy ? 'Saving…' : 'Save story'}</button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => onDone(null)}>Cancel</button>
      </span>
    </div>
  )
}

/** Practice feedback: keep the tighter answer as a story, tagged with the posting keywords it mentions. */
export function SaveStory({ title, text, keywords }: { title: string; text: string; keywords: string[] }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  if (state === 'done') return <p className="prep__meta" role="status">Saved to your <Link href="/prepare/interviews#stories">story bank</Link>.</p>
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={state === 'busy'}
      onClick={() => {
        setState('busy')
        api
          .saveStory({ title: title.slice(0, 160), text: text.slice(0, STORY_TEXT_LIMIT), tags: tagsFor(text, keywords) })
          .then(() => {
            posthog.capture('story_saved', { from: 'practice' })
            setState('done')
          })
          .catch(() => setState('error'))
      }}
    >
      {state === 'error' ? 'Could not save. Try again' : 'Save to story bank'}
    </button>
  )
}

/** A posting's Prepare tab: the seeker's stories that speak to this posting's keywords. */
export function StoriesForPosting({ job }: { job: Job }) {
  const res = useResource(() => api.stories(), [])
  const keywords = job.evaluation?.keywords ?? []
  const hits = storiesFor(res.data?.stories ?? [], keywords)
  if (!res.data || !keywords.length) return null
  return (
    <section className="posting__block" aria-labelledby="sel-stories">
      <h3 id="sel-stories" className="label">Your stories for this role</h3>
      {hits.length ? (
        <ul className="sel__tips">
          {hits.map(({ story, hits: h }) => (
            <li key={story.id}>
              <strong>{story.title}</strong> <span className="prep__meta">shows {h.join(', ')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="prep__meta">None of your stories mention this posting's keywords yet. <Link href="/prepare/interviews#stories">Add one to your story bank</Link>.</p>
      )}
    </section>
  )
}
