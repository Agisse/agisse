import { useState, type ComponentType } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import { AptLayout, Choices, Explain, deck, useItemLoop } from './Aptitude'
import { VERBAL_PASSAGES, type Tfc } from './verbalItems'

// Verbal reasoning, True / False / Cannot say (SHL Verify, Capp, Sova, Saville, Talent Q): one passage and one statement per screen.

export const TFC: Tfc[] = ['true', 'false', 'cannot-say']
const LABEL = ['True', 'False', 'Cannot say']
export const VERBAL_ITEMS = VERBAL_PASSAGES.flatMap((p) => p.statements.map((s) => ({ passage: p, ...s })))

function VerbalTfcGame(props: GameProps) {
  const [draw] = useState(() => deck(VERBAL_ITEMS))
  const { item, result, submit, next, seq } = useItemLoop(draw, props)
  const answer = TFC.indexOf(item.answer)
  return (
    <AptLayout
      stimulus={
        <>
          <div className="apt__caption">{item.passage.topic}</div>
          <p>{item.passage.text}</p>
        </>
      }
      question={
        <>
          {item.text}
          <span className="apt__rule">True: follows from the passage. False: contradicts it. Cannot say: the passage does not tell you.</span>
        </>
      }
    >
      <Choices key={seq} options={LABEL} answer={answer} result={result} onPick={(_, ok) => submit(ok, item.answer)} />
      {result !== null && <Explain ok={result} text={<p>{`${LABEL[answer]}. ${item.why}`}</p>} onNext={next} />}
    </AptLayout>
  )
}

export const verbalTfc: GameDef = {
  id: 'verbal-tfc',
  name: 'Verbal reasoning',
  skills: ['verbal-reasoning'],
  howTo: 'Read the passage, then say whether the statement is True, False or Cannot say from the passage alone.',
  duration: 600,
  targetRt: 45000,
  Component: VerbalTfcGame satisfies ComponentType<GameProps>,
}
