import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { sessionHint } from '../lib/hooks'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldSeparator } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { BoothSignMark } from '../components/BoothSignMark'
import posthog from '../lib/posthog'

type Mode = 'sign-in' | 'sign-up'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void }
declare global { interface Window { turnstile?: Turnstile } }

/** Cloudflare Turnstile, invisible unless Cloudflare wants a click. Returns the latest token and a reset (tokens are single-use). */
function useTurnstile() {
  const box = useRef<HTMLDivElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const widget = useRef<string | null>(null)
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    const mount = () => {
      if (!box.current || !window.turnstile || widget.current) return
      widget.current = window.turnstile.render(box.current, { sitekey: TURNSTILE_SITE_KEY, appearance: 'interaction-only', callback: setToken, 'expired-callback': () => setToken(null) })
    }
    if (window.turnstile) mount()
    else if (!document.getElementById('cf-turnstile')) {
      const s = Object.assign(document.createElement('script'), { id: 'cf-turnstile', src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true, onload: mount })
      document.head.append(s)
    } else document.getElementById('cf-turnstile')!.addEventListener('load', mount)
    return () => { if (widget.current) window.turnstile?.remove(widget.current); widget.current = null }
  }, [])
  const reset = () => { setToken(null); if (widget.current) window.turnstile?.reset(widget.current) }
  return { box, headers: (token ? { 'x-captcha-response': token } : {}) as Record<string, string>, ready: !TURNSTILE_SITE_KEY || !!token, reset }
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
)

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  // Read per mount: the homepage links here client-side with ?mode=sign-up.
  const [query] = useState(() => new URLSearchParams(window.location.search))
  const [mode, setMode] = useState<Mode>(query.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(() => query.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const captcha = useTurnstile()

  const google = async () => {
    setError(null)
    setBusy(true)
    posthog.capture('google_sign_in_started', { mode })
    // Coming back from Google, draw the app rather than the homepage while /api/me answers.
    sessionHint('in')
    const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/', newUserCallbackURL: '/welcome?new=google', errorCallbackURL: '/sign-in' })
    if (res.error) {
      setBusy(false)
      setError(res.error.message ?? 'Google sign-in did not start. Try again.')
    }
  }

  const forgot = async () => {
    setError(null)
    if (!email.trim()) return setError('Enter your email first, then ask for a reset link.')
    if (!captcha.ready) return setError('One second, checking you are not a bot…')
    setBusy(true)
    const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/reset-password' }, { headers: captcha.headers })
    setBusy(false)
    captcha.reset()
    if (res.error) return setError(res.error.message ?? 'Could not send a reset link.')
    setSent(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) return setError('Email and password are both needed.')
    if (mode === 'sign-up' && !name.trim()) return setError('Enter your name.')
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (!captcha.ready) return setError('One second, checking you are not a bot…')
    setBusy(true)
    const res =
      mode === 'sign-up'
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password }, { headers: captcha.headers })
        : await authClient.signIn.email({ email: email.trim(), password }, { headers: captcha.headers })
    setBusy(false)
    captcha.reset()
    if (res.error) {
      const code = res.error.code
      setError(
        code === 'USER_ALREADY_EXISTS'
          ? 'That email already has an account. Sign in instead.'
          : code === 'INVALID_EMAIL_OR_PASSWORD'
            ? 'Email or password does not match. Signed up with Google? Use the Google button.'
            : res.error.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : (res.error.message ?? 'Could not sign you in.'),
      )
      return
    }
    posthog.capture(mode === 'sign-up' ? 'account_created' : 'signed_in', { method: 'email' })
    // A new account starts in onboarding; a returning one lands where it was going.
    if (mode === 'sign-up') window.history.replaceState(null, '', '/welcome')
    onSignedIn()
  }

  const switchTo = (m: Mode) => { setMode(m); setError(null); setSent(false) }

  return (
    <AuthShell title={mode === 'sign-up' ? 'Create your account' : 'Welcome back'}>
      <Button type="button" variant="outline" className="h-11 w-full gap-2.5 text-[0.9375rem]" onClick={google} disabled={busy}>
        <GoogleMark /> Continue with Google
      </Button>
      <FieldSeparator className="my-0 *:data-[slot=field-separator-content]:bg-card">or</FieldSeparator>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === 'sign-up' && <AuthField id="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
        <AuthField id="email" label="Email" type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
        <AuthField
          id="password"
          label="Password"
          hint={mode === 'sign-up' ? 'At least 8 characters' : undefined}
          action={mode === 'sign-in' && (
            <button type="button" className="-my-3 py-3 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50" onClick={forgot} disabled={busy}>
              Forgot password?
            </button>
          )}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        />
        {error && <AuthError>{error}</AuthError>}
        {sent && <p className="text-sm text-muted-foreground" role="status">If that email has an account, a reset link is on its way.</p>}
        <div ref={captcha.box} className="empty:hidden" />
        <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={busy}>
          {busy && <Spinner />} {busy ? 'One moment…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'sign-up' ? 'Already have an account? ' : 'New to Agisse? '}
        <button type="button" className="-my-3 py-3 font-medium text-primary underline-offset-4 hover:underline" onClick={() => switchTo(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
          {mode === 'sign-up' ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="-mt-2 text-center text-[0.8125rem] text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground">
        By continuing you {mode === 'sign-up' && "confirm you're 18 or over and "}agree to the <a href="/docs/terms">Terms</a> and <a href="/docs/privacy">Privacy Policy</a>.
      </p>
    </AuthShell>
  )
}

/** The page behind the emailed reset link: /reset-password?token=… */
export function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    setState('busy')
    const res = await authClient.resetPassword({ newPassword: password, token })
    if (res.error) {
      setState('idle')
      return setError(res.error.code === 'INVALID_TOKEN' ? 'This link has expired or was already used. Ask for a new one from the sign-in page.' : (res.error.message ?? 'Could not reset the password.'))
    }
    setState('done')
  }
  return (
    <AuthShell title={state === 'done' ? 'Password changed' : 'Choose a new password'}>
      {state === 'done' ? (
        <Button className="h-11 w-full text-[0.9375rem]" render={<a href="/sign-in" />} nativeButton={false}>Sign in</Button>
      ) : !token ? (
        <p className="text-center text-muted-foreground">
          This link is incomplete. Ask for a new one from the <a className="text-primary underline-offset-4 hover:underline" href="/sign-in">sign-in page</a>.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <AuthField id="new-password" label="New password" hint="At least 8 characters" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          {error && <AuthError>{error}</AuthError>}
          <Button type="submit" className="h-11 w-full text-[0.9375rem]" disabled={state === 'busy'}>
            {state === 'busy' && <Spinner />} {state === 'busy' ? 'One moment…' : 'Save password'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

/** The calm centered card every signed-out and auth-adjacent page uses: mark, title, one column. */
export function AuthShell({ title, lede, children }: { title: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:justify-center sm:bg-muted/60 sm:py-16">
      <div className="flex w-full max-w-[400px] flex-col gap-5 sm:rounded-2xl sm:bg-card sm:px-8 sm:py-9 sm:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.05)] sm:ring-1 sm:ring-foreground/8">
        <header className="mb-1 flex flex-col items-center gap-4 text-center">
          <a href="/" className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight text-foreground no-underline">
            <BoothSignMark className="size-7!" /> Agisse
          </a>
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{title}</h1>
          {lede && <div className="-mt-2 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">{lede}</div>}
        </header>
        {children}
      </div>
    </main>
  )
}

function AuthField({ id, label, hint, action, ...input }: { id: string; label: string; hint?: string; action?: ReactNode } & ComponentProps<'input'>) {
  return (
    <Field className="gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={id}>
          {label}
          {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
        </FieldLabel>
        {action}
      </div>
      <Input id={id} className="h-11 rounded-lg px-3 text-base" {...input} />
    </Field>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
