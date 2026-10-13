import type { JobSummary } from '../../shared/types'

/** One CSV field: quoted when it holds a comma, quote or line break; a leading = + - @ is defused so a spreadsheet does not run it as a formula. */
export function csvField(v: string | number | null | undefined) {
  if (v == null) return ''
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'

const day = (iso: string | null) => iso?.slice(0, 10) ?? ''

/** The tracker as a spreadsheet, one row per posting. */
export const trackerCsv = (jobs: JobSummary[]) =>
  toCsv([['Company', 'Role', 'Location', 'Status', 'Applied', 'Next date', 'Score', 'URL'], ...jobs.map((j) => [j.company, j.role, j.location, j.status, day(j.appliedAt), day(j.nextAt), j.score, j.url])])
