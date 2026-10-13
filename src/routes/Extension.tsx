import { Link } from 'wouter'
import { Check } from 'lucide-react'

/** How to install the browser extension and what it does. Linked from Jobs and the Visited page. */
export function ExtensionRoute() {
  return (
    <main className="map map--stack extension-page">
      <h1 className="display intake__title">Browser extension</h1>
      <p className="intake__lede">Save postings and LinkedIn contacts in one click, and draft answers to an application's questions for you to paste in. Chrome, Edge and Brave.</p>

      <section className="how">
        <h2 className="label label--muted how__title">Install</h2>
        <ol>
          <li>
            <span>
              <a href="/agisse-extension.zip" download className="btn btn--primary btn--sm">Download the extension</a> and unzip it where it can stay. Deleting the folder removes it.
            </span>
          </li>
          <li>
            <span>
              Open <code>chrome://extensions</code>, turn on <strong>Developer mode</strong>, click <strong>Load unpacked</strong> and pick the folder.
            </span>
          </li>
          <li>
            <span>Pin it: puzzle icon next to the address bar, then the pin next to Agisse.</span>
          </li>
        </ol>
      </section>

      <section className="how">
        <h2 className="label label--muted how__title">Use</h2>
        <ol>
          <li>
            <span>
              <strong>On a job posting</strong>, click the Agisse icon, then <strong>Save posting</strong>. It lands in <Link href="/jobs?view=track&status=saved">Saved</Link> for free, with its deadline when the page states one. <strong>Save and evaluate</strong> opens Jobs and scores it against your CV at once. Select part of the page first to send only that part. <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> saves without opening the popup.
            </span>
          </li>
          <li>
            <span>
              <strong>On LinkedIn Jobs, Indeed, StepStone and the common application sites</strong> (Greenhouse, Lever, Ashby, Workday, Personio and more), a small Agisse button sits in the corner. Click it to see whether the posting is already on your board, when you applied and which of its keywords your CV misses. After you submit an application, it asks whether to mark the posting applied.
            </span>
          </li>
          <li>
            <span>
              <strong>On a LinkedIn profile</strong>, click <strong>Save contact</strong>. <Link href="/contacts?view=contacted">People</Link> opens with the person marked contacted.
            </span>
          </li>
          <li>
            <span>
              <strong>On an application form</strong>, signed in, click <strong>Draft answers to this form's questions</strong>. It drafts each answer from your CV in the popup; copy it, paste it in and submit yourself. <strong>Your saved answers for this form</strong> shows the notice period, salary or work-permit answer a field asks for, from your <Link href="/profile">Profile</Link>, ready to copy.
            </span>
          </li>
        </ol>
      </section>

      <section className="how">
        <h2 className="label label--muted how__title">What it never does</h2>
        <ul className="extension-page__never">
          <li>
            <Check aria-hidden="true" /> <span>Sends nothing until you click. The corner button on job sites reads only the posting on screen.</span>
          </li>
          <li>
            <Check aria-hidden="true" /> <span>No messages, connection requests, LinkedIn login, typing into forms or submitting.</span>
          </li>
          <li>
            <Check aria-hidden="true" /> <span>Holds no account or cookies: saving happens on the Agisse page it opens, signed in as you.</span>
          </li>
        </ul>
      </section>

      <details className="index-card__options extension-page__help">
        <summary>
          <span>If it does not work</span>
        </summary>
        <ul className="extension-page__never">
          <li>
            <span>“This page cannot be read”: browser pages, PDFs and some app pages block extensions. Paste the text into Jobs instead.</span>
          </li>
          <li>
            <span>Agisse opens but nothing is filled: you are signed out. Sign in, go back and click again.</span>
          </li>
          <li>
            <span>
              New version: download the zip again, replace the folder contents and click the reload arrow on <code>chrome://extensions</code>.
            </span>
          </li>
        </ul>
      </details>
    </main>
  )
}
