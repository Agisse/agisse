import { useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { Link } from 'wouter'
import { ArrowDown, ArrowRight, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadListItemPrimitive, ThreadListPrimitive, ThreadPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from '@assistant-ui/react'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { useAssistant, type ChatMessage, type ProposalState } from '@/lib/assistant'
import { formatDate } from '@/lib/hooks'
import { useDark } from '@/lib/theme'

const KIND_LABEL = { goal: 'Goal', preference: 'Preference', constraint: 'Dealbreaker', about: 'About you', style: 'Writing style' } as const

function proposalText(p: ProposalState) {
  if (p.type === 'remember') return `Remember: ${p.text}`
  const parts = [p.status && `mark as ${p.status}`, p.type === 'job_update' && p.nextAt && `next step ${formatDate(p.nextAt)}`, p.note && `note “${p.note}”`].filter(Boolean)
  return `${p.label}: ${parts.join(', ')}`
}

const convertMessage = (m: ChatMessage): ThreadMessageLike => ({ id: m.id, role: m.role, content: [{ type: 'text', text: m.content }] })

/** Links and one-click changes under an assistant reply; they live on our message, not in assistant-ui's. */
function Extras({ message, showActions }: { message: ChatMessage; showActions: boolean }) {
  const { apply, dismiss } = useAssistant()
  const [applying, setApplying] = useState<number | null>(null)
  return (
    <>
      {showActions && !!message.actions?.length && (
        <ul className="helper-inline-actions">
          {message.actions.map((a) => (
            <li key={a.href + a.label}>
              <Link href={a.href} className="helper-action__link">
                {a.label} <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!!message.proposals?.length && (
        <ul className="helper-proposals" aria-label="Suggested changes">
          {message.proposals.map((p, i) => (
            <li key={i} className="helper-proposal" data-done={p.done}>
              {p.type === 'remember' && <span className="label">{KIND_LABEL[p.kind]}</span>}
              <p>{proposalText(p)}</p>
              {p.done === 'applied' ? (
                <span className="helper-proposal__done"><Check aria-hidden="true" /> {p.type === 'remember' ? 'Saved to your Profile' : 'Saved'}</span>
              ) : p.done === 'dismissed' ? (
                <span className="helper-proposal__done">Dismissed</span>
              ) : (
                <div className="helper-proposal__buttons">
                  <button
                    type="button"
                    className="btn btn--ink btn--sm"
                    disabled={applying === i}
                    onClick={() => {
                      setApplying(i)
                      void apply(message.id, i).finally(() => setApplying(null))
                    }}
                  >
                    {p.type === 'remember' ? 'Remember' : 'Apply'}
                  </button>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => dismiss(message.id, i)}>
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Every chat, newest first: switch, start a new one, delete. Must sit inside AssistantChat's `aside`. */
export function ChatList() {
  return (
    <ThreadListPrimitive.Root className="chat-list" aria-label="Your chats">
      <ThreadListPrimitive.New className="btn btn--sm chat-list__new">
        <Plus aria-hidden="true" /> New chat
      </ThreadListPrimitive.New>
      <div className="chat-list__items">
        <ThreadListPrimitive.Items>
          {() => (
            <ThreadListItemPrimitive.Root className="chat-list__item">
              <ThreadListItemPrimitive.Trigger className="chat-list__trigger">
                <ThreadListItemPrimitive.Title fallback="Untitled chat" />
              </ThreadListItemPrimitive.Trigger>
              <ThreadListItemPrimitive.Delete className="chat-list__delete" aria-label="Delete this chat">
                <Trash2 aria-hidden="true" />
              </ThreadListItemPrimitive.Delete>
            </ThreadListItemPrimitive.Root>
          )}
        </ThreadListPrimitive.Items>
      </div>
    </ThreadListPrimitive.Root>
  )
}

/** The thread, its one-click proposals and the composer; shared by Today, the dock and Chat. Rendered with assistant-ui over our own store. */
export function AssistantChat({ placeholder, showActions = false, compact = false, aside }: { placeholder?: string; showActions?: boolean; compact?: boolean; aside?: ReactNode }) {
  const { me, messages, threads, threadId, newThread, switchThread, deleteThread, status, error, ask } = useAssistant()
  const spent = me.budget.used >= me.budget.limit
  const running = status === 'submitted'
  const still = useReducedMotion()
  const blue = useDark() ? '#4d7bff' : '#1f45e0'

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning: running,
    isDisabled: spent,
    onNew: async (m) => {
      const text = m.content.map((p) => (p.type === 'text' ? p.text : '')).join('')
      ask(text)
    },
    adapters: {
      threadList: {
        threadId,
        threads: threads.map((t) => ({ status: 'regular' as const, id: t.id, title: t.title || undefined })),
        onSwitchToNewThread: newThread,
        onSwitchToThread: switchThread,
        onDelete: deleteThread,
      },
    },
  })

  const latest = messages.findLast((m) => m.role === 'assistant')
  const suggestions = latest?.suggestions?.length ? latest.suggestions : ['What should I do next here?', 'Which application should I prioritize?', 'Who should I follow up with?']
  const byId = new Map(messages.map((m) => [m.id, m]))

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {aside}
      <ThreadPrimitive.Root className={compact ? 'helper-chat helper-chat--compact' : 'helper-chat'} aria-label="Conversation with your job-search assistant">
        <ThreadPrimitive.Viewport className="helper-chat__messages">
          {messages.length === 0 && !running && (
            <p className="helper-actions__empty">Ask about this page, your applications, outreach, or what to do next. The assistant sees your profile and what is open.</p>
          )}
          <ThreadPrimitive.Messages>
            {({ message }) => {
              const own = byId.get(message.id)
              // While a reply is on its way assistant-ui adds an empty assistant message; show what it is doing instead.
              if (!own)
                return (
                  <div className="helper-message helper-message--thinking" role="status">
                    <ThinkingOrb state="searching" size={20} color={blue} aria-hidden="true" />
                    {still ? <span>Reading this page and your workspace…</span> : <Shimmer as="span">Reading this page and your workspace…</Shimmer>}
                  </div>
                )
              return (
                <MessagePrimitive.Root className={`helper-message helper-message--${message.role}`}>
                  <div className="helper-message__copy">
                    <MessagePrimitive.Parts />
                  </div>
                  {message.role === 'assistant' && <Extras message={own} showActions={showActions} />}
                </MessagePrimitive.Root>
              )
            }}
          </ThreadPrimitive.Messages>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <ThreadPrimitive.ViewportFooter className="helper-chat__composer">
            <ThreadPrimitive.ScrollToBottom className="helper-chat__jump" aria-label="Jump to the latest message">
              <ArrowDown aria-hidden="true" />
            </ThreadPrimitive.ScrollToBottom>
            {!running && !spent && (
              <div className="helper-suggestions">
                {suggestions.slice(0, 3).map((s) => (
                  <ThreadPrimitive.Suggestion key={s} prompt={s} send className="helper-suggestion">
                    {s}
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            )}
            {spent && <p className="notice" role="status">This month’s AI budget is used up. The assistant is back when it resets.</p>}
            <ComposerPrimitive.Root className="helper-prompt">
              <ComposerPrimitive.Input
                className="helper-prompt__input"
                rows={2}
                placeholder={placeholder ?? 'Ask about this page, an application, or what to do next…'}
                aria-label="Ask your job-search assistant"
                autoFocus={compact}
              />
              <div className="helper-prompt__foot">
                <span className="helper-prompt__hint">Nothing changes without your click</span>
                <ComposerPrimitive.Send className="helper-prompt__send" aria-label="Send">
                  <ArrowUp aria-hidden="true" />
                </ComposerPrimitive.Send>
              </div>
            </ComposerPrimitive.Root>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}

