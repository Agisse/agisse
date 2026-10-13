# Browser extension

A Manifest V3 extension that sends the page you're looking at into Agisse with one click. It does nothing on LinkedIn beyond reading the current page — no messaging, no connection requests, no crawling, no login — and it never fills in or submits a form. Agisse is there to help, not automate.

## Install

Not on the Chrome Web Store. Works in Chrome, Edge and Brave.

<a href="/agisse-extension.zip" download target="_self">Download agisse-extension.zip</a>

1. Unzip it somewhere you will keep it. Deleting the folder removes the extension.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.
5. Pin it: click the puzzle icon next to the address bar, then the pin next to Agisse.

To update, download the zip again, replace the folder's contents and click the reload arrow on `chrome://extensions`.

## Use

- On a LinkedIn profile (`linkedin.com/in/...`): open the popup and click **Save contact**. It grabs name, title, and company, and opens Agisse's Contacts page with the person already marked contacted.
- On **your own** LinkedIn profile: click **Review my profile** (signed in to Agisse). It reads the page you're on once and scores your headline, About, experience and skills, then lists what to fix. No model call, nothing stored.
- On any other page (a job posting): open the popup and click **Save posting**. It grabs the selected text, or the page's visible text if nothing is selected, and saves it to Jobs › Saved straight from the popup (signed in, no model call). Company, role, place and deadline come from the page's schema.org `JobPosting` data when it has one, else from its title. **Save and evaluate** opens Agisse's Jobs page instead, which evaluates it at once.

- Below that, **Application** (while you are signed in to Agisse): pick the posting from Jobs (it is preselected when the form's link matches), and the popup shows your keyword match % and lists the posting's keywords your CV doesn't mention. **Draft answers to this form's questions** lists the empty text boxes that ask something ("Why do you want to join us?"); **Draft answer** writes an answer from your CV and shows it in the popup, one model call per click; **Copy** puts it on your clipboard to paste into the form yourself. Facts your CV can't know (notice period, salary) come back as a [placeholder].

- On a form, **Your saved answers for this form** lists the fields that ask for one of your standard answers (notice period, salary expectation, work permit, relocation, where you heard about us) with the answer from your Profile, ready to **Copy**. No model call. **Open tailored CV** opens the posting's CV to print to PDF and attach yourself.

- **Corner button on job sites** (LinkedIn Jobs, Indeed, StepStone, Arbeitnow, Greenhouse, Lever, Ashby, Personio, Recruitee, Workable, SmartRecruiters, Workday): a small Agisse button appears on a posting. Clicking it looks the posting up on your board (`GET /api/jobs/lookup`): saved or not, applied when, and the posting's keywords your CV misses, with **Save posting**, **Open in Agisse** and **Mark as applied**. After a form shows a "thank you for applying" message or URL, it asks **Did you just apply?**; nothing is recorded unless you click. **Hide on this site** removes it per site; the popup shows it again.
- **Alt+Shift+S** saves the posting in the tab without opening the popup (✓ on the icon when saved).

The extension sends nothing until you click. Drafting an answer sends the question to Agisse, which counts toward your monthly usage.
