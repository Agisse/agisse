import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { api, isAbort, type Me } from './api'
import { notifyChanged } from './hooks'
import type { HelperAction, HelperMessage, HelperProposal, HelperReply, HelperRole } from '../../shared/helper'

export type ProposalState = HelperProposal & { done?: 'applied' | 'dismissed' }

export type ChatMessage = {
  id: string
  role: HelperRole
  content: string
  actions?: HelperAction[]
  proposals?: ProposalState[]
  suggestions?: string[]
}

type Status = 'ready' | 'submitted' | 'error'

export type ChatThread = { id: string; title: string; updatedAt: number; messages: ChatMessage[] }

type Assistant = {
  me: Me
  /** The open chat's messages. */
  messages: ChatMessage[]
  /** Every chat, newest first. */
  threads: ChatThread[]
  threadId: string
  newThread: () => void
  switchThread: (id: string) => void
  deleteThread: (id: string) => void
  status: Status
  error: string
  open: boolean
  setOpen: (open: boolean) => void
  /** Opens the dock and asks; the open page goes along as context. */
  ask: (text: string) => void
  /** Replace the thread, e.g. with a fresh briefing. */
  reset: (messages: ChatMessage[]) => void
  apply: (messageId: string, index: number) => Promise<void>
  dismiss: (messageId: string, index: number) => void
}

const Ctx = createContext<Assistant | null>(null)

export function useAssistant() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAssistant outside AssistantProvider')
  return ctx
}

// Chats live in this browser, per account: they follow the seeker across pages and reloads. Never stored on the server.
const MAX_THREADS = 50
const storageKey = (userId: string) => `agisse.chats.${userId}`

function stored(userId: string): ChatThread[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as ChatThread[]) : null
  } catch {
    return null
  }
}

const blank = (messages: ChatMessage[] = []): ChatThread => ({ id: crypto.randomUUID(), title: '', updatedAt: Date.now(), messages })
const titleFrom = (text: string) => (text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text)

export const replyMessage = (reply: HelperReply): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'assistant',
  content: reply.answer,
  actions: reply.actions,
  proposals: reply.proposals ?? [],
  suggestions: reply.suggestions,
})

export function AssistantProvider({ me, refreshMe, children }: { me: Me; refreshMe: () => Promise<void>; children: ReactNode }) {
  const [location] = useLocation()
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const saved = stored(me.user.id)
    return saved?.length ? saved : [blank(me.briefing ? [replyMessage(me.briefing)] : [])]
  })
  const [threadId, setThreadId] = useState(() => threads[0].id)
  const messages = threads.find((t) => t.id === threadId)?.messages ?? []
  const [status, setStatus] = useState<Status>('ready')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const active = useRef<AbortController | null>(null)
  const latest = useRef(messages)
  latest.current = messages
  const current = useRef(threadId)
  current.current = threadId

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(me.user.id), JSON.stringify(threads))
    } catch {
      /* private mode or full: chats just won't survive a reload */
    }
  }, [threads, me.user.id])

  /** Change one chat's messages; it moves to the top of the list. */
  const setMessagesOf = useCallback((id: string, update: (messages: ChatMessage[]) => ChatMessage[]) => {
    setThreads((all) => {
      const t = all.find((x) => x.id === id)
      if (!t) return all
      const messages = update(t.messages)
      const title = t.title || titleFrom(messages.find((m) => m.role === 'user')?.content ?? '')
      return [{ ...t, messages, title, updatedAt: Date.now() }, ...all.filter((x) => x.id !== id)]
    })
  }, [])
  const setMessages = useCallback((update: (messages: ChatMessage[]) => ChatMessage[]) => setMessagesOf(current.current, update), [setMessagesOf])

  const stop = () => {
    active.current?.abort()
    active.current = null
    setStatus('ready')
    setError('')
  }

  const newThread = () => {
    stop()
    // An untouched chat is reused rather than piling up empties.
    const empty = threads.find((t) => !t.messages.some((m) => m.role === 'user'))
    if (empty) return setThreadId(empty.id)
    const t = blank()
    setThreads((all) => [t, ...all].slice(0, MAX_THREADS))
    setThreadId(t.id)
  }

  const switchThread = (id: string) => {
    if (id === threadId) return
    stop()
    setThreadId(id)
  }

  const deleteThread = (id: string) => {
    const rest = threads.filter((t) => t.id !== id)
    if (id === threadId) {
      stop()
      const next = rest[0] ?? blank()
      if (!rest.length) rest.push(next)
      setThreadId(next.id)
    }
    setThreads(rest)
  }

  const ask = useCallback(
    (text: string) => {
      const question = text.trim()
      if (!question || active.current) return
      setOpen(true)
      const id = current.current
      const next = [...latest.current, { id: crypto.randomUUID(), role: 'user' as const, content: question }]
      setMessagesOf(id, () => next)
      setError('')
      setStatus('submitted')
      const controller = new AbortController()
      active.current = controller
      const history: HelperMessage[] = next.slice(-11).map(({ role, content }) => ({ role, content }))
      api
        .askHelper(history, location, controller.signal)
        .then(({ reply }) => {
          setMessagesOf(id, (current) => [...current, replyMessage(reply)])
          setStatus('ready')
        })
        .catch((e) => {
          if (isAbort(e)) return
          setError(e instanceof Error ? e.message : 'The assistant could not answer. Try again in a minute.')
          setStatus('error')
        })
        .finally(() => {
          active.current = null
          void refreshMe() // budget
        })
    },
    [location, refreshMe, setMessagesOf],
  )

  const reset = useCallback(
    (next: ChatMessage[]) => {
      active.current?.abort()
      active.current = null
      setMessages(() => next)
      setStatus('ready')
      setError('')
    },
    [setMessages],
  )

  const mark = (messageId: string, index: number, done: 'applied' | 'dismissed') =>
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, proposals: m.proposals?.map((p, i) => (i === index ? { ...p, done } : p)) } : m)))

  const apply = async (messageId: string, index: number) => {
    const p = latest.current.find((m) => m.id === messageId)?.proposals?.[index]
    if (!p || p.done) return
    setError('')
    try {
      if (p.type === 'remember') {
        await api.addMemory({ kind: p.kind, text: p.text, source: 'assistant', ref: location })
        await refreshMe()
      } else if (p.type === 'job_update') {
        await api.updateJob(p.jobId, { ...(p.status && { status: p.status }), ...(p.nextAt && { nextAt: p.nextAt }), ...(p.notes && { notes: p.notes }) })
      } else {
        await api.updatePerson(p.personId, { ...(p.status && { status: p.status }), ...(p.notes && { notes: p.notes }) })
      }
      mark(messageId, index, 'applied')
      notifyChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.')
    }
  }

  const value: Assistant = { me, messages, threads, threadId, newThread, switchThread, deleteThread, status, error, open, setOpen, ask, reset, apply, dismiss: (id, i) => mark(id, i, 'dismissed') }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
