import type { JobStatus } from '../../shared/types'

/** The one filled button on a posting's Overview, decided by where the application stands: 'check' scores it first, a path opens that tab, null has none. */
export type PrimaryAction = 'check' | { label: string; path: string } | null

export function primaryAction(status: JobStatus, evaluated: boolean): PrimaryAction {
  const to = (label: string, path: string) => (evaluated || path.startsWith('prepare') ? { label, path } : 'check')
  switch (status) {
    case 'saved':
    case 'evaluated':
      return to('Prepare my application', 'apply')
    case 'applied':
    case 'responded':
      return to('Prepare for the next round', 'prepare')
    case 'assessment':
      return to('Practise the test', 'prepare#online-test')
    case 'interview':
      return to('Rehearse the interview', 'prepare')
    case 'offer':
      return to('Prepare to negotiate', 'offer')
    default:
      return null
  }
}
