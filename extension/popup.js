// Reads the active tab and hands it to the Agisse page that saves it. The page makes that API call.
// "Application" is the exception: it calls the API with the Agisse session cookie (host permission) to read the
// posting's keywords and draft answers the user asked for, one click per question.
// LinkedIn: only the profile the user is looking at, only when they click. Never messages, connection requests or login.
// Agisse helps, it doesn't automate: it never types into or submits a page. Drafts are shown here for the user to copy.
const $ = (id) => document.getElementById(id)
const origin = $('origin')
const send = $('send')
const evaluate = $('evaluate')
const note = $('note')

function show(text, { error = false } = {}) {
  note.replaceChildren(text)
  note.classList.toggle('is-error', error)
  note.hidden = false
}

chrome.storage.local.get('agisseOrigin').then(({ agisseOrigin }) => {
  if (agisseOrigin) origin.value = agisseOrigin
})
origin.addEventListener('change', () => chrome.storage.local.set({ agisseOrigin: origin.value }))

// Form details the removed autofill kept in this browser (phone, city, links): drop them.
chrome.storage.local.remove(['agisseSynced', 'agisseMine'])

// ---- This tab ----

// Runs inside the tab, after jobpage.js. A LinkedIn profile becomes a contact, anything else a posting.
function readTab() {
  const profile = /linkedin\.com$/.test(location.hostname) && /^\/in\/[^/]+/.test(location.pathname)
  if (!profile) return agissePosting()
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  // ponytail: LinkedIn markup changes without notice; the tab title ("Name - Headline | LinkedIn") is the fallback for both fields.
  const [, titleName = '', titleHeadline = ''] = /^(?:\(\d+\)\s*)?(.*?)(?:\s+-\s+(.*?))?\s*\|\s*LinkedIn$/.exec(document.title) || []
  const name = clean(document.querySelector('main h1')?.innerText) || clean(titleName)
  const title = clean(document.querySelector('main .text-body-medium')?.innerText) || clean(titleHeadline)
  const company = clean(document.querySelector('button[aria-label^="Current company"]')?.innerText) || (/(?:\b(?:at|bij|chez)\b|@)\s+(.+)$/i.exec(title)?.[1] ?? '')
  return { kind: 'contact', url: location.origin + location.pathname, name, title, company }
}

// Every frame we may read (Greenhouse and friends embed the form in an iframe); if one refuses, the top frame alone.
async function inject(tabId, opts) {
  try {
    return await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, ...opts })
  } catch {
    return chrome.scripting.executeScript({ target: { tabId }, ...opts })
  }
}

async function readActive(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['jobpage.js'] })
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: readTab })
  return result
}

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  let u = null
  try {
    u = new URL(tab.url)
  } catch {
    // No URL (e.g. a browser page): executeScript below fails and says so.
  }
  $('host').textContent = u?.hostname.replace(/^www\./, '') ?? ''
  const profile = u && /(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.startsWith('/in/')
  send.textContent = profile ? 'Save contact' : 'Save posting'
  evaluate.hidden = profile

  // Hands the tab to Agisse, which saves the contact or evaluates the posting (one model call) as it opens.
  const handOff = async (button) => {
    button.disabled = true
    try {
      const result = await readActive(tab.id)
      await chrome.storage.local.set({ agissePending: result })
      await chrome.tabs.create({ url: origin.value + (result.kind === 'contact' ? '/contacts?import=1' : '/jobs?import=1') })
      window.close()
    } catch {
      button.disabled = false
      show('This page cannot be read. Copy it into Agisse instead.', { error: true })
    }
  }
  evaluate.addEventListener('click', () => handOff(evaluate))

  // A posting is saved straight from here: free, no model call, evaluated later in Agisse.
  send.addEventListener('click', async () => {
    if (profile) return handOff(send)
    send.disabled = true
    let posting
    try {
      posting = await readActive(tab.id)
    } catch {
      send.disabled = false
      return show('This page cannot be read. Copy it into Agisse instead.', { error: true })
    }
    try {
      const { job, existing } = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ url: posting.url, jdText: posting.text.trim().slice(0, 20000), save: { company: posting.company, role: posting.role, location: posting.location, deadline: posting.deadline } }),
      })
      show(existing ? `Already in Agisse: ${job.company} · ${job.role}.` : `Saved: ${job.company} · ${job.role}${posting.deadline ? `, apply by ${posting.deadline}` : ''}.`)
      const open = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small', textContent: 'Open in Agisse' })
      open.addEventListener('click', () => chrome.tabs.create({ url: `${origin.value}/jobs/${job.id}` }))
      note.appendChild(open)
      send.textContent = 'Saved'
    } catch (e) {
      send.disabled = false
      show(e.message, { error: true })
    }
  })

  // Undo the badge's "Hide on this site".
  chrome.storage.local.get('agisseHiddenHosts').then(({ agisseHiddenHosts: hidden = [] }) => {
    if (!u || !hidden.includes(u.hostname)) return
    $('unhide').hidden = false
    $('unhide').addEventListener('click', async () => {
      await chrome.storage.local.set({ agisseHiddenHosts: hidden.filter((h) => h !== u.hostname) })
      $('unhide').hidden = true
      show('The button comes back when you reload the page.')
    })
  })

  if (!profile) void application(tab, u)
  else ownProfile(tab)
})

// ---- Application: missing keywords and answers to the form's own questions, for a posting on the user's board ----

const api = async (path, init) => {
  const res = await fetch(origin.value + path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? (res.status === 401 ? 'Sign in to Agisse first.' : `Agisse ${res.status}`))
  return body
}

// The posting this form belongs to: same host, and one path inside the other (".../jobs/123" and ".../jobs/123/apply").
const trim = (url) => {
  try {
    const x = new URL(url)
    return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/(apply|application)?\/?$/, '')
  } catch {
    return ''
  }
}
const sameJob = (a, b) => !!a && !!b && (a.startsWith(b) || b.startsWith(a))

async function application(tab, u) {
  const { agisseOrigin } = await chrome.storage.local.get('agisseOrigin')
  if (agisseOrigin) origin.value = agisseOrigin
  let jobs
  try {
    jobs = (await api('/api/jobs')).jobs
  } catch {
    return // Signed out or offline: the section stays hidden, Save still works.
  }
  if (!jobs.length) return
  const select = $('job')
  const here = trim(u?.href)
  const match = jobs.find((j) => sameJob(trim(j.url), here)) ?? jobs.find((j) => u && j.url && new URL(j.url).hostname === u.hostname)
  for (const j of jobs.slice(0, 30)) select.appendChild(Object.assign(document.createElement('option'), { value: j.id, textContent: `${j.company} · ${j.role}`, selected: j === match }))
  $('apply').hidden = false
  const keywords = async () => {
    $('keywords').textContent = ''
    try {
      const { job, missingKeywords: missing } = await api(`/api/jobs/${select.value}?keywords=1`)
      const line = $('keywords')
      if (!job.evaluation) return (line.textContent = 'Evaluate this posting in Agisse to see its keywords.')
      if (!missing.length) return (line.textContent = 'Your CV covers every keyword in this posting.')
      const total = job.evaluation.keywords.length
      line.append(Object.assign(document.createElement('strong'), { textContent: `Keyword match ${Math.round((100 * (total - missing.length)) / total)}%. Not in your CV: ` }), missing.slice(0, 10).join(', '))
    } catch (e) {
      $('keywords').textContent = e.message
    }
  }
  select.addEventListener('change', () => { $('qs').replaceChildren(); $('as').replaceChildren(); void keywords() })
  void keywords()

  // The tailored CV for this posting, to print to PDF and attach yourself.
  $('cv').addEventListener('click', () => chrome.tabs.create({ url: `${origin.value}/jobs/${select.value}/cv` }))

  // Fields that ask for one of the answers saved on the Profile (notice, salary…): shown here to copy. No model call.
  $('saved-answers').addEventListener('click', async () => {
    const list = $('as')
    $('saved-answers').disabled = true
    try {
      const runs = await inject(tab.id, { func: readLabels })
      const labels = [...new Set(runs.flatMap((r) => r.result ?? []))]
      const { matches } = await api('/api/profile/answers/match', { method: 'POST', body: JSON.stringify({ labels }) })
      list.replaceChildren()
      if (!matches.length) return show('No field on this form asks for a saved answer (notice, salary, work permit, relocation, where you heard about us).', { error: true })
      note.hidden = true
      for (const m of matches) list.appendChild(saved(m))
    } catch (e) {
      show(e.message || 'This page cannot be read.', { error: true })
    } finally {
      $('saved-answers').disabled = false
    }
  })

  $('questions').addEventListener('click', async () => {
    const list = $('qs')
    $('questions').disabled = true
    try {
      const runs = await inject(tab.id, { func: readQuestions })
      const found = [...new Map(runs.flatMap((r) => r.result ?? []).map((q) => [q.label, q])).values()]
      list.replaceChildren()
      if (!found.length) return show('No open questions on this form. Agisse looks for empty text boxes with a question as their label.', { error: true })
      note.hidden = true
      for (const q of found) list.appendChild(question(select.value, q))
    } catch {
      show('This page cannot be read. Browser pages and some app pages block extensions.', { error: true })
    } finally {
      $('questions').disabled = false
    }
  })
}

// Runs inside the tab: empty free-text questions (textareas, and inputs whose label asks a question). Reads only.
function readQuestions() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim()
  // Someone else's details, or a plain detail field rather than a question.
  const skip = /refer|reference|emergency|recruiter|manager|guardian|relocat|hear about|e-?mail|phone|linked\s?in|website|portfolio|address/i
  const out = []
  for (const el of document.querySelectorAll('textarea, input[type="text"], input:not([type])')) {
    if (el.disabled || el.readOnly || el.value.trim() || !el.getClientRects().length) continue
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.innerText).join(' ')
    const label = [...Array.from(el.labels || [], (l) => l.innerText), labelledBy, el.getAttribute('aria-label'), el.placeholder, el.closest('fieldset')?.querySelector('legend')?.innerText]
      .map(clean)
      .find((t) => t.length >= 8)
    if (!label || skip.test(label) || (el.tagName === 'INPUT' && !label.includes('?'))) continue
    const max = Number(el.getAttribute('maxlength')) > 0 ? Number(el.getAttribute('maxlength')) : null
    if (max && max < 50) continue
    out.push({ label: label.slice(0, 1000), max })
  }
  return out
}

// Runs inside the tab: the label of every visible, empty form field (text, choice or group). Reads only.
function readLabels() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim()
  const out = []
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (el.disabled || el.type === 'hidden' || el.type === 'file' || !el.getClientRects().length) continue
    if (!['radio', 'checkbox'].includes(el.type) && el.value.trim() && !(el.tagName === 'SELECT' && el.selectedIndex <= 0)) continue
    const group = el.closest('fieldset, [role="radiogroup"], [role="group"]')
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.innerText).join(' ')
    const label = [group?.querySelector('legend')?.innerText, group?.getAttribute('aria-label'), ...Array.from(el.labels || [], (l) => l.innerText), labelledBy, el.getAttribute('aria-label'), el.placeholder]
      .map(clean)
      .find((t) => t.length >= 3)
    if (label) out.push(label.slice(0, 1000))
  }
  return out
}

// One saved answer: the field's label, the answer, Copy. An empty answer points to the Profile.
function saved(m) {
  const li = document.createElement('li')
  const status = document.createElement('small')
  li.append(Object.assign(document.createElement('span'), { textContent: m.label.length > 120 ? m.label.slice(0, 117) + '…' : m.label }))
  if (!m.text) {
    const add = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small', textContent: `Add your ${m.name.toLowerCase()} in Agisse` })
    add.addEventListener('click', () => chrome.tabs.create({ url: origin.value + '/profile' }))
    li.append(add)
    return li
  }
  const copy = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small btn--primary', textContent: 'Copy' })
  li.append(Object.assign(document.createElement('p'), { className: 'draft', textContent: m.text }), copy, status)
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(m.text)
      status.textContent = 'Copied. Paste it into the form.'
    } catch {
      status.textContent = 'Copy failed. Select the text and copy it yourself.'
    }
  })
  return li
}

// One question: draft from the CV on click, show it here, copy on click. The user pastes it into the form.
function question(jobId, q) {
  const li = document.createElement('li')
  const status = document.createElement('small')
  const draft = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small', textContent: 'Draft answer' })
  const text = Object.assign(document.createElement('p'), { className: 'draft', hidden: true })
  const copy = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small btn--primary', textContent: 'Copy', hidden: true })
  li.append(Object.assign(document.createElement('span'), { textContent: q.label.length > 160 ? q.label.slice(0, 157) + '…' : q.label }), text, draft, copy, status)
  draft.addEventListener('click', async () => {
    draft.disabled = true
    status.className = ''
    status.textContent = 'Writing from your CV…'
    try {
      const { answer } = await api(`/api/jobs/${jobId}/answer`, { method: 'POST', body: JSON.stringify({ question: q.label, maxChars: q.max }) })
      text.textContent = answer
      text.hidden = copy.hidden = false
      status.textContent = 'Read it, fill any [placeholder], then copy and paste it into the form.'
      draft.textContent = 'Draft again'
    } catch (e) {
      status.className = 'is-error'
      status.textContent = e.message
    } finally {
      draft.disabled = false
    }
  })
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text.textContent)
      status.textContent = 'Copied. Paste it into the form.'
    } catch {
      status.textContent = 'Copy failed. Select the text and copy it yourself.'
    }
  })
  return li
}

// ---- Your own LinkedIn profile: rule checks on the page text, the same as the LinkedIn tab of Agisse's CV review ----

// Runs inside the tab: the profile's visible text, its headline and URL. Read once, when the user clicks.
function readOwnProfile() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const [, , titleHeadline = ''] = /^(?:\(\d+\)\s*)?(.*?)(?:\s+-\s+(.*?))?\s*\|\s*LinkedIn$/.exec(document.title) || []
  const headline = clean(document.querySelector('main .text-body-medium')?.innerText) || clean(titleHeadline)
  return { text: (document.querySelector('main') || document.body).innerText.slice(0, 30000), headline, url: location.origin + location.pathname }
}

function ownProfile(tab) {
  const button = $('li-review')
  $('li').hidden = false
  button.addEventListener('click', async () => {
    button.disabled = true
    const out = $('li-out')
    out.replaceChildren()
    try {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readOwnProfile })
      const { review } = await api('/api/cv/linkedin-review', { method: 'POST', body: JSON.stringify(result) })
      out.appendChild(Object.assign(document.createElement('p'), { className: 'li-score', textContent: `${review.score}/100 · ${review.band}` }))
      const failed = review.checks.filter((c) => !c.pass)
      if (!failed.length) out.appendChild(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Every check passes.' }))
      for (const c of failed) {
        const li = document.createElement('li')
        li.append(Object.assign(document.createElement('strong'), { textContent: c.label }), ' ', c.tip)
        out.appendChild(li)
      }
      const more = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--small', textContent: 'Headline ideas in Agisse' })
      more.addEventListener('click', () => chrome.tabs.create({ url: origin.value + '/prepare/cv/linkedin' }))
      out.appendChild(more)
    } catch (e) {
      out.appendChild(Object.assign(document.createElement('p'), { className: 'hint is-error', textContent: e.message || 'This page cannot be read.' }))
    } finally {
      button.disabled = false
    }
  })
}
