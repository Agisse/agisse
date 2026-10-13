import { useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { AptLayout, Choices, Explain, deck, useItemLoop } from './Aptitude'
import { CR_ITEMS, CR_OPTIONS, CR_RULES, CR_TYPES, type CrType } from './criticalItems'

// Critical thinking in the five classic sections (Watson-Glaser style; also Capp critical reasoning and SHL deductive).
// variant = one section's id to drill only that section; default mixes all five.

const TITLE: Record<CrType, string> = { inference: 'Inference', assumption: 'Recognising assumptions', deduction: 'Deduction', interpretation: 'Interpretation', evaluation: 'Evaluating arguments' }
export const crPool = (variant?: string) => CR_ITEMS.filter((i) => !CR_TYPES.includes(variant as CrType) || i.type === variant)

function CriticalReasoningGame(props: GameProps) {
  const [draw] = useState(() => deck(crPool(props.variant)))
  const { item, result, submit, next, seq } = useItemLoop(draw, props)
  const options = CR_OPTIONS[item.type]
  return (
    <AptLayout
      stimulus={
        <>
          <div className="apt__caption">{TITLE[item.type]}</div>
          <p>{item.stem}</p>
        </>
      }
      question={
        <>
          {item.claim}
          <span className="apt__rule">{CR_RULES[item.type]}</span>
        </>
      }
    >
      <Choices key={seq} options={options} answer={item.answer} result={result} onPick={(_, ok) => submit(ok, item.type)} />
      {result !== null && <Explain ok={result} text={<p>{`${options[item.answer]}. ${item.why}`}</p>} onNext={next} />}
    </AptLayout>
  )
}

/** Accuracy per section (0–1), so the weakest one shows. */
export const crDetails = (trials: Trial[]) =>
  Object.fromEntries(
    CR_TYPES.flatMap((t) => {
      const xs = trials.filter((x) => x.kind === t)
      return xs.length ? [[`${t}Acc`, Math.round((100 * xs.filter((x) => x.correct).length) / xs.length) / 100]] : []
    }),
  )

export const criticalReasoning: GameDef = {
  id: 'critical-reasoning',
  name: 'Critical thinking',
  skills: ['logical-reasoning', 'verbal-reasoning'],
  howTo: 'Inferences, assumptions, deductions, interpretations and arguments: judge each claim strictly from the passage.',
  duration: 600,
  targetRt: 40000,
  Component: CriticalReasoningGame satisfies ComponentType<GameProps>,
  details: crDetails,
}
