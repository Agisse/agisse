import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { authClient } from './lib/auth-client'
import { api, ApiError, type Me } from './lib/api'
import { ResetPassword, SignIn } from './routes/SignIn'
import { Landing } from './routes/Landing'
import { AccessWaiting } from './routes/AccessWaiting'
import posthog from './lib/posthog'
import { sessionHint } from './lib/hooks'
import { Skeleton } from '@/components/ui/skeleton'

// The signed-in app and its shell are their own chunks, so the homepage, sign-in and waitlist don't download them.
// A signed-in hint starts both downloads at once, next to /api/me instead of after it. The shell is small, so it
// usually arrives first and frames the page while the rest loads.
const loadSignedIn = () => import('./SignedInApp')
const loadShell = () => import('./components/Shell').then((m) => ({ default: m.Shell }))
if (sessionHint() === 'in' || sessionHint() === 'trial') {
  void loadShell()
  void loadSignedIn()
}
const SignedInApp = lazy(loadSignedIn)
const Shell = lazy(loadShell)


// ?ref= and ?invite= ride a 30-day cookie, so they survive the hop to /sign-in and the round trip through Google.
for (const key of ['ref', 'invite']) {
  const v = new URLSearchParams(window.location.search).get(key)?.trim()
  if (v && /^[\w-]{4,40}$/.test(v)) document.cookie = `agisse_${key}=${v}; Max-Age=2592000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

type Auth = { state: 'loading' } | { state: 'out' } | { state: 'waiting'; status: 'pending' | 'rejected' } | { state: 'in'; me: Me }

/** Today's header and first card, shaped like the real ones, while /api/me answers. */
function PageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pt-6 pb-8 md:px-10 md:pt-10 md:pb-16" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="flex flex-col gap-1 px-1">
        <Skeleton className="my-1 h-7 w-56 md:h-8" />
        <Skeleton className="my-1 h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </main>
  )
}

export default function App() {
  const [auth, setAuth] = useState<Auth>({ state: 'loading' })
  const [location, navigate] = useLocation()
  const identifiedUserId = useRef<string | null>(null)

  const identifyUser = useCallback((user: Pick<Me['user'], 'id' | 'name' | 'email'>) => {
    if (identifiedUserId.current === user.id) return

    const persistedUserId = posthog.get_property('$user_id')
    if (typeof persistedUserId === 'string' && persistedUserId !== user.id) posthog.reset()

    posthog.identify(user.id, { email: user.email, name: user.name })
    identifiedUserId.current = user.id
  }, [])

  const load = useCallback(async () => {
    // /api/me alone decides signed in, waitlisted or out; a getSession call first only added a round trip.
    try {
      const me = await api.me()
      identifyUser(me.user)
      sessionHint(me.trial ? 'trial' : 'in')
      setAuth({ state: 'in', me })
    } catch (e) {
      const status = e instanceof ApiError && e.status === 403 ? (e.body as { status?: string } | null)?.status : undefined
      if (status === 'pending' || status === 'rejected') {
        sessionHint(status)
        setAuth({ state: 'waiting', status })
      } else {
        // A server or network error keeps the hint: the session may well be fine.
        if (e instanceof ApiError && e.status === 401) sessionHint('out')
        if (e instanceof ApiError && e.status === 401 && typeof posthog.get_property('$user_id') === 'string') posthog.reset()
        identifiedUserId.current = null
        setAuth({ state: 'out' })
      }
    }
  }, [identifyUser])

  useEffect(() => {
    void load()
  }, [load])

  const signOut = async () => {
    await authClient.signOut()
    posthog.reset()
    identifiedUserId.current = null
    sessionHint('out')
    setAuth({ state: 'out' })
    navigate('/')
  }

  // Until /api/me answers, draw the layout it gave last time instead of a loading screen.
  const hint = auth.state === 'loading' ? sessionHint() : null
  if (auth.state === 'out' || hint === 'out') {
    // Invite links point at /?invite=…, so they skip the homepage and open the form.
    if (location === '/' && !new URLSearchParams(window.location.search).has('invite')) return <Landing />
    if (location === '/reset-password') return <ResetPassword />
    return <SignIn onSignedIn={load} />
  }
  if (auth.state === 'waiting') return <AccessWaiting status={auth.status} onRefresh={load} onSignOut={signOut} />
  if (hint === 'pending' || hint === 'rejected') return <AccessWaiting status={hint} onRefresh={load} onSignOut={signOut} />
  if (auth.state === 'loading') {
    return location === '/welcome' ? <PageSkeleton /> : (
      <Suspense>
        <Shell email="" trial={hint === 'trial'} isAdmin={false} onSignOut={signOut}>
          <PageSkeleton />
        </Shell>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={location === '/welcome' ? <PageSkeleton /> : <Suspense><Shell email={auth.me.user.email} trial={!!auth.me.trial} isAdmin={auth.me.user.isAdmin} onSignOut={signOut}><PageSkeleton /></Shell></Suspense>}>
      <SignedInApp me={auth.me} load={load} signOut={signOut} />
    </Suspense>
  )
}
