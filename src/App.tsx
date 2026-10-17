import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { authClient } from './lib/auth-client'
import { api, ApiError, type Me } from './lib/api'
import { ResetPassword, SignIn } from './routes/SignIn'
import { Landing } from './routes/Landing'
import { AccessDeclined } from './routes/AccessDeclined'
import posthog from './lib/posthog'
import { sessionHint } from './lib/hooks'
import { PageSkeleton } from './components/PageSkeleton'

// The signed-in app and its shell are their own chunks, so the homepage, sign-in and the declined screen don't download them.
// A signed-in hint starts both downloads at once, next to /api/me instead of after it. The shell is small, so it
// usually arrives first and frames the page while the rest loads.
const loadSignedIn = () => import('./SignedInApp')
const loadShell = () => import('./components/Shell').then((m) => ({ default: m.Shell }))
if (sessionHint() === 'in') {
  void loadShell()
  void loadSignedIn()
}
const SignedInApp = lazy(loadSignedIn)
const Shell = lazy(loadShell)


type Auth = { state: 'loading' } | { state: 'out' } | { state: 'declined' } | { state: 'in'; me: Me }

export default function App() {
  const [auth, setAuth] = useState<Auth>({ state: 'loading' })
  const [location, navigate] = useLocation()
  const identifiedUserId = useRef<string | null>(null)

  const identifyUser = useCallback((user: Pick<Me['user'], 'id'>) => {
    if (identifiedUserId.current === user.id) return

    const persistedUserId = posthog.get_property('$user_id')
    if (typeof persistedUserId === 'string' && persistedUserId !== user.id) posthog.reset()

    // The id only: PostHog never gets a seeker's name or email.
    posthog.identify(user.id)
    identifiedUserId.current = user.id
  }, [])

  const load = useCallback(async () => {
    // /api/me alone decides signed in, declined or out; a getSession call first only added a round trip.
    try {
      const me = await api.me()
      identifyUser(me.user)
      sessionHint('in')
      setAuth({ state: 'in', me })
    } catch (e) {
      const status = e instanceof ApiError && e.status === 403 ? (e.body as { status?: string } | null)?.status : undefined
      if (status === 'rejected') {
        sessionHint('rejected')
        setAuth({ state: 'declined' })
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
    // Owner decision (#148): assistant chats stay in this browser until sign-out, so a shared computer doesn't keep them.
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('agisse.chats.')).forEach((k) => localStorage.removeItem(k))
    } catch {
      /* storage blocked: nothing was kept */
    }
    identifiedUserId.current = null
    sessionHint('out')
    setAuth({ state: 'out' })
    navigate('/')
  }

  // Until /api/me answers, draw the layout it gave last time instead of a loading screen.
  const hint = auth.state === 'loading' ? sessionHint() : null
  if (auth.state === 'out' || hint === 'out') {
    if (location === '/') return <Landing />
    if (location === '/reset-password') return <ResetPassword />
    return <SignIn onSignedIn={load} />
  }
  if (auth.state === 'declined' || hint === 'rejected') return <AccessDeclined onSignOut={signOut} />
  if (auth.state === 'loading') {
    return location === '/welcome' ? <PageSkeleton /> : (
      <Suspense>
        <Shell email="" isAdmin={false} onSignOut={signOut}>
          <PageSkeleton />
        </Shell>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={location === '/welcome' ? <PageSkeleton /> : <Suspense><Shell email={auth.me.user.email} isAdmin={auth.me.user.isAdmin} onSignOut={signOut}><PageSkeleton /></Shell></Suspense>}>
      <SignedInApp me={auth.me} load={load} signOut={signOut} />
    </Suspense>
  )
}
