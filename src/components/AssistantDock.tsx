import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'wouter'
import { Maximize2, X } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { AssistantChat } from '@/components/AssistantChat'
import { useAssistant } from '@/lib/assistant'
import { useDark } from '@/lib/theme'

/** What the assistant can see besides the whole workspace; mirrors parsePage in worker/lib/helper.ts. */
function pageLabel(path: string) {
  if (/^\/jobs\/(?!map)[\w-]+/.test(path)) return 'Looking at this job'
  if (path.startsWith('/s/')) return 'Looking at this people search'
  if (/^\/scout\/(?!map)[\w-]+/.test(path)) return 'Looking at this company search'
  if (path.startsWith('/prepare/cv')) return 'Looking at your CV review'
  if (path === '/profile' || path === '/badge') return 'Looking at your profile'
  if (path.startsWith('/prepare')) return 'Looking at your practice'
  return 'Ask about anything in Agisse'
}

/** The assistant on every page: an orb bottom-right that opens a side panel. Ctrl/⌘ + J toggles it. */
export function AssistantDock() {
  const { me, open, setOpen, status, messages, newThread } = useAssistant()
  const [location] = useLocation()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const spent = me.budget.used >= me.budget.limit
  // The orb draws on a canvas, so it takes the dark-mode blue as a value.
  const blue = useDark() ? '#4d7bff' : '#1f45e0'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen(!open)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // The Chat page is the assistant itself; no dock on top of it.
  useEffect(() => {
    if (location === '/chat') setOpen(false)
  }, [location, setOpen])

  // Focus the composer on open; give focus back to the orb on close.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open) panel.current?.querySelector('textarea')?.focus()
    else if (wasOpen.current) button.current?.focus()
    wasOpen.current = open
  }, [open])

  if (location === '/chat') return null

  return (
    <>
      <button
        ref={button}
        type="button"
        className="assistant-dock__button"
        aria-expanded={open}
        aria-controls="assistant-dock"
        aria-label={open ? 'Close the assistant' : 'Ask the assistant about this page (Ctrl+J)'}
        title="Ask the assistant (Ctrl+J)"
        onClick={() => setOpen(!open)}
      >
        <ThinkingOrb state={status === 'submitted' ? 'working' : 'searching'} paused={spent} size={32} color={blue} aria-hidden="true" />
        {!open && status === 'ready' && messages.at(-1)?.role === 'assistant' && <span className="assistant-dock__dot" aria-hidden="true" />}
      </button>
      {open && (
        <div ref={panel} id="assistant-dock" className="assistant-dock" role="dialog" aria-modal="false" aria-labelledby="assistant-dock-title">
          <header className="assistant-dock__head">
            <div>
              <h2 id="assistant-dock-title" className="label">Assistant</h2>
              <p className="assistant-dock__context">{pageLabel(location)}</p>
            </div>
            <div className="assistant-dock__tools">
              {messages.length > 0 && (
                <button type="button" className="btn btn--quiet btn--sm" onClick={newThread}>
                  New chat
                </button>
              )}
              <Link href="/chat" className="btn btn--quiet btn--sm" aria-label="Open full chat" title="Open full chat">
                <Maximize2 aria-hidden="true" />
              </Link>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(false)} aria-label="Close the assistant">
                <X aria-hidden="true" />
              </button>
            </div>
          </header>
          <AssistantChat compact showActions />
        </div>
      )}
    </>
  )
}
