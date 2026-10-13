// Technical flashcards with spaced repetition; progress stays in this browser.
import { useState } from 'react'
import { CARDS, DECKS, dueCards, schedule, type Card, type CardState, type Grade } from '../../../shared/technicals'

export type CardGroup = readonly [id: string, label: string, cards: Card[]]
const BY_DECK: CardGroup[] = (Object.entries(DECKS) as [Card['deck'], string][]).map(([d, label]) => [d, label, CARDS.filter((c) => c.deck === d)])
import { Segmented } from './Segmented'
import { useStored } from './useStored'

const GRADES: [Grade, string][] = [
  ['again', 'Again'],
  ['hard', 'Hard'],
  ['good', 'Good'],
  ['easy', 'Easy'],
]

/** Flashcards in switchable groups: decks on the interviews hub, banking topics on the banking page. One progress store for all. */
export function Technicals({ groups = BY_DECK, initial = groups[0]![0], label = 'Deck' }: { groups?: readonly CardGroup[]; initial?: string; label?: string }) {
  const [deck, setDeck] = useState(initial)
  const [states, setStates] = useStored<Record<string, CardState>>('flashcards', {})
  const [shown, setShown] = useState(false)
  // Fixed per visit and per grade, so the queue does not shift while a card is open.
  const [now, setNow] = useState(() => Date.now())
  const cards = (groups.find(([id]) => id === deck) ?? groups[0]!)[2]
  const queue = dueCards(cards, states, now)
  const card = queue[0]
  const learned = cards.filter((c) => (states[c.id]?.box ?? 0) >= 3).length

  const grade = (g: Grade) => {
    const at = new Date().getTime()
    setStates({ ...states, [card!.id]: schedule(states[card!.id], g, at) })
    setNow(at)
    setShown(false)
  }

  return (
    <div className="iv-section">
      <Segmented label={label} options={groups.map(([id, l]) => [id, l] as const)} value={deck} onChange={(d) => (setDeck(d), setShown(false))} />
      <div className="iv-pane">
        <p className="prep__meta tnum">
          {queue.length} to review · {learned} of {cards.length} learned
        </p>
        {card ? (
          <div className="iv-card">
            <p className="mock__question">{card.q}</p>
            {shown ? (
              <>
                <p className="iv-card__answer">{card.a}</p>
                <div className="posting__actions" role="group" aria-label="How well did you know it?">
                  {GRADES.map(([g, label]) => (
                    <button key={g} type="button" className={g === 'good' ? 'btn btn--primary btn--sm' : 'btn btn--sm'} onClick={() => grade(g)}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button type="button" className="btn iv-start-btn" onClick={() => setShown(true)}>
                Show answer
              </button>
            )}
          </div>
        ) : (
          <p className="prep__lede">Nothing due. Cards you know come back after a few days, the rest sooner.</p>
        )}
      </div>
    </div>
  )
}
