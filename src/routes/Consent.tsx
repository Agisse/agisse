import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AuthError, AuthShell } from './SignIn'

/** The page Better Auth's `mcp` plugin sends the user to before it hands an AI client (Claude
 *  Desktop/Code, ...) a token for this account. The query string is the plugin's signed authorize
 *  request; `oauthProviderClient` forwards it as `oauth_query` on the consent call by itself. */
export function Consent() {
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id')
  const scope = params.get('scope')
  const signed = params.has('sig')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const respond = async (accept: boolean) => {
    setBusy(true)
    setError(null)
    const { error: err } = await authClient.oauth2.consent({ accept, scope: scope ?? undefined })
    if (err) {
      setError(err.message ?? 'Could not complete this request.')
      setBusy(false)
    }
    // On success the response redirects the browser back to the client's redirect_uri.
  }

  if (!clientId || !signed) {
    return (
      <AuthShell title="This link has expired" lede={<p>This connection link is invalid or has expired. Ask the assistant to reconnect.</p>} />
    )
  }

  return (
    <AuthShell
      title="Connect an AI assistant?"
      lede={
        <p>
          <strong className="font-semibold text-foreground">{clientId}</strong> wants to read and act on your Agisse account — your job feed, applications, company
          shortlist, searches, contacts and outreach drafts. It never sends a message for you.
        </p>
      }
    >
      {error && <AuthError>{error}</AuthError>}
      <div className="flex flex-col gap-2">
        <Button type="button" className="h-11 w-full text-[0.9375rem]" disabled={busy} onClick={() => respond(true)}>
          {busy && <Spinner />} {busy ? 'Connecting…' : 'Allow'}
        </Button>
        <Button type="button" variant="ghost" className="h-11 w-full text-[0.9375rem]" disabled={busy} onClick={() => respond(false)}>
          Deny
        </Button>
      </div>
    </AuthShell>
  )
}
