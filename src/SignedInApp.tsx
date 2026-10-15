import './styles/app.css'
import './styles/components.css'
import './styles/routes.css'
import { Link, Redirect, Route, Switch, useLocation } from 'wouter'
import type { Me } from './lib/api'
import { Shell } from './components/Shell'
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
import { ExtensionRoute } from './routes/Extension'
import { ChangelogRoute } from './routes/Changelog'
import { ChatRoute } from './routes/Chat'
import { Consent } from './routes/Consent'
import { Welcome } from './routes/Welcome'
import { NoteLimit } from './lib/hooks'
import { AssistantProvider } from './lib/assistant'
import { AssistantDock } from './components/AssistantDock'
import { noteLimit } from '../shared/types'

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
