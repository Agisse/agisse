import { useState, type FormEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { api, ApiError, inviteCode } from '../lib/api'
import { useCopy, useResource } from '../lib/hooks'
import posthog from '../lib/posthog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Waitlist place + share link while waiting; invites left once in. One line, one action. */
export function InviteCard() {
  const r = useResource(() => api.referral(), [])
  const { copied, copy } = useCopy()
  if (!r.data) return null
  const { code, referrals, invitesLeft, waitlist } = r.data
  const link = `${window.location.origin}/?ref=${code}`
  const share = async () => {
    posthog.capture('invite_link_shared', { waitlisted: !!waitlist, referrals })
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'Agisse', text: 'I got you into the Agisse beta. Job search with AI on your side.', url: link }).catch(() => {})
      return
    }
    await copy(link)
  }
  const text = waitlist
    ? `You're #${waitlist.position} of ${waitlist.total} on the waitlist. Every friend who joins with your link moves you up.`
    : invitesLeft === 0
      ? `${referrals} ${referrals === 1 ? 'friend' : 'friends'} joined with your link. Your invites are used; friends who join now land on the waitlist.`
      : `You have ${invitesLeft ?? 'unlimited'} ${invitesLeft === 1 ? 'invite' : 'invites'}. Friends who join with your link skip the waitlist.`
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <p className="m-0 min-w-0 flex-1 basis-64 text-pretty">{text}</p>
      <Button variant="ghost" size="sm" className="text-foreground max-md:h-11" onClick={share}>
        {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
        {copied ? 'Link copied' : 'Share your link'}
      </Button>
      {waitlist && <RedeemInvite />}
    </div>
  )
}

// Set by App.tsx from ?invite=, so opening an invite link while signed in fills the code in.
const invited = () => document.cookie.match(/(?:^|;\s*)agisse_invite=([\w-]+)/)?.[1] ?? ''

/** An invite that arrives after sign-up opens the account in place. */
function RedeemInvite() {
  const [code, setCode] = useState(invited)
  const [open, setOpen] = useState(!!code)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!open) {
    return (
      <Button variant="link" size="sm" className="h-auto basis-full justify-start p-0 text-muted-foreground max-md:min-h-11" onClick={() => setOpen(true)}>
        Have an invite code?
      </Button>
    )
  }
  const redeem = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.redeemInvite(inviteCode(code))
      posthog.capture('invite_redeemed')
      window.location.reload()
    } catch (err) {
      setBusy(false)
      setError(err instanceof ApiError ? err.message : 'Could not check the code. Try again.')
    }
  }
  return (
    <form className="flex basis-full flex-wrap items-center gap-2" onSubmit={redeem}>
      <label className="sr-only" htmlFor="redeem-invite">Invite code or link</label>
      <Input id="redeem-invite" className="min-w-0 max-w-xs flex-1 basis-48 bg-background max-md:h-11" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code or link" autoComplete="off" spellCheck={false} autoFocus={!code} aria-invalid={!!error} aria-describedby={error ? 'redeem-invite-error' : undefined} />
      <Button type="submit" size="sm" className="max-md:h-11" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Use code'}</Button>
      {error && <p id="redeem-invite-error" className="m-0 basis-full text-destructive" role="alert">{error}</p>}
    </form>
  )
}
