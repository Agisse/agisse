// Interview training without a posting: a static question bank per field, the interview modes, and delivery metrics
// computed from a transcript in the browser. No model call anywhere in this file.
import { FILLERS, type InterviewQuestion } from './interview'

export const FIELDS = {
  business: 'Business & finance',
  consulting: 'Consulting & strategy',
  tech: 'Tech & software',
  engineering: 'Engineering',
  law: 'Law',
  healthcare: 'Healthcare',
  public: 'Public sector & policy',
  research: 'Research & science',
} as const
export type FieldId = keyof typeof FIELDS

const q = (theme: InterviewQuestion['theme'], text: string, tip: string): InterviewQuestion => ({ text, theme, tip })

/** About 8 questions per field, original wording: motivation first, then competency, strengths and one situational. */
export const FIELD_QUESTIONS: Record<FieldId, InterviewQuestion[]> = {
  business: [
    q('motivation', 'Why this firm, and why a finance role rather than another business path?', 'Name something specific about the firm and link it to a choice you already made.'),
    q('motivation', 'Walk me through your CV and the choices that brought you here.', 'Two minutes, in order, with the reason behind each step.'),
    q('behavioural', 'Tell me about a time you found a mistake in numbers someone else relied on.', 'Say how you checked it and how you raised it without blame.'),
    q('behavioural', 'Describe a time you delivered to a hard deadline with incomplete information.', 'Show what you assumed, how you flagged it, and what you delivered.'),
    q('behavioural', 'Give an example of persuading someone more senior to change their view.', 'The evidence you used matters more than the outcome.'),
    q('situational', 'A client wants an answer by tonight that needs two days of work. What do you do?', 'Offer what you can stand behind tonight and agree the rest.'),
    q('knowledge', 'Pick a company you follow. Would you invest in it today, and why?', 'One thesis, two numbers, one risk.'),
    q('behavioural', 'What is your greatest strength, and when did it make a real difference?', 'Prove the strength with one short story.'),
  ],
  consulting: [
    q('motivation', 'Why consulting, and why now rather than after a few years in industry?', 'Tie it to how you like to learn and the problems you want to see.'),
    q('behavioural', 'Tell me about a time you led a group without formal authority.', 'Show how you got people to follow: structure, listening, credit.'),
    q('behavioural', 'Describe a messy problem you broke into parts to solve.', 'Name the parts out loud; that is the skill being tested.'),
    q('behavioural', 'Tell me about a time you won over someone who disagreed with you.', 'Start from their concern, not your argument.'),
    q('behavioural', 'Describe something you were responsible for that failed. What did you change?', 'Own it in one sentence, spend the rest on what changed.'),
    q('situational', 'On day two of a project, the client lead says your first findings are wrong. How do you respond?', 'Ask what they see, test it with data, agree next steps.'),
    q('knowledge', 'Which industry would you like to work with, and what is its biggest challenge right now?', 'One industry, one challenge, one idea.'),
    q('behavioural', 'What would teammates say is the most frustrating thing about working with you?', 'A real flaw, and what you do about it.'),
  ],
  tech: [
    q('motivation', 'What draws you to this product or team?', 'Mention something you used or read, not just the brand.'),
    q('behavioural', 'Tell me about a technical project you are proud of and your part in it.', 'Separate what you built from what the team built.'),
    q('behavioural', 'Describe a bug that took a long time to find. How did you track it down?', 'Walk through your method: reproduce, narrow, fix, prevent.'),
    q('behavioural', 'Tell me about a time you disagreed with a technical decision.', 'Show you argued with data and committed once it was decided.'),
    q('behavioural', 'Describe a time you had to learn a new tool or language fast.', 'How you learned beats what you learned.'),
    q('situational', 'Your release is due tomorrow and you find a security issue. What do you do?', 'Raise it early, size the risk, propose options.'),
    q('knowledge', 'How would you explain an API to a non-technical colleague?', 'Use one everyday analogy and check it lands.'),
    q('behavioural', 'What feedback changed the way you work?', 'Quote the feedback, then show the change.'),
  ],
  engineering: [
    q('motivation', 'Why this company, and which part of its engineering work interests you most?', 'Name a product, plant or project by name.'),
    q('behavioural', 'Talk me through a design or lab project from requirement to result.', 'Requirement, constraint, choice, test, result.'),
    q('behavioural', 'Tell me about a time a test or prototype did not behave as expected.', 'Your diagnosis is the story, not the failure.'),
    q('behavioural', 'Describe a time you balanced safety, cost and time in a decision.', 'Say which you would never trade away.'),
    q('behavioural', 'Give an example of working with people from another discipline.', 'Show how you translated between the two.'),
    q('situational', 'On site, a contractor says a step in the method statement is being skipped to save time. What do you do?', 'Safety first, then escalate through the right person.'),
    q('knowledge', 'Pick a product you use every day. How would you make it cheaper to manufacture?', 'Materials, parts count, process, tolerances.'),
    q('behavioural', 'What is a weakness you are working on, and how?', 'Specific weakness, specific habit.'),
  ],
  law: [
    q('motivation', 'Why commercial law, and why this firm in particular?', 'Point to its practice areas or a deal, not its ranking.'),
    q('behavioural', 'Tell me about a time you had to absorb a large amount of detail quickly.', 'Show your method for sorting what matters.'),
    q('behavioural', 'Describe a time you spotted something others had missed.', 'Why you looked where others did not.'),
    q('behavioural', 'Tell me about a time you dealt with a difficult client, customer or member of the public.', 'Calm, listen, solve, follow up.'),
    q('behavioural', 'Give an example of when your attention to detail really mattered.', 'Name the detail and its consequence.'),
    q('situational', 'A partner asks you to finish a document tonight and a senior associate has given you a conflicting urgent task. What do you do?', 'Make the conflict visible and let them prioritise.'),
    q('knowledge', 'Tell me about a recent deal or ruling you followed and why it matters to clients.', 'The commercial impact, not just the facts.'),
    q('behavioural', 'What would you bring to a trainee intake that others might not?', 'One distinctive thing, backed by evidence.'),
  ],
  healthcare: [
    q('motivation', 'Why this role in healthcare, and why with us?', 'Patients first, then what you know about the organisation.'),
    q('behavioural', 'Tell me about a time you supported someone who was distressed.', 'What you noticed, what you said, what you did next.'),
    q('behavioural', 'Describe a time you followed a procedure you thought could be improved.', 'Follow it first, then suggest the change properly.'),
    q('behavioural', 'Give an example of working in a team under pressure.', 'Your role in the team, not just the team.'),
    q('behavioural', 'Tell me about a mistake you made and what you did next.', 'Report, fix, learn: in that order.'),
    q('situational', 'During a busy shift you see a colleague skip a hygiene step. What do you do?', 'Patient safety, a respectful word, escalate if it repeats.'),
    q('knowledge', 'What is one challenge facing the health system here, and how does it affect this role?', 'One challenge, linked to the job.'),
    q('behavioural', 'How do you look after your own wellbeing in a demanding job?', 'Concrete habits, not slogans.'),
  ],
  public: [
    q('motivation', 'Why public service, and why this organisation?', 'Link a cause you care about to its mandate.'),
    q('behavioural', 'Tell me about a time you explained something complex to a non-specialist audience.', 'Say how you checked they understood.'),
    q('behavioural', 'Describe a time you had to stay impartial or set aside your own view.', 'Process and fairness over opinion.'),
    q('behavioural', 'Give an example of working with partners who had different priorities.', 'Find the shared goal first.'),
    q('behavioural', 'Tell me about a time you used evidence to change a decision.', 'Source, analysis, how you presented it.'),
    q('situational', "A minister's office wants a briefing in two hours and the data is not yet verified. What do you do?", 'Deliver on time and label what is unverified.'),
    q('knowledge', 'Which policy area in the news interests you, and what would you do differently?', 'Balanced view, one proposal, one trade-off.'),
    q('behavioural', 'Tell me about a time you acted with integrity when it was inconvenient.', 'The cost to you makes the story credible.'),
  ],
  research: [
    q('motivation', 'Why this group or lab, and what question would you like to work on?', 'Cite a paper or project of theirs.'),
    q('behavioural', 'Talk me through your thesis or a research project: question, method, result.', 'Keep it to what a non-specialist panel can follow.'),
    q('behavioural', 'Describe a time an experiment or analysis did not work. What did you learn?', 'What you changed in your method afterwards.'),
    q('behavioural', 'Tell me about a time you received critical feedback on your work.', 'Show you sought it out and used it.'),
    q('behavioural', 'Give an example of managing a long project with little supervision.', 'Milestones, check-ins, how you kept going.'),
    q('situational', 'You find an error in a dataset after a paper has been submitted. What do you do?', 'Tell your supervisor at once and assess the impact.'),
    q('knowledge', 'How would you explain your research to a 15-year-old?', 'One picture, no jargon.'),
    q('motivation', 'Where do you see yourself in five years: academia, industry, or both?', 'Honest and linked to this role.'),
  ],
}

/** A best guess at the seeker's field from free text (target industries, degree, headline). */
export function fieldFor(text: string): FieldId {
  const t = text.toLowerCase()
  const rules: [FieldId, RegExp][] = [
    ['consulting', /consult|strategy/],
    ['law', /\blaw\b|legal|juris|solicitor|lawyer|rechten|droit/],
    ['healthcare', /health|medic|nurs|pharma|clinic|hospital|care\b/],
    ['public', /public|policy|government|politic|civil service|ngo|european (commission|union)/],
    ['research', /research|phd|science|biolog|chemi|physic|academ|lab\b/],
    ['engineering', /engineer|mechanic|civil|electrical|aerospace|energy|manufactur|automotive/],
    ['tech', /software|tech|computer|data|developer|it\b|ai\b|product/],
    ['business', /financ|bank|account|business|econom|market|audit|invest/],
  ]
  // Most matching words wins ("Business Engineering (Finance)" is business, not engineering); ties go to the earlier rule.
  let best: FieldId = 'business'
  let most = 0
  for (const [id, re] of rules) {
    const n = t.match(new RegExp(re.source, 'g'))?.length ?? 0
    if (n > most) [best, most] = [id, n]
  }
  return best
}

// ---- Modes ----

export const MODES = ['one-way', 'live', 'in-person', 'phone'] as const
export type Mode = (typeof MODES)[number] | 'presentation'
export type MockFormat = { prepSec: number; answerSec: number; retakes: number; questions: number }

export const MODE_INFO: Record<Mode, { label: string; hint: string; camera: boolean; tips: string[] }> = {
  'one-way': {
    label: 'One-way video',
    hint: 'Recorded answers to a screen, HireVue-style: thinking time, a countdown, sometimes a retake.',
    camera: true,
    tips: ['Look at the camera lens, not your own face.', 'Use the thinking time to pick a story and its result.', 'Light in front of you, plain wall behind.'],
  },
  live: {
    label: 'Live video',
    hint: 'A real interviewer on Teams or Zoom: no thinking time, about two minutes per answer, follow-up questions.',
    camera: true,
    tips: ['Pause for two seconds before answering; it reads as thoughtful.', 'Keep answers near two minutes, then stop and let them probe.', 'Close other tabs and test the link 10 minutes early.'],
  },
  'in-person': {
    label: 'In person',
    hint: 'Across a table, often a panel: conversational, with follow-ups. Practise standing up, camera optional.',
    camera: true,
    tips: ['Stand up and deliver out loud: your voice changes when you stand.', 'Speak to the whole panel, finish on whoever asked.', 'Bring a notepad and a pen; jotting the question down is fine.'],
  },
  phone: {
    label: 'Phone screen',
    hint: 'Audio only, often a recruiter: shorter answers, energy carried by your voice alone.',
    camera: false,
    tips: ['Smile while you talk; it is audible.', 'Keep your CV and the posting open in front of you.', 'Aim for 60 to 90 seconds per answer.'],
  },
  presentation: {
    label: 'Presentation',
    hint: 'Prepare a short talk on a case or topic, then deliver it to the clock.',
    camera: true,
    tips: ['Open with your recommendation, then three reasons.', 'Leave a minute for questions.', 'Finish early rather than late.'],
  },
}

/** The timings a mode imposes; one-way keeps the company's known format when there is one. */
export function formatFor(mode: Mode, company?: MockFormat | null): MockFormat {
  const base = company ?? { prepSec: 30, answerSec: 120, retakes: 1, questions: 5 }
  if (mode === 'one-way') return base
  if (mode === 'phone') return { prepSec: 0, answerSec: 90, retakes: 0, questions: base.questions }
  if (mode === 'presentation') return { prepSec: 20 * 60, answerSec: 10 * 60, retakes: 0, questions: 1 }
  return { prepSec: 0, answerSec: 120, retakes: 0, questions: base.questions }
}

export const PRESENTATION_TOPICS = [
  'Our client, a regional supermarket chain, is losing customers to discounters. Recommend one response.',
  'Should a mid-sized European city ban cars from its centre on weekends? Argue a position.',
  'Pitch one product or service our firm should launch for students, and how to test it cheaply.',
  'Explain a topic from your studies to a non-specialist audience, and why it matters to this employer.',
]

// ---- Delivery metrics (client-side) ----

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)

/** Three-word phrases said at least twice: the verbal crutches a listener notices. */
export function repeatedPhrases(text: string, max = 3): { phrase: string; count: number }[] {
  const w = words(text)
  const counts = new Map<string, number>()
  for (let i = 0; i + 3 <= w.length; i++) {
    const p = w.slice(i, i + 3).join(' ')
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([phrase, count]) => ({ phrase, count }))
}

/** Which posting keywords the answer actually said, whole words, case-insensitive. */
export function keywordsUsed(text: string, keywords: string[]) {
  const t = ` ${words(text).join(' ')} `
  const used: string[] = []
  const missing: string[] = []
  for (const k of keywords) (t.includes(` ${words(k).join(' ')} `) && words(k).length ? used : missing).push(k)
  return { used, missing }
}

/** Share of the allowed time used, 0–1. */
export const timeShare = (durationSec: number, allowedSec: number) => (allowedSec > 0 ? Math.min(1, Math.max(0, durationSec / allowedSec)) : 0)

export type DeliveryNote = { metric: string; value: string; tip: string; ok: boolean }

/** One short tip per delivery metric. */
export function deliveryNotes(input: { transcript: string; durationSec: number; allowedSec: number; wpm: number; fillers: number; keywords: string[]; presentation?: boolean }): DeliveryNote[] {
  const { transcript, durationSec, allowedSec, wpm, fillers, keywords, presentation } = input
  const notes: DeliveryNote[] = []
  notes.push({
    metric: 'Pace',
    value: `${wpm} words/min`,
    ok: wpm >= 110 && wpm <= 170,
    tip: wpm === 0 ? 'No words caught; check the transcript.' : wpm < 110 ? 'Slow: aim for 130 to 160 words a minute.' : wpm > 170 ? 'Fast: pause after each point.' : 'A comfortable pace.',
  })
  notes.push({ metric: 'Fillers', value: String(fillers), ok: fillers <= 3, tip: fillers > 3 ? `Replace ${FILLERS.slice(0, 3).join(', ')} with a short silence.` : 'Few fillers. Good.' })
  const reps = repeatedPhrases(transcript)
  notes.push({
    metric: 'Repeated phrases',
    value: reps.length ? reps.map((r) => `“${r.phrase}” ×${r.count}`).join(', ') : 'none',
    ok: reps.every((r) => r.count < 3),
    tip: reps.length ? 'Vary how you link points: first, then, as a result.' : 'Varied phrasing.',
  })
  const share = timeShare(durationSec, allowedSec)
  const pct = Math.round(share * 100)
  notes.push({
    metric: 'Time used',
    value: `${pct}% of ${Math.round(allowedSec / 60)} min`,
    ok: presentation ? share >= 0.6 && share <= 0.95 : share >= 0.4 && share <= 0.9,
    tip: presentation
      ? share > 0.95
        ? 'You ran to the limit; cut one point and leave time for questions.'
        : share < 0.6
          ? 'Well under time: develop each point with one example.'
          : 'Good pacing against the limit.'
      : share > 0.9
        ? 'Close to the limit: land the result sooner.'
        : share < 0.4
          ? 'Short: add the action you took and the result.'
          : 'A good length.',
  })
  if (keywords.length) {
    const { used, missing } = keywordsUsed(transcript, keywords)
    notes.push({
      metric: 'Posting keywords',
      value: `${used.length} of ${keywords.length}`,
      ok: used.length >= Math.min(3, keywords.length),
      tip: missing.length ? `Where true, mention: ${missing.slice(0, 4).join(', ')}.` : 'You used the posting’s language.',
    })
  }
  return notes
}
