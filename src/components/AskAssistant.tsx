import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { useAssistant } from '@/lib/assistant'

/** "Ask about this": opens the dock with a question about what is on screen. */
export function AskAssistant({ question, children = 'Ask the assistant' }: { question: string; children?: ReactNode }) {
  const { me, ask, status } = useAssistant()
  if (me.trial || me.budget.used >= me.budget.limit) return null
  return (
    <button type="button" className="btn btn--sm btn--quiet ask-assistant" onClick={() => ask(question)} disabled={status === 'submitted'}>
      <Sparkles aria-hidden="true" /> {children}
    </button>
  )
}
