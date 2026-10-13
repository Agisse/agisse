/** Pixels per frame to auto-scroll while a card is dragged at x: faster the closer to an edge, 0 outside the edge zones. */
export function edgeSpeed(x: number, left: number, right: number, zone = 80, max = 18): number {
  if (right - left < zone * 2) zone = (right - left) / 2
  if (x < left + zone) return -Math.round(max * Math.min(1, (left + zone - x) / zone))
  if (x > right - zone) return Math.round(max * Math.min(1, (x - (right - zone)) / zone))
  return 0
}

/** The column whose start is nearest the scroll position; at the far end, the last one. */
export function nearestIndex(starts: number[], scrollLeft: number, atEnd = false): number {
  if (!starts.length) return 0
  if (atEnd) return starts.length - 1
  let best = 0
  for (let i = 1; i < starts.length; i++) if (Math.abs(starts[i]! - scrollLeft) < Math.abs(starts[best]! - scrollLeft)) best = i
  return best
}
