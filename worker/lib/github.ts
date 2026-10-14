/** Rows on the Hired Wall (HIRED.md), withdrawn stories included. */
export const hiredRows = (md: string) => md.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l)).length

/**
 * The launch homepage's open-source numbers, read from GitHub without a token.
 * Anything GitHub doesn't answer (private repo, rate limit) is null, so the page shows nothing rather than a zero.
 */
export async function repoNumbers(fetcher: typeof fetch = fetch): Promise<{ stars: number | null; hired: number | null }> {
  const get = (url: string) => fetcher(url, { headers: { 'User-Agent': 'agisse.xyz' } }).then((r) => (r.ok ? r : null), () => null)
  const [repo, wall] = await Promise.all([get('https://api.github.com/repos/Agisse/agisse'), get('https://raw.githubusercontent.com/Agisse/agisse/main/HIRED.md')])
  const stars = await repo?.json().then((r) => (r as { stargazers_count?: unknown }).stargazers_count, () => null)
  return { stars: typeof stars === 'number' ? stars : null, hired: wall ? hiredRows(await wall.text()) : null }
}
