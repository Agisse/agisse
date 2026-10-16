/** After this many seconds a wait says that slow models are still normal. */
export const SLOW_AFTER = 20

/**
 * Which step a wait shows after `elapsed` seconds. Steps are time-based, not reported by the server, so the
 * copy stays ongoing ("Weighing the fit…") and the last step holds until the answer lands.
 * The steps share `expected` seconds evenly; the last one starts at the latest share and never ends early.
 */
export function stepAt(elapsed: number, count: number, expected: number): number {
  if (count <= 1 || elapsed <= 0) return 0
  return Math.min(count - 1, Math.floor((elapsed * count) / expected))
}

/** Checking a posting against the CV: the main wait. */
export const EVALUATE_STEPS = ['Reading the posting', 'Comparing it with your CV', 'Weighing the fit', 'Writing the verdict']
/** Feedback on a practice answer. */
export const REVIEW_STEPS = ['Reading your answer', 'Checking structure and evidence', 'Writing feedback']
