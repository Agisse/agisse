import { Link } from 'wouter'
import type { Me } from '../lib/api'

/** One quiet line under an AI result made on the server's key. Starter credit runs on a paid model, so it says nothing then. */
export function FreeModelNote({ me, className = 'verdict__note' }: { me: Me; className?: string }) {
  if (me.aiKey || me.trial || (me.credit && me.credit.left > 0)) return null
  return (
    <p className={className}>
      Runs on free models. <Link href="/profile#ai-heading">Your own OpenRouter key gives sharper results</Link>.
    </p>
  )
}
