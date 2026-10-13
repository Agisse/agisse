import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AuthShell } from './SignIn'

export function AccessWaiting({ status, onRefresh, onSignOut }: { status: 'pending' | 'rejected'; onRefresh: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)
  // Still mounted after a check means still waiting; say so instead of nothing happening.
  const refresh = async () => { setBusy(true); await onRefresh(); setBusy(false); setChecked(true) }
  return (
    <AuthShell
      title={status === 'pending' ? "You're on the list" : "We can't let you in right now"}
      lede={status === 'pending'
        ? <p>Thanks for joining. We're letting people in a few at a time and will email you the moment your spot opens.</p>
        : <p>Your account wasn't approved for the beta. If you think that's a mistake, write to <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@agisse.xyz">hello@agisse.xyz</a> and we'll take another look.</p>}
    >
      <div className="flex flex-col gap-2">
        {status === 'pending' && checked && !busy && (
          <p className="text-center text-sm text-muted-foreground" role="status">Not yet. We'll email you when your spot opens.</p>
        )}
        {status === 'pending' && (
          <Button type="button" className="h-11 w-full text-[0.9375rem]" disabled={busy} onClick={refresh}>
            {busy && <Spinner />} {busy ? 'Checking…' : 'Check again'}
          </Button>
        )}
        <Button type="button" variant={status === 'pending' ? 'ghost' : 'outline'} className="h-11 w-full text-[0.9375rem]" onClick={onSignOut}>Sign out</Button>
      </div>
    </AuthShell>
  )
}
