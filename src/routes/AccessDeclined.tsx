import { Button } from '@/components/ui/button'
import { AuthShell } from './SignIn'

// Only a declined account lands here.
export function AccessDeclined({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <AuthShell
      title="We can't let you in right now"
      lede={<p>Your account wasn't approved for the beta. If you think that's a mistake, write to <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@agisse.xyz">hello@agisse.xyz</a> and we'll take another look.</p>}
    >
      <Button type="button" variant="outline" className="h-11 w-full text-[0.9375rem]" onClick={onSignOut}>Sign out</Button>
    </AuthShell>
  )
}
