// Browser-safe helpers shared by the generated pages and the guides hub.
import { PROVIDER_GAMES } from '../../shared/assessment-catalog'
export { providerName, slug } from '../../shared/assessment-catalog'

export const PROVIDER_IDS = [...new Set(PROVIDER_GAMES.map((g) => g.provider))]
