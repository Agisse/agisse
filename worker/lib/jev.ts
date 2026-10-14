// Jev (typesafe/jev-1.13) through OpenRouter's Decisions API: typed questions in, probabilities out, no text.
// Agisse's split: the text LLM writes (rewrites, headlines, keyword lists), Jev judges (does the CV show this,
// does this version claim more than the CV, which version is strongest, how well does this posting fit).
// Input tokens only are billed, about $0.00002 for a CV-sized call; many questions share one call.
import { NoAiKey, type Meter } from './openrouter'

export const JEV_MODEL = 'typesafe/jev-1.13'

/** Yes/no: the answer is the probability of yes. */
export type NoulQ = { type: 'noul'; instructions: string; criteria: { true: string; false: string } }
/** One of a few keyed options. */
export type ChoiceQ = { type: 'choice'; instructions: string; criteria: Record<string, string> }
/** An ordered scale, worst first. */
export type ScoreQ = { type: 'score'; instructions: string; criteria: string[] }
export type JevQuestion = NoulQ | ChoiceQ | ScoreQ

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities?: Record<string, number> }

export const noul = (instructions: string, yes: string, no: string): NoulQ => ({ type: 'noul', instructions, criteria: { true: yes, false: no } })

/** One Decisions call; cost is booked on `meter` like any model call. Throws on any failure: callers decide how to degrade. */
export async function jevDecide<Q extends Record<string, JevQuestion>>(env: Env, state: Record<string, unknown>, questions: Q, meter?: Meter, signal?: AbortSignal): Promise<{ [K in keyof Q]: JevAnswer }> {
  if (!env.OPENROUTER_API_KEY) throw new NoAiKey()
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    signal: signal ?? AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state, questions, provider: { data_collection: 'deny' } }),
  })
  if (!res.ok) throw new Error(`Jev answered ${res.status}`)
  const { answers, usage } = (await res.json()) as { answers: { [K in keyof Q]: JevAnswer }; usage?: { input_tokens: number; output_tokens: number; cost: number } }
  if (meter) {
    meter.tokens += (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
    meter.costUsd += usage?.cost ?? 0
  }
  for (const k of Object.keys(questions)) if (!answers?.[k]) throw new Error(`Jev skipped question ${k}`)
  return answers
}

export const yes = (a: JevAnswer) => (a.type === 'noul' ? a.noul : 0)
export const scoreOf = (a: JevAnswer) => (a.type === 'score' ? a.score : 0)
