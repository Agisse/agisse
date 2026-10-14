import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Redirect, Route, Switch, useLocation } from 'wouter'
import { authClient } from './lib/auth-client'
import { api, ApiError, type Me } from './lib/api'
import { Shell } from './components/Shell'
import { ResetPassword, SignIn } from './routes/SignIn'
import { Landing } from './routes/Landing'
import { MapRoute } from './routes/Map'
import { ProfileRoute } from './routes/YourBadge'
import { DashboardRoute } from './routes/Dashboard'
import { JobsRoute } from './routes/Jobs'
import { CvRoute } from './routes/Cv'
import { CvReviewRoute } from './routes/CvReview'
import { PrepareHub } from './routes/Prepare'
import { InterviewHub } from './features/interviews/InterviewHub'
import { CasePrep } from './features/interviews/CasePrep'
import { Banking } from './features/interviews/Banking'
import { Admin } from './routes/Admin'
import { PracticeRunner } from './features/assessments/components/PracticeRunner'
import { PracticeRoute } from './features/assessments/components/TrainingHub'
import { AccessWaiting } from './routes/AccessWaiting'
import { ExtensionRoute } from './routes/Extension'
import { ChangelogRoute } from './routes/Changelog'
import { PricingRoute } from './routes/Pricing'
import { ChatRoute } from './routes/Chat'
import { Consent } from './routes/Consent'
import { Welcome } from './routes/Welcome'
import posthog from './lib/posthog'
import { NoteLimit } from './lib/hooks'
import { AssistantProvider } from './lib/assistant'
import { AssistantDock } from './components/AssistantDock'
import { noteLimit } from '../shared/types'


// ?ref= and ?invite= ride a 30-day cookie, so they survive the hop to /sign-in and the round trip through Google.
for (const key of ['ref', 'invite']) {
  const v = new URLSearchParams(window.location.search).get(key)?.trim()
  if (v && /^[\w-]{4,40}$/.test(v)) document.cookie = `agisse_${key}=${v}; Max-Age=2592000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

/** Posting tabs before Overview · Apply · Prepare · Offer, and where each went. */
const OLD_TAB: Record<string, string> = { write: 'apply', selection: 'prepare', assessment: 'prepare', pay: 'offer' }

type Auth = { state: 'loading' } | { state: 'out' } | { state: 'waiting'; status: 'pending' | 'rejected' } | { state: 'in'; me: Me }

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
    const session = await authClient.getSession().catch(() => null)
    if (session?.data?.user) identifyUser(session.data.user)

    try {
      const me = await api.me()
      identifyUser(me.user)
      setAuth({ state: 'in', me })
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && (e.body as { status?: string } | null)?.status === 'pending') setAuth({ state: 'waiting', status: 'pending' })
      else if (e instanceof ApiError && e.status === 403 && (e.body as { status?: string } | null)?.status === 'rejected') setAuth({ state: 'waiting', status: 'rejected' })
      else {
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
    setAuth({ state: 'out' })
    navigate('/')
  }

  if (auth.state === 'loading') {
    return (
      <div className="center" role="status">
        <span className="label label--muted">Loading…</span>
      </div>
    )
  }
  if (auth.state === 'out') {
    // Invite links point at /?invite=…, so they skip the homepage and open the form.
    if (location === '/' && !new URLSearchParams(window.location.search).has('invite')) return <Landing />
    if (location === '/reset-password') return <ResetPassword />
    return <SignIn onSignedIn={load} />
  }
  if (auth.state === 'waiting') return <AccessWaiting status={auth.status} onRefresh={load} onSignOut={signOut} />

  const { me } = auth
  // Onboarding is a focused page of its own, without the section bar.
  if (location === '/welcome') return <Welcome me={me} refreshMe={load} />
  return (
    <AssistantProvider me={me} refreshMe={load}>
    <Shell email={me.user.email} trial={!!me.trial} isAdmin={me.user.isAdmin} onSignOut={signOut}>
      <NoteLimit.Provider value={noteLimit(me.profile)}>
      <Switch>
        <Route path="/">{() => <DashboardRoute me={me} refreshMe={load} />}</Route>
        <Route path="/sign-in">{() => <Redirect to="/" replace />}</Route>
        <Route path="/contacts">{() => <MapRoute me={me} refreshMe={load} />}</Route>
        <Route path="/s/:id">{(params) => <MapRoute me={me} refreshMe={load} searchId={params.id} />}</Route>
        <Route path="/jobs">{() => <JobsRoute me={me} refreshMe={load} />}</Route>
        {/* Old section URLs: Applications and Companies were folded into Jobs, Assistant into Today, Visited into People. */}
        <Route path="/board">{() => <Redirect to="/jobs?view=track&layout=board" replace />}</Route>
        <Route path="/desk">{() => <Redirect to="/" replace />}</Route>
        <Route path="/scout">{() => <Redirect to="/jobs?view=companies" replace />}</Route>
        <Route path="/visited">{() => <Redirect to="/contacts?view=contacted" replace />}</Route>
        <Route path="/board/map">{() => <Redirect to="/jobs?view=track&layout=map" replace />}</Route>
        <Route path="/jobs/:id/cv">{(params) => <CvRoute me={me} refreshMe={load} jobId={params.id} />}</Route>
        <Route path="/jobs/:id/practice">{(params) => <PracticeRunner jobId={params.id} />}</Route>
        {/* The runner keeps /practice?mode=…; the bare page moved to Prepare › Tests. */}
        <Route path="/practice">{() => (new URLSearchParams(window.location.search).has('mode') ? <PracticeRoute /> : <Redirect to="/prepare" replace />)}</Route>
        <Route path="/prepare/interviews/case">{() => <PrepareHub><CasePrep /></PrepareHub>}</Route>
        <Route path="/prepare/interviews/banking">{() => <PrepareHub><Banking /></PrepareHub>}</Route>
        <Route path="/prepare/interviews">{() => <PrepareHub><InterviewHub /></PrepareHub>}</Route>
                <Route path="/prepare/cv/:tab?">{(params) => <PrepareHub><CvReviewRoute me={me} refreshMe={load} tab={params.tab === 'match' || params.tab === 'linkedin' ? params.tab : 'score'} /></PrepareHub>}</Route>
        <Route path="/prepare/tests">{() => <Redirect to="/prepare" replace />}</Route>
        <Route path="/prepare">{() => <PrepareHub><PracticeRoute /></PrepareHub>}</Route>
        {!me.trial && <Route path="/chat">{() => <ChatRoute />}</Route>}
        {/* One route for every tab so switching tabs keeps the loaded posting. */}
        <Route path="/jobs/:id/:tab?">{(params) => OLD_TAB[params.tab ?? ''] ? <Redirect to={`/jobs/${params.id}/${OLD_TAB[params.tab!]}`} replace /> : <JobsRoute me={me} refreshMe={load} jobId={params.id} tab={params.tab === 'apply' || params.tab === 'prepare' || params.tab === 'offer' ? params.tab : 'overview'} />}</Route>
        {/* Companies live in Jobs; /scout/:id keeps its path so the assistant still knows which search is open. */}
        <Route path="/scout/map">{() => <Redirect to={`/jobs?view=companies&layout=map${window.location.search.replace('?', '&')}`} replace />}</Route>
        <Route path="/scout/:id">{(params) => <JobsRoute me={me} refreshMe={load} scoutId={params.id} />}</Route>
        <Route path="/profile">{() => <ProfileRoute me={me} refreshMe={load} />}</Route>
        <Route path="/profile/review/:tab?">{(params) => <Redirect to={params.tab ? `/prepare/cv/${params.tab}` : '/prepare/cv'} replace />}</Route>
        <Route path="/badge">{() => <Redirect to="/profile" replace />}</Route>
        <Route path="/extension">{() => <ExtensionRoute />}</Route>
        <Route path="/changelog">{() => <ChangelogRoute />}</Route>
        <Route path="/pricing">{() => <PricingRoute trial={!!me.trial} />}</Route>
        <Route path="/consent">{() => <Consent />}</Route>
        <Route path="/admin">{() => me.user.isAdmin ? <Admin onBudgetChange={load} /> : <main className="center">Admin access required.</main>}</Route>
        <Route>
          {() => (
            <main className="center">
              <h1 className="display" style={{ fontSize: 'var(--fs-32)' }}>
                Page not found
              </h1>
              <Link href="/">Back to Today</Link>
            </main>
          )}
        </Route>
      </Switch>
      {!me.trial && <AssistantDock />}
      </NoteLimit.Provider>
    </Shell>
    </AssistantProvider>
  )
}
