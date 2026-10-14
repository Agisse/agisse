/** A prep block while its saved research loads: the block's own heading, placeholders for the lede and the button. */
export function PrepGhost({ title, lines, status }: { title: string; lines: number; status: string }) {
  return (
    <div className="prep">
      <section className="posting__block" aria-busy="true">
        <h3 className="label">{title}</h3>
        <span className="prep__ghost-lede" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => <span key={i} className="feed-ghost" />)}
        </span>
        <span className="feed-ghost prep__ghost-btn" aria-hidden="true" />
        <p className="sr-only" role="status">{status}</p>
      </section>
    </div>
  )
}
