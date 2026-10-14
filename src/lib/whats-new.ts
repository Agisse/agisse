import changelog from '../../CHANGELOG.md?raw'
import { parseChangelog, releaseKey } from './changelog'

export const releases = parseChangelog(changelog)

const KEY = 'agisse.changelogSeen'
const newest = releases[0] ? releaseKey(releases[0]) : ''

/** Whether the newest release changed since this browser last opened What's new. A first visit counts as seen: a new account has nothing to catch up on. */
export function hasNews(): boolean {
  const seen = localStorage.getItem(KEY)
  if (seen === null) localStorage.setItem(KEY, newest)
  return seen !== null && seen !== newest
}

export const markNewsSeen = () => localStorage.setItem(KEY, newest)
