// Run: npx tsx worker/lib/cv.check.ts
import { inventedIn, rankJudged, verifyBullet, verifyKeywords } from './cv.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const cv = 'Data Analyst Intern, Colruyt Group\n• Helped with the weekly sales report in Power BI for 120 stores'
const line = 'Helped with the weekly sales report in Power BI for 120 stores'

eq(inventedIn('Automated the weekly sales report in Power BI for 120 stores, saving [hours] a week', cv, 35), null, 'placeholder and known facts pass')
eq(inventedIn('Automated the weekly sales report for 120 stores, saving 6 hours a week', cv, 35), 'new number 6', 'invented number')
eq(inventedIn('Built the weekly sales report in Tableau for 120 stores', cv, 35), 'new name Tableau', 'invented tool')
eq(inventedIn('Business analytics intern · Power BI · Aiming for retail analytics', cv, 40), null, 'part starts are not names')
// Headline aims are allowed only when they come from a board role passed in with the source.
eq(inventedIn('Analytics intern · Power BI · Aiming for Investment Banking', cv, 40), 'new name Investment', 'unbacked aim rejected')
eq(inventedIn('Analytics intern · Power BI · Aiming for Investment Banking', `${cv}\n2027 Investment Banking Summer Analyst`, 40), null, 'board role backs the aim')
eq(inventedIn('Spearheaded the weekly report', cv, 35), 'buzzword spearheaded', 'buzzword')
eq(
  verifyBullet(['• Built the weekly sales report in Power BI for 120 stores', line, 'Built the weekly sales report in Power BI for 120 stores', 'Rebuilt the report in Looker'], line, cv),
  ['Built the weekly sales report in Power BI for 120 stores'],
  'bullet options: marker stripped, original and duplicates and inventions dropped',
)
eq(verifyKeywords(['SQL', 'sql', 'Python', 'stakeholder management', 'Data Science'], 'You know SQL and Python and manage stakeholders.'), ['SQL', 'Python'], 'keywords as written')

// Jev: hide only near-certain inventions, show borderline ones last and marked, pick among the supported; no verdict keeps the order.
eq(rankJudged(['a', 'b', 'c'], [0.1, 0.95, 0.75], { o0: 0.2, o1: 0.7, o2: 0.6 }), [{ text: 'a', pick: true, unsupported: false }, { text: 'c', pick: false, unsupported: true }], 'jev hides b, marks c, picks a')
eq(rankJudged(['a', 'b'], [0.1, 0.2], { o0: 0.3, o1: 0.7 }).map((o) => o.text), ['b', 'a'], 'jev reorders')
eq(rankJudged(['a', 'b'], [0.8, 0.75], { o0: 0.6, o1: 0.4 }), [{ text: 'a', pick: false, unsupported: true }, { text: 'b', pick: false, unsupported: true }], 'all borderline: shown, no pick')
eq(rankJudged(['a', 'b'], null, null), [{ text: 'a', pick: false, unsupported: false }, { text: 'b', pick: false, unsupported: false }], 'jev unavailable keeps order')

console.log('cv checks passed')
