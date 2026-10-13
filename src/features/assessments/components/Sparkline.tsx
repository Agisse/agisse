/** 0–100 scores as a tiny ink line; decorative, the numbers sit next to it as text. */
export function Sparkline({ points, width = 64, height = 20 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null
  const step = width / (points.length - 1)
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(height - 1 - (Math.max(0, Math.min(100, p)) / 100) * (height - 2)).toFixed(1)}`).join(' ')
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
