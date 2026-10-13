import { Check, Copy } from 'lucide-react'
import { api } from '../lib/api'
import { useCopy, useResource } from '../lib/hooks'
import posthog from '../lib/posthog'
import { Button } from '@/components/ui/button'

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
    </div>
  )
}
