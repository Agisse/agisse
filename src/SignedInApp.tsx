import './styles/app.css'
import './styles/components.css'
import './styles/routes.css'
import { lazy, Suspense } from 'react'
import { Link, Redirect, Route, Switch, useLocation } from 'wouter'
import type { Me } from './lib/api'
import { Shell } from './components/Shell'
import { DashboardRoute } from './routes/Dashboard'
import { JobsRoute } from './routes/Jobs'
import { PrepareHub } from './routes/Prepare'
import { Welcome } from './routes/Welcome'
import { NoteLimit } from './lib/hooks'
import { AssistantProvider } from './lib/assistant'
import { AssistantDock } from './components/AssistantDock'
import { noteLimit } from '../shared/types'
import { PageSkeleton } from './components/PageSkeleton'

// Home, Jobs and onboarding are where people land; every other page is its own chunk, fetched on first visit.
// PrepareHub stays: it frames lazy pages, and a lazy frame would fetch the two one after the other.
const MapRoute = lazy(() => import('./routes/Map').then((m) => ({ default: m.MapRoute })))
const ProfileRoute = lazy(() => import('./routes/YourBadge').then((m) => ({ default: m.ProfileRoute })))
const CvRoute = lazy(() => import('./routes/Cv').then((m) => ({ default: m.CvRoute })))
const CvReviewRoute = lazy(() => import('./routes/CvReview').then((m) => ({ default: m.CvReviewRoute })))
const InterviewHub = lazy(() => import('./features/interviews/InterviewHub').then((m) => ({ default: m.InterviewHub })))
const CasePrep = lazy(() => import('./features/interviews/CasePrep').then((m) => ({ default: m.CasePrep })))
const Banking = lazy(() => import('./features/interviews/Banking').then((m) => ({ default: m.Banking })))
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })))
const PracticeRunner = lazy(() => import('./features/assessments/components/PracticeRunner').then((m) => ({ default: m.PracticeRunner })))
const PracticeRoute = lazy(() => import('./features/assessments/components/TrainingHub').then((m) => ({ default: m.PracticeRoute })))
const ExtensionRoute = lazy(() => import('./routes/Extension').then((m) => ({ default: m.ExtensionRoute })))
const ChangelogRoute = lazy(() => import('./routes/Changelog').then((m) => ({ default: m.ChangelogRoute })))
const ChatRoute = lazy(() => import('./routes/Chat').then((m) => ({ default: m.ChatRoute })))
const Consent = lazy(() => import('./routes/Consent').then((m) => ({ default: m.Consent })))

/** Posting tabs before Overview · Apply · Prepare · Offer, and where each went. */
const OLD_TAB: Record<string, string> = { write: 'apply', selection: 'prepare', assessment: 'prepare', pay: 'offer' }

/** Every signed-in page. App loads this module only once /api/me says who is signed in. */
export default function SignedInApp({ me, load, signOut }: { me: Me; load: () => Promise<void>; signOut: () => Promise<void> }) {
  const [location] = useLocation()
  // Onboarding is a focused page of its own, without the section bar.
  if (location === '/welcome') return <Welcome me={me} refreshMe={load} />
  return (
    <AssistantProvider me={me} refreshMe={load}>
    <Shell email={me.user.email} trial={!!me.trial} isAdmin={me.user.isAdmin} onSignOut={signOut}>
      <NoteLimit.Provider value={noteLimit(me.profile)}>
      <Suspense fallback={<PageSkeleton />}>
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
        <Route path="/consent">{() => <Consent />}</Route>
        <Route path="/admin">{() => me.user.isAdmin ? <Admin myId={me.user.id} onBudgetChange={load} /> : <main className="center">Admin access required.</main>}</Route>
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
      </Suspense>
      {!me.trial && <AssistantDock />}
      </NoteLimit.Provider>
    </Shell>
    </AssistantProvider>
  )
}
