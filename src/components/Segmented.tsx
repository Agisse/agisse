/** A segmented control for switching how the same things are shown (List, Board, Map). */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, name]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => value !== v && onChange(v)}>
          {name}
        </button>
      ))}
    </div>
  )
}
