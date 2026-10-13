import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'wouter'
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { JOB_STATUSES, NEXT_AT_LABEL, type ContactedPerson, type JobStatus, type JobSummary } from '../../shared/types'
import { api } from '../lib/api'
import { boothHref, formatDate } from '../lib/hooks'
import { edgeSpeed, nearestIndex } from '../lib/board-scroll'
import { CompanyLogo } from '../components/CompanyLogo'

// Discarded postings stay in the list view; the board shows only roles still in play or closed by the company.
const COLUMNS = JOB_STATUSES.filter((s) => s !== 'discarded')

const statusName = (s: JobStatus) => s[0]!.toUpperCase() + s.slice(1)
const companyKey = (s: string) => s.trim().toLowerCase()
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const FOLDED = 'agisse.board-folded'
const readFolded = (): JobStatus[] => {
  try {
    return JSON.parse(localStorage.getItem(FOLDED) ?? '[]')
  } catch {
    return []
  }
}

/** The columns alone: drag a card, or pick its status, to move it. Also the board layout of Jobs › Tracking. */
export function BoardColumns({ jobs, people, onJobs }: { jobs: JobSummary[]; people: ContactedPerson[]; onJobs: (update: (jobs: JobSummary[]) => JobSummary[]) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState<JobStatus | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // A column folds to a slim rail from its header (say, Rejected); empty columns are rails on their own.
  const [folded, setFolded] = useState(() => new Set(readFolded()))
  const fold = (s: JobStatus) =>
    setFolded((cur) => {
      const next = new Set(cur)
      if (!next.delete(s)) next.add(s)
      try {
        localStorage.setItem(FOLDED, JSON.stringify([...next]))
      } catch {
        /* blocked storage: the fold lasts this visit */
      }
      return next
    })

  // How far the board can still scroll, for the edge fades, the hover arrows and the phone's page dots.
  const scroller = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)
  const [active, setActive] = useState(0)
  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(end)
    const cols = [...el.children] as HTMLElement[]
    setActive(nearestIndex(cols.map((c) => c.offsetLeft - cols[0]!.offsetLeft), el.scrollLeft, end))
  }, [])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, folded, jobs.length])

  const step = () => (scroller.current?.querySelector<HTMLElement>('.board__column:not(.is-rail)')?.offsetWidth ?? 272) + 12
  const scrollTo = (left: number) => scroller.current?.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' })
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // a card's select keeps its own arrow keys
    const el = e.currentTarget
    const to = e.key === 'ArrowRight' ? el.scrollLeft + step() : e.key === 'ArrowLeft' ? el.scrollLeft - step() : e.key === 'Home' ? 0 : e.key === 'End' ? el.scrollWidth : null
    if (to === null) return
    e.preventDefault()
    scrollTo(to)
  }

  // Press and drag on the board's background pans it, like moving a sheet of paper. Mouse only: touch and trackpads scroll natively.
  const pan = useRef<{ x: number; left: number } | null>(null)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (e.pointerType !== 'mouse' || e.button !== 0 || t.closest('.board__card, button, a, select')) return
    // A press on a scrollbar drags that scrollbar, not the board.
    if (e.nativeEvent.offsetX > t.clientWidth || e.nativeEvent.offsetY > t.clientHeight) return
    pan.current = { x: e.clientX, left: e.currentTarget.scrollLeft }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('is-panning')
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pan.current) e.currentTarget.scrollLeft = pan.current.left - (e.clientX - pan.current.x)
  }
  const endPan = (e: PointerEvent<HTMLDivElement>) => {
    pan.current = null
    e.currentTarget.classList.remove('is-panning')
  }

  // While a card is dragged near the board's left or right edge, the board scrolls that way.
  const dragX = useRef<number | null>(null)
  useEffect(() => {
    if (!dragging) return
    let frame = 0
    const tick = () => {
      const el = scroller.current
      if (el && dragX.current !== null) {
        const r = el.getBoundingClientRect()
        el.scrollLeft += edgeSpeed(dragX.current, r.left, r.right)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      dragX.current = null
    }
  }, [dragging])

  const byCompany = new Map<string, ContactedPerson[]>()
  for (const p of people) byCompany.set(companyKey(p.company), [...(byCompany.get(companyKey(p.company)) ?? []), p])

  const move = async (id: string, status: JobStatus) => {
    const job = jobs.find((j) => j.id === id)
    if (!job || job.status === status) return
    const patch = (fields: Partial<JobSummary>) => onJobs((js) => js.map((j) => (j.id === id ? { ...j, ...fields } : j)))
    patch({ status })
    setError(null)
    try {
      const { job: saved } = await api.updateJob(id, { status })
      patch({ status: saved.status, appliedAt: saved.appliedAt, nextAt: saved.nextAt })
    } catch (err) {
      patch({ status: job.status })
      setError(err instanceof Error ? err.message : 'Could not move the posting')
    }
  }

  if (!jobs.length)
    return (
      <div className="empty-hall">
        <p className="empty-hall__text">
          No postings yet. <Link href="/jobs?view=add">Add one</Link> and it lands here.
        </p>
      </div>
    )

  const discarded = jobs.filter((j) => j.status === 'discarded').length
  return (
    <>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      <div className={`board${atStart ? '' : ' has-before'}${atEnd ? '' : ' has-after'}`}>
        <div
          ref={scroller}
          className={`board__columns${dragging ? ' is-dragging' : ''}`}
          tabIndex={0}
          role="group"
          aria-label="Board. Arrow keys scroll between columns."
          onScroll={measure}
          onKeyDown={onKey}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDragOver={(e) => (dragX.current = e.clientX)}
        >
          {COLUMNS.map((status) => {
            const cards = jobs.filter((j) => j.status === status)
            const rail = !cards.length || folded.has(status)
            const drop = {
              onDragOver: (e: DragEvent) => {
                e.preventDefault()
                setOver(status)
              },
              onDragLeave: () => setOver((o) => (o === status ? null : o)),
              onDrop: (e: DragEvent) => {
                e.preventDefault()
                setOver(null)
                void move(e.dataTransfer.getData('text/plain'), status)
              },
            }
            const head = (
              <>
                <span className={`board__dot board__dot--${status}`} aria-hidden="true" />
                <span className="board__name">{statusName(status)}</span>
                <span className="board__count tnum">{cards.length}</span>
              </>
            )
            return (
              <section key={status} className={`board__column${rail ? ' is-rail' : ''}${over === status ? ' is-over' : ''}`} aria-label={`${statusName(status)}, ${cards.length}`} {...drop}>
                <h2 className="board__column-head">
                  {cards.length ? (
                    <button type="button" aria-expanded={!rail} title={rail ? `Show ${statusName(status)}` : `Fold ${statusName(status)} away`} onClick={() => fold(status)}>
                      {head}
                    </button>
                  ) : (
                    head
                  )}
                </h2>
                {!rail &&
                  cards.map((j) => (
                    <Card
                      key={j.id}
                      job={j}
                      contacts={byCompany.get(companyKey(j.company)) ?? []}
                      onMove={(s) => void move(j.id, s)}
                      dragging={dragging === j.id}
                      onDrag={(on) => setDragging(on ? j.id : null)}
                    />
                  ))}
              </section>
            )
          })}
        </div>
        {/* Pointer shortcuts that show on hover; keyboards use the arrow keys on the board itself. */}
        <button type="button" className="board__nudge board__nudge--before" tabIndex={-1} aria-hidden="true" onClick={() => scrollTo((scroller.current?.scrollLeft ?? 0) - 2 * step())}>
          <ChevronLeft />
        </button>
        <button type="button" className="board__nudge board__nudge--after" tabIndex={-1} aria-hidden="true" onClick={() => scrollTo((scroller.current?.scrollLeft ?? 0) + 2 * step())}>
          <ChevronRight />
        </button>
      </div>
      {/* Phones: one column per screen, and a dot per column to jump between them. */}
      <div className="board__pager" role="group" aria-label="Columns">
        {COLUMNS.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-label={`${statusName(s)}, ${jobs.filter((j) => j.status === s).length}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => (scroller.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })}
          />
        ))}
      </div>
      {discarded > 0 && (
        <p className="board__note muted">
          {discarded} discarded {discarded === 1 ? 'posting is' : 'postings are'} hidden here. <Link href="/jobs?view=track&layout=list&status=closed">Show in the list</Link>
        </p>
      )}
    </>
  )
}

function Card({ job, contacts, onMove, dragging, onDrag }: { job: JobSummary; contacts: ContactedPerson[]; onMove: (s: JobStatus) => void; dragging: boolean; onDrag: (on: boolean) => void }) {
  return (
    <article
      className={`board__card${dragging ? ' is-dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', job.id)
        e.dataTransfer.effectAllowed = 'move'
        onDrag(true)
      }}
      onDragEnd={() => onDrag(false)}
    >
      <Link href={`/jobs/${job.id}`} className="board__card-title">
        <CompanyLogo company={job.company} domain={job.domain} size={32} />
        <span className="board__card-text">
          <span className="board__company">{job.company}</span>
          <span className="board__role">{job.role}</span>
        </span>
      </Link>
      {(job.location || (job.nextAt && NEXT_AT_LABEL[job.status])) && (
        <p className="board__meta">
          {job.nextAt && NEXT_AT_LABEL[job.status] ? (
            <span className="board__date tnum">
              <CalendarClock aria-hidden="true" /> {NEXT_AT_LABEL[job.status]} {formatDate(job.nextAt)}
            </span>
          ) : (
            <span>{job.location}</span>
          )}
        </p>
      )}
      <div className="board__card-foot">
        {contacts.length > 0 ? (
          <span className="board__people" title={contacts.map((p) => p.name + (p.status ? ` (${p.status})` : '')).join(', ')}>
            <Users aria-hidden="true" /> {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
          </span>
        ) : (
          <Link href={boothHref({ name: job.company, domain: job.domain })} className="board__people board__people--find">
            <Users aria-hidden="true" /> Find people
          </Link>
        )}
        <select className="board__move" aria-label={`Move ${job.company}, ${job.role}`} value={job.status} onChange={(e) => onMove(e.target.value as JobStatus)}>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusName(s)}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}
