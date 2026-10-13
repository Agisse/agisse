// Reads the job posting on this page. Loaded as a content script on job sites (for the badge) and injected by the popup
// elsewhere; both run it in the extension's isolated world, so `agissePosting` is shared. Reads only.
// A posting's company, role, place and deadline come from its schema.org JobPosting when the page has one (most ATS pages do).

// Pages that are one posting even without JSON-LD.
var AGISSE_POSTING_URL = /linkedin\.com\/jobs\/(view\/|.*[?&]currentJobId=)|indeed\.[a-z.]+\/(viewjob|.*[?&]vjk=)|greenhouse\.io\/.+\/jobs\/\d|jobs\.lever\.co\/[^/]+\/[0-9a-f-]{20,}|jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{20,}|jobs\.personio\.[a-z]+\/job\/\d|recruitee\.com\/o\/|apply\.workable\.com\/[^/]+\/j\/|jobs\.smartrecruiters\.com\/[^/]+\/\d|myworkdayjobs\.com\/.*\/job\/|stepstone\.[a-z.]+\/stellenangebote--|arbeitnow\.com\/jobs\//i

function agisseJsonLd() {
  const flat = (x) => (Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? [x, ...flat(x['@graph'])] : [])
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const hit = flat(JSON.parse(el.textContent)).find((x) => [].concat(x['@type']).includes('JobPosting'))
      if (hit) return hit
    } catch {
      // Malformed JSON-LD: skip it.
    }
  }
  return null
}

/** True when this page shows one posting. */
// eslint-disable-next-line no-unused-vars -- used by badge.js and the popup
function agisseIsPosting() {
  return AGISSE_POSTING_URL.test(location.href) || !!agisseJsonLd()
}

// eslint-disable-next-line no-unused-vars -- used by badge.js, the popup and background.js
function agissePosting() {
  const posting = agisseJsonLd()
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.content?.trim() ?? ''
  const org = posting?.hiringOrganization
  const place = [].concat(posting?.jobLocation ?? [])[0]?.address
  let url = location.href
  let body = document.body
  // LinkedIn's search page shows one posting beside the list: keep its own link and only its pane's text.
  const li = /linkedin\.com$/.test(location.hostname) && new URLSearchParams(location.search).get('currentJobId')
  if (li) url = `https://www.linkedin.com/jobs/view/${li}/`
  if (/linkedin\.com$/.test(location.hostname)) body = document.querySelector('.jobs-search__job-details--container, .job-view-layout, main') || body
  // ponytail: LinkedIn's role/company selectors change without notice; og:title and the tab title are the fallback.
  const liRole = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title')?.innerText
  const liCompany = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText
  return {
    kind: 'job',
    url,
    title: document.title,
    text: (getSelection().toString() || body.innerText).slice(0, 30000),
    role: (posting?.title || liRole || meta('og:title') || document.querySelector('h1')?.innerText || document.title).trim().slice(0, 200),
    company: ((typeof org === 'string' ? org : org?.name) || liCompany || meta('og:site_name') || location.hostname.replace(/^www\./, '')).trim().slice(0, 200),
    location: (typeof place === 'string' ? place : [place?.addressLocality, place?.addressCountry?.name ?? place?.addressCountry].filter(Boolean).join(', ')) || null,
    deadline: /^\d{4}-\d{2}-\d{2}/.test(posting?.validThrough ?? '') ? posting.validThrough.slice(0, 10) : null,
  }
}
