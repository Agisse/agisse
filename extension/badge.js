// A small Agisse button in the corner of a job page (the sites in manifest.json, after jobpage.js).
// It sends nothing until it is clicked: then it looks the posting up on the seeker's board (saved? applied? keyword match).
// After an application form says "thank you", it asks whether to mark the posting applied. Nothing is recorded without a click.
// It never types into, clicks or submits the page. On LinkedIn it only reads the posting on screen.
;(async () => {
  if (window.top !== window) return
  const { agisseHiddenHosts: hidden = [] } = await chrome.storage.local.get('agisseHiddenHosts')
  if (hidden.includes(location.hostname)) return

  const host = document.createElement('agisse-badge')
  host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    :host { --ink:#0b1a3a; --ink-2:#45526e; --line:#e3e8f0; --blue:#1f45e0; --blue-soft:#e9eefe; --green:#08704a; --red:#b42318;
      font: 400 13px/1.45 'Helvetica Neue', Arial, sans-serif; color: var(--ink); }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button { font: inherit; cursor: pointer; border-radius: 999px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 8px; border: 1px solid var(--line); background: #fff; color: var(--ink);
      font-weight: 700; box-shadow: 0 1px 2px rgb(11 26 58 / .06), 0 12px 32px -12px rgb(11 26 58 / .25); }
    .pill:hover { border-color: var(--blue); }
    .pill img { width: 18px; height: 18px; }
    .card { width: 280px; margin-bottom: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff;
      box-shadow: 0 1px 2px rgb(11 26 58 / .06), 0 12px 32px -12px rgb(11 26 58 / .25); }
    .card p { margin: 0 0 8px; }
    .muted { color: var(--ink-2); font-size: 12px; }
    .err { color: var(--red); }
    .ok { color: var(--green); font-weight: 700; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; }
    .btn { padding: 6px 12px; border: 1px solid var(--line); background: #fff; color: var(--ink); font-weight: 600; }
    .btn--primary { background: var(--blue); border-color: var(--blue); color: #fff; }
    .btn:disabled { opacity: .6; cursor: default; }
    .link { border: 0; padding: 0; background: none; color: var(--ink-2); font-size: 12px; text-decoration: underline; border-radius: 0; }
    .foot { display: flex; justify-content: space-between; margin-top: 10px; }
    :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  </style>
  <div class="card" id="card" role="dialog" aria-label="Agisse" hidden>
    <div id="body" aria-live="polite"></div>
    <div class="foot"><button class="link" id="hide" type="button">Hide on this site</button><button class="link" id="close" type="button">Close</button></div>
  </div>
  <button class="pill" id="pill" type="button" aria-expanded="false">
    <img src="${chrome.runtime.getURL('icons/icon-48.png')}" alt="" aria-hidden="true">
    <span id="pill-text">Agisse</span>
  </button>`
  const $ = (id) => root.getElementById(id)
  const send = (msg) => chrome.runtime.sendMessage(msg).then((r) => (r?.error ? Promise.reject(new Error(r.error)) : r))
  const el = (tag, props, ...kids) => {
    const n = Object.assign(document.createElement(tag), props)
    n.append(...kids)
    return n
  }
  const button = (text, primary, onClick) => {
    const b = el('button', { type: 'button', className: primary ? 'btn btn--primary' : 'btn', textContent: text })
    b.addEventListener('click', async () => {
      b.disabled = true
      try {
        await onClick()
      } catch (e) {
        render(el('p', { className: 'err', textContent: e.message }))
      } finally {
        b.disabled = false
      }
    })
    return b
  }
  const render = (...nodes) => $('body').replaceChildren(...nodes)
  const open = (yes) => {
    $('card').hidden = !yes
    $('pill').setAttribute('aria-expanded', String(yes))
  }
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  // The posting this tab is about. On the thank-you page it is the one remembered from the form page before it.
  const KEY = 'agissePostingSeen'
  const current = () => {
    if (agisseIsPosting()) return agissePosting()
    try {
      return JSON.parse(sessionStorage.getItem(KEY))
    } catch {
      return null
    }
  }

  async function lookup() {
    const posting = current()
    if (!posting) return render(el('p', { className: 'muted', textContent: 'No job posting on this page.' }))
    render(el('p', { className: 'muted', textContent: 'Checking your board…' }))
    const { job, keywords } = await send({ type: 'lookup', url: posting.url })
    if (!job) {
      return render(
        el('p', { textContent: `${posting.company} · ${posting.role}` }),
        el('p', { className: 'muted', textContent: 'Not on your board yet.' }),
        el('div', { className: 'row' }, button('Save posting', true, async () => {
          await send({ type: 'save', posting })
          await lookup()
        })),
      )
    }
    $('pill-text').textContent = job.status === 'applied' && job.appliedAt ? `Applied ${day(job.appliedAt)}` : 'Saved'
    const kw = keywords?.total ? `Keyword match ${Math.round((100 * (keywords.total - keywords.missing.length)) / keywords.total)}%.` : null
    render(
      el('p', { textContent: `${job.company} · ${job.role}` }),
      el('p', { className: 'ok', textContent: job.appliedAt ? `Applied ${day(job.appliedAt)}` : `On your board · ${job.status}` }),
      kw ? el('p', { className: 'muted', textContent: keywords.missing.length ? `${kw} Not in your CV: ${keywords.missing.slice(0, 6).join(', ')}` : `${kw} Your CV covers them all.` }) : el('p', { className: 'muted', textContent: 'Evaluate it in Agisse to see its keywords.' }),
      el('div', { className: 'row' },
        button('Open in Agisse', true, () => send({ type: 'open', path: `/jobs/${job.id}` })),
        job.appliedAt ? '' : button('Mark as applied', false, async () => {
          await send({ type: 'applied', id: job.id })
          await lookup()
        }),
      ),
    )
  }

  // ---- Thank-you detection: asks, never records on its own ----
  const THANKS = /thank you for (applying|your (application|interest))|application (was )?(submitted|received|sent|complete)|your application (was|has been) (sent|submitted|received)|bedankt voor je sollicitatie|merci (pour|de) votre candidature|vielen dank für ihre bewerbung|gracias por (tu|su) (solicitud|candidatura)/i
  const THANKS_URL = /\/(thank-?you|thanks|confirmation|application-?(submitted|complete)|success)(\/|$|\?)/i
  let asked = false
  function askApplied() {
    if (asked) return
    const posting = current()
    if (!posting) return
    asked = true
    open(true)
    render(
      el('p', { textContent: `Did you just apply to ${posting.company}?` }),
      el('div', { className: 'row' },
        button('Mark as applied', true, async () => {
          const { job } = await send({ type: 'lookup', url: posting.url })
          await send({ type: 'applied', id: job?.id, posting })
          render(el('p', { className: 'ok', textContent: 'Marked as applied in Agisse.' }))
          $('pill-text').textContent = 'Applied'
        }),
        button('Not yet', false, () => open(false)),
      ),
    )
  }

  // Page state: remember the posting while on it; watch for SPA navigation and a thank-you message.
  let href = ''
  function check() {
    if (location.href !== href) {
      href = location.href
      asked = false
      $('pill-text').textContent = 'Agisse'
      open(false)
      if (agisseIsPosting()) {
        try {
          sessionStorage.setItem(KEY, JSON.stringify(agissePosting()))
        } catch {
          // Storage blocked or full: the thank-you prompt just won't know the posting.
        }
      }
      host.style.display = current() ? 'block' : 'none'
      if (THANKS_URL.test(location.pathname)) askApplied()
    }
  }
  let timer = 0
  new MutationObserver((records) => {
    if (!asked) {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && n.textContent.length < 3000 && THANKS.test(n.textContent)) askApplied()
    }
    clearTimeout(timer)
    timer = setTimeout(check, 400)
  }).observe(document.documentElement, { childList: true, subtree: true })

  $('pill').addEventListener('click', async () => {
    const yes = $('card').hidden
    open(yes)
    if (yes) await lookup().catch((e) => render(el('p', { className: 'err', textContent: e.message })))
  })
  $('close').addEventListener('click', () => open(false))
  $('hide').addEventListener('click', async () => {
    await chrome.storage.local.set({ agisseHiddenHosts: [...hidden, location.hostname] })
    host.remove()
  })

  document.documentElement.appendChild(host)
  check()
})()
