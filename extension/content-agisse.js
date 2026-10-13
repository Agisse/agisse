// Runs on Agisse pages: hands the posting captured by the popup to the Jobs page.
// The page may mount its listener after this runs, so repost every 500 ms (up to ~5 s) until it acks.
chrome.storage.local.get('agissePending').then(({ agissePending: data }) => {
  if (!data) return
  chrome.storage.local.remove('agissePending')
  let tries = 0
  const post = () => window.postMessage({ source: 'agisse-ext', ...data }, location.origin)
  const onAck = (e) => e.data?.source === 'agisse-app' && e.data.ack && stop()
  const timer = setInterval(() => (++tries >= 10 ? stop() : post()), 500)
  function stop() {
    clearInterval(timer)
    window.removeEventListener('message', onAck)
  }
  window.addEventListener('message', onAck)
  post()
})

