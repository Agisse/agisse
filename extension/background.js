// The job-page badge's API calls. Content scripts run under the job site's origin and can't call Agisse; this worker
// can (host permission), with the Agisse session cookie. Every message comes from a click on the badge.
async function api(path, init) {
  const { agisseOrigin = 'https://agisse.xyz' } = await chrome.storage.local.get('agisseOrigin')
  const res = await fetch(agisseOrigin + path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? (res.status === 401 ? 'Sign in to Agisse first.' : `Agisse ${res.status}`))
  return body
}

async function save(p) {
  const { job } = await api('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({ url: p.url, jdText: p.text.trim().slice(0, 20000), save: { company: p.company, role: p.role, location: p.location, deadline: p.deadline } }),
  })
  return job
}

const handlers = {
  lookup: ({ url }) => api(`/api/jobs/lookup?url=${encodeURIComponent(url)}`),
  save: async ({ posting }) => ({ job: await save(posting) }),
  // The user confirmed they applied: save the posting first if it isn't on the board yet.
  applied: async ({ id, posting }) => api(`/api/jobs/${id ?? (await save(posting)).id}`, { method: 'PATCH', body: JSON.stringify({ status: 'applied' }) }),
  open: async ({ path }) => {
    const { agisseOrigin = 'https://agisse.xyz' } = await chrome.storage.local.get('agisseOrigin')
    await chrome.tabs.create({ url: agisseOrigin + path })
    return {}
  },
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  const run = handlers[msg?.type]
  if (!run) return false
  run(msg).then(reply, (e) => reply({ error: e.message || 'Agisse could not be reached.' }))
  return true // reply comes later
})

// Alt+Shift+S: save the posting in this tab, the same as the popup's Save posting.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'save-posting' || !tab?.id) return
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['jobpage.js'] })
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => agissePosting() })
    const job = await save(result)
    await chrome.action.setBadgeText({ tabId: tab.id, text: '✓' })
    await chrome.action.setTitle({ tabId: tab.id, title: `Saved to Agisse: ${job.company} · ${job.role}` })
  } catch (e) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' })
    await chrome.action.setTitle({ tabId: tab.id, title: e.message || 'This page cannot be read.' })
  }
})
