// Browser-safe helpers shared by the generated pages and the guides hub.
import { PROVIDER_GAMES } from '../../shared/assessment-catalog'
import { PROVIDERS } from '../../shared/assessments'

export const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const EXTRA_NAMES: Record<string, string> = { 'mckinsey-solve': 'McKinsey Solve', criteria: 'Criteria', saville: 'Saville', 'talent-q': 'Korn Ferry (Talent Q)', 'watson-glaser': 'Watson-Glaser', harver: 'Harver' }
export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? EXTRA_NAMES[id] ?? id

export const PROVIDER_IDS = [...new Set(PROVIDER_GAMES.map((g) => g.provider))]
