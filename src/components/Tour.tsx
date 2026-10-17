import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import posthog from '../lib/posthog'

/** One stop: the `data-tour` element it spotlights (none = centred), what it is, and what it does for the seeker. */
type Stop = { target?: string; title: string; body: string }

const STOPS: Stop[] = [
  { title: 'A quick look around', body: 'A few stops, under a minute. Skip any time; it stays in your account menu.' },
  { target: 'today', title: 'Today', body: 'Your next step, then everything due soon: deadlines, follow-ups, tests and interviews.' },
  { target: 'jobs', title: 'Jobs', body: 'Roles ranked for you, the ones you track from saved to offer, and companies worth targeting.' },
  { target: 'education', title: 'Education', body: "Master's, MBA and PhD programmes, ranked for you, deadlines first." },
  { target: 'prepare', title: 'Prepare', body: 'Practise online tests, rehearse interviews out loud and score your CV line by line.' },
  { target: 'people', title: 'People', body: 'Find the people at a company worth asking for a referral, with a first message drafted for you to send.' },
  { target: 'assistant', title: 'Assistant', body: 'Ask about whatever page you are on. Ctrl+J opens it anywhere.' },
  { target: 'account', title: 'Your account', body: 'Profile, the browser extension, and your own AI: it can put interviews in your calendar and move jobs along from your inbox.' },
]

const seenKey = (userId: string) => `agisse.tour.${userId}`
/** Starts the tour from anywhere (the account menu, Today). */
export const startTour = () => dispatchEvent(new Event('agisse:tour'))

// The visible copy of a target: the sidebar on desktop, the tab bar on phones.
function find(target: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) return r
  }
  return null
}

const PAD = 6
const GAP = 12
const CARD = 320

/** Where the card goes: beside a sidebar item, above the tab bar, else below or above the target, kept on screen. */
function place(r: DOMRect | null, h: number) {
  const vw = innerWidth
  const vh = innerHeight
  const w = Math.min(CARD, vw - 32)
  if (!r) return { left: (vw - w) / 2, top: Math.max(16, (vh - h) / 2), width: w }
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - w - 16)
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - h - 16)
  if (r.right + GAP + w + 16 <= vw && r.left < vw / 3) return { left: r.right + PAD + GAP, top: clampY(r.top + r.height / 2 - h / 2), width: w }
  if (r.top - GAP - h - PAD >= 16) return { left: clampX(r.left + r.width / 2 - w / 2), top: r.top - PAD - GAP - h, width: w }
  return { left: clampX(r.left + r.width / 2 - w / 2), top: clampY(r.bottom + PAD + GAP), width: w }
}

/**
 * The first-run tour: a spotlight on each section in turn and one short line on what it is for.
 * Opens once per account in this browser, never during onboarding; Esc or Skip ends it, arrows step through.
 */
export function Tour({ userId }: { userId: string }) {
  const [location] = useLocation()
  const [step, setStep] = useState<number | null>(null)
  // The stops whose section is on the page, fixed when the tour opens.
  const [stops, setStops] = useState(STOPS)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [height, setHeight] = useState(180)
  const card = useRef<HTMLDivElement>(null)
  const stop = step === null ? null : stops[step]!

  useEffect(() => {
    const open = () => {
      setStops(STOPS.filter((s) => !s.target || find(s.target)))
      setStep(0)
    }
    addEventListener('agisse:tour', open)
    let seen = true
    try {
      seen = !!localStorage.getItem(seenKey(userId))
    } catch {
      /* storage blocked: never auto-open, the menu still has it */
    }
    // A moment after the page draws, so the sections it points at are there.
    const t = !seen && location !== '/welcome' ? setTimeout(open, 600) : undefined
    return () => {
      removeEventListener('agisse:tour', open)
      clearTimeout(t)
    }
    // Only on mount: a later page change must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const end = useCallback(
    (finished: boolean) => {
      posthog.capture(finished ? 'tour_finished' : 'tour_skipped', { step })
      try {
        localStorage.setItem(seenKey(userId), '1')
      } catch {
        /* private window: it may open again next visit */
      }
      setStep(null)
    },
    [step, userId],
  )

  // Follow the target through resizes and scrolls.
  useLayoutEffect(() => {
    if (!stop) return
    const measure = () => setRect(stop.target ? find(stop.target) : null)
    measure()
    addEventListener('resize', measure)
    addEventListener('scroll', measure, true)
    return () => {
      removeEventListener('resize', measure)
      removeEventListener('scroll', measure, true)
    }
  }, [stop])

  useLayoutEffect(() => {
    if (card.current) setHeight(card.current.offsetHeight)
    card.current?.focus()
  }, [step])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end(false)
      else if (e.key === 'ArrowRight') setStep((s) => (s === null ? s : Math.min(s + 1, stops.length - 1)))
      else if (e.key === 'ArrowLeft') setStep((s) => (s === null ? s : Math.max(s - 1, 0)))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [step, end, stops.length])

  if (!stop || step === null) return null
  const last = step === stops.length - 1
  const pos = place(rect, height)
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* The dim with a hole over the target; the page underneath is not clickable while the tour is up. */}
      <div
        aria-hidden="true"
        className="fixed rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={
          rect
            ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }
            : { left: '50%', top: '50%', width: 0, height: 0, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }
        }
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="fixed flex flex-col gap-3 rounded-2xl bg-popover p-5 text-popover-foreground shadow-[0_8px_32px_rgb(0_0_0/0.18)] ring-1 ring-foreground/10 outline-none transition-[left,top] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={pos}
      >
        <div className="flex flex-col gap-1">
          <h2 id="tour-title" className="m-0 text-[17px] font-semibold tracking-tight">
            {stop.title}
          </h2>
          <p id="tour-body" className="m-0 text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {stop.body}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-auto text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
            {step > 0 && `${step} of ${stops.length - 1}`}
          </span>
          {!last && (
            <Button variant="ghost" size="sm" className="text-muted-foreground max-md:h-11" onClick={() => end(false)}>
              Skip tour
            </Button>
          )}
          {step > 1 && (
            <Button variant="outline" size="sm" className="max-md:h-11" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" className="min-w-16 max-md:h-11" onClick={() => (last ? end(true) : setStep(step + 1))}>
            {step === 0 ? 'Start' : last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
