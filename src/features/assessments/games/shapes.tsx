/** Inline-SVG shapes shared by Flashback and Tickets, on a 100×100 box: [rx, ry] for round ones, polygon points otherwise. */
const SHAPE_ART = {
  circle: [40, 40],
  oval: [44, 28],
  square: '15,15 85,15 85,85 15,85',
  triangle: '50,10 92,86 8,86',
  diamond: '50,6 94,50 50,94 6,50',
  pentagon: '50,8 92,39 76,90 24,90 8,39',
  star: '50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38',
  cross: '38,10 62,10 62,38 90,38 90,62 62,62 62,90 38,90 38,62 10,62 10,38 38,38',
} as const
export type ShapeName = keyof typeof SHAPE_ART

export function Shape({ name, size = 96, className }: { name: ShapeName; size?: number; className?: string }) {
  const art = SHAPE_ART[name]
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      {typeof art === 'string' ? <polygon points={art} /> : <ellipse cx="50" cy="50" rx={art[0]} ry={art[1]} />}
    </svg>
  )
}
