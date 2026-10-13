import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
export type ErrType = 'typo' | 'number' | 'date' | 'name'
export type ProofDoc = { title: string; ref: [string, string][]; tokens: string[]; errors: { i: number; type: ErrType; was: string }[] }
export const DOC_MS = 60000
export const MAX_WRONG = 3

// Placeholders: {a} contact, {b} colleague, {co} company, {amt} amount, {qty} count, {date}, {ref} reference.
export const TEMPLATES: { title: string; text: string }[] = [
  { title: 'Payment reminder', text: 'Dear {a}, this is a reminder that invoice {ref} for {qty} printer cartridges remains unpaid. The total of {amt} was due on {date}. Our records show the order was approved by {b} at {co} and delivered to your main office without issue. If payment has already been sent, please ignore this message and accept our thanks. Otherwise, kindly arrange the transfer of {amt} within seven working days, quoting {ref} as the payment reference. For any questions, {a} may contact our accounts team directly.' },
  { title: 'Meeting notes', text: 'Summary of the supplier meeting held on {date} with {co}. Present were {a} from purchasing and {b} from finance. The supplier confirmed it can deliver {qty} units each month, starting immediately after contract signature. The proposed annual price is {amt}, which {b} considered acceptable provided the payment terms stay at thirty days. {a} will prepare the final contract under reference {ref} and circulate it to the team before Friday. The next meeting will review delivery performance and any outstanding quality complaints.' },
  { title: 'Expense claim', text: 'Hello {b}, please find attached the expense claim {ref} submitted by {a} for the client visit to {co} on {date}. The claim covers travel, two nights of accommodation and {qty} kilometres of mileage, for a total of {amt}. All receipts have been checked against company policy and nothing unusual was found. As the amount exceeds the standard limit, your approval is required before finance can process the refund. Once approved, {a} should receive the payment in the next salary run.' },
  { title: 'Delivery notice', text: 'Delivery notice {ref}. On {date} our warehouse dispatched {qty} boxes of office furniture to {co}. The shipment was signed for by {a}, who reported that two boxes showed minor damage to the outer packaging. The contents appear to be intact, but {a} has asked for written confirmation that replacements will be provided if any items prove faulty. The invoice value of the shipment is {amt}. Please contact {b} in logistics if the damaged boxes need to be collected.' },
  { title: 'Price change', text: 'To all account managers. From {date}, the standard service package for {co} will be priced at {amt} per year. This change follows the review completed by {b} last quarter, which showed that support requests had increased considerably. Existing contracts will keep their current terms until renewal. The client currently holds {qty} active licences under agreement {ref}. Please inform {a}, our main contact at {co}, before the end of the month and record the conversation in the customer system.' },
  { title: 'Job offer', text: 'Dear {a}, we are pleased to offer you the position of project coordinator at {co}, starting on {date}. Your annual salary will be {amt}, paid in twelve monthly instalments. You will report to {b}, who leads the operations department and will arrange your induction programme. You will join a team of {qty} specialists working across three sites. Please sign and return the enclosed contract, reference {ref}, within ten days. We look forward to welcoming you to the team.' },
  { title: 'Purchase order', text: 'Purchase order {ref} has been issued to {co} for {qty} ergonomic office chairs. The agreed price is {amt}, including delivery and installation. Delivery is scheduled for {date}, and the chairs should arrive at the reception entrance before noon. {a} will receive the goods and check every chair against the specification sheet. Any shortages or defects must be reported to {b} within two working days of delivery, otherwise the order will be treated as complete and accepted.' },
  { title: 'Incident report', text: 'Incident report {ref}. On {date} a water leak in the server room at {co} caused a short interruption to the internal network. The facilities manager, {a}, isolated the leak within twenty minutes and no equipment was permanently damaged. As a precaution, {qty} machines were shut down and inspected. The repair to the cooling pipe cost {amt}. {b} has recommended installing moisture sensors beneath the raised floor, and {a} will request three quotations from approved contractors.' },
  { title: 'Workshop invitation', text: 'Dear colleagues, registration is now open for the negotiation workshop run by {a} on {date}. The session is designed for staff who regularly deal with suppliers such as {co}. There are {qty} places available, and they will be allocated in the order requests are received. The cost of {amt} per participant will be charged to each department budget. To register, please email {b} with your name, team and cost centre, quoting course code {ref} in the subject line.' },
  { title: 'Refund confirmation', text: 'Dear {a}, we confirm that your refund request {ref} has been accepted. After inspection, our returns team agreed that the {qty} headsets delivered to {co} did not match the model ordered. A refund of {amt} will be credited to the original payment card within five working days of {date}. We apologise for the inconvenience caused. If the amount does not appear on your statement, please contact {b} in customer service, who handled your case from the beginning.' },
  { title: 'Budget memo', text: 'Memo to {b}. The marketing budget for next quarter has been set at {amt}, following the planning session on {date}. This figure includes the trade fair stand, {qty} printed brochures and the new campaign with {co}. {a} has asked that any spending above the agreed amount be approved in writing beforehand. Monthly reports should be submitted under cost code {ref} so that finance can monitor progress, compare actual spending with the plan and identify problems early.' },
  { title: 'Contract renewal', text: 'Dear {a}, the maintenance contract {ref} between your company and {co} expires on {date}. Under the renewal proposal, we would continue to service your {qty} lifts for an annual fee of {amt}. This represents no increase compared with the current year. Our engineer, {b}, will remain your regular technician and has already planned the next inspection visit. Please confirm whether you wish to renew so that the service can continue without any interruption.' },
  { title: 'Stock count', text: 'Stock count summary, reference {ref}. The quarterly stock count at the {co} warehouse was completed on {date} under the supervision of {a}. A total of {qty} pallets were counted, which matches the inventory system within an acceptable margin. The estimated value of the stock is {amt}. Two locations were recounted because of labelling problems, and {b} has agreed to replace the damaged labels before the next count. No further action is required at this stage.' },
  { title: 'Booking confirmation', text: 'Booking confirmation {ref}. We are delighted to confirm the conference room reservation for {co} on {date}. The room has been prepared for {qty} guests, with lunch and refreshments served at midday. The total charge of {amt} includes audiovisual equipment and a dedicated technician. Your event contact, {a}, will meet the organiser at reception. Any change to the number of guests must be communicated to {b} at least three days before the event.' },
  { title: 'Complaint response', text: 'Dear {a}, thank you for your letter regarding order {ref}. We are sorry that the delivery to {co} on {date} arrived later than promised. Our investigation found that {qty} parcels were held at the regional depot because of a scheduling error. As a gesture of goodwill, we have applied a credit of {amt} to your account. {b}, our customer relations manager, will contact you this week to make sure the problem does not happen again.' },
  { title: 'Travel plan', text: 'Travel plan for the visit to {co} on {date}, organised by {a}. The outbound flight departs early in the morning, and a taxi will collect the group from the airport. Accommodation has been booked for {qty} colleagues at a hotel near the client office. The estimated total cost of the trip is {amt}, which has been approved by {b}. Please keep all receipts and submit them under travel reference {ref} within one week of returning.' },
]

const NAMES = ['Dekker', 'Janssens', 'Okafor', 'Lindqvist', 'Moreau', 'Brennan', 'Castillo', 'Nakamura', 'Petrov', 'Haddad', 'Fischer', 'Romano', 'Kowalski', 'Mensah', 'Varga', 'Delgado']
const COMPANIES = ['Northwind', 'Halvorsen', 'Brightline', 'Corvel', 'Tidewater', 'Meridian', 'Aldren', 'Vantor', 'Kestrel', 'Oakfield']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LABELS: Record<string, string> = { a: 'Contact', b: 'Colleague', co: 'Company', amt: 'Amount', qty: 'Quantity', date: 'Date', ref: 'Reference' }
const KIND: Record<string, ErrType> = { a: 'name', b: 'name', co: 'name', amt: 'number', qty: 'number', ref: 'number', date: 'date' }
const VOWELS = 'aeiou'

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = <T,>(xs: T[], rand: Rand) => xs[Math.floor(rand() * xs.length)]!
const PH = /^(.*?)\{(\w+)\}(.*)$/
const WORD = /^([A-Za-z]{5,})([^A-Za-z]*)$/

/** One digit changed (never to a leading zero). */
export function changeDigit(s: string, rand: Rand) {
  const idx = [...s].flatMap((ch, i) => (/\d/.test(ch) ? [i] : []))
  const i = pick(idx, rand)
  const lead = i === idx[0]
  const d = pick([...'0123456789'].filter((x) => x !== s[i] && !(lead && x === '0')), rand)
  return s.slice(0, i) + d + s.slice(i + 1)
}
const typoSpots = (w: string) => [...Array(Math.max(0, w.length - 3)).keys()].map((k) => k + 1).filter((i) => w[i] !== w[i + 1])
/** Two neighbouring, different interior letters swapped (first and last letters stay). */
export function typo(w: string, rand: Rand) {
  const i = pick(typoSpots(w), rand)
  return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)
}
/** One vowel replaced by another. */
export function respell(name: string, rand: Rand) {
  const i = pick([...name].flatMap((ch, k) => (k > 0 && VOWELS.includes(ch) ? [k] : [])), rand)
  return name.slice(0, i) + pick([...VOWELS].filter((v) => v !== name[i]), rand) + name.slice(i + 1)
}

/** A filled-in document with 2 errors at level 1 up to 5 at level 10, mixing typos with facts that contradict the reference table. */
export function makeProofDoc(level: number, rand: Rand = Math.random, template = pick(TEMPLATES, rand)): ProofDoc {
  const [a, b] = shuffle(NAMES, rand)
  const day = int(2, 27, rand)
  const facts: Record<string, string> = {
    a: a!,
    b: b!,
    co: pick(COMPANIES, rand),
    amt: `€${int(1200, 48900, rand).toLocaleString('en-GB')}`,
    qty: String(int(6, 96, rand)),
    date: `${day} ${pick(MONTHS, rand)}`,
    ref: `${pick(['INV', 'PO', 'REF'], rand)}-${int(1000, 9999, rand)}`,
  }
  const words = template.text.split(' ')
  const keys = words.map((w) => w.match(PH)?.[2] ?? null)
  const tokens = words.map((w, i) => (keys[i] ? w.replace(`{${keys[i]}}`, facts[keys[i]!]!) : w))
  const used = [...new Set(keys.filter((k): k is string => !!k))]
  const ref = Object.keys(LABELS)
    .filter((k) => used.includes(k))
    .map((k): [string, string] => [LABELS[k]!, facts[k]!])

  const n = 2 + Math.floor((Math.min(10, Math.max(1, level)) - 1) / 3)
  const errors: ProofDoc['errors'] = []
  const free = (i: number) => !errors.some((e) => e.i === i)
  for (let tries = 0; errors.length < n && tries < 100; tries++) {
    const type = pick<ErrType>(['typo', 'typo', 'number', 'date', 'name'], rand)
    const spots = words.map((_, i) => i).filter((i) => free(i) && (type === 'typo' ? !keys[i] && typoSpots(words[i]!.match(WORD)?.[1] ?? '').length > 0 : keys[i] && KIND[keys[i]!] === type))
    if (!spots.length) continue
    const i = pick(spots, rand)
    const was = tokens[i]!
    const k = keys[i]
    if (type === 'typo') {
      const [, w, tail] = was.match(WORD)!
      tokens[i] = typo(w!, rand) + tail
    } else if (type === 'date') tokens[i] = was.replace(String(day), String(((day - 1 + pick([1, 2, 10, 27], rand)) % 28) + 1))
    else if (type === 'name') tokens[i] = was.replace(facts[k!]!, respell(facts[k!]!, rand))
    else tokens[i] = was.replace(facts[k!]!, changeDigit(facts[k!]!, rand))
    errors.push({ i, type, was })
  }
  return { title: template.title, ref, tokens, errors }
}

/** Trials in order: 'hit:<type>' (found), 'false' (wrong click), 'miss:<type>' (left when the document ended). */
export function proofDetails(trials: Trial[]) {
  const n = (f: (k: string) => boolean) => trials.filter((t) => t.kind && f(t.kind)).length
  const r = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : 0)
  const hits = n((k) => k.startsWith('hit:'))
  const misses = n((k) => k.startsWith('miss:'))
  const falses = n((k) => k === 'false')
  const rate = (types: string[]) => r(n((k) => types.some((x) => k === `hit:${x}`)), n((k) => types.some((x) => k === `hit:${x}` || k === `miss:${x}`)))
  return { hitRate: r(hits, hits + misses), precision: r(hits, hits + falses), typoHitRate: rate(['typo']), factHitRate: rate(['number', 'date', 'name']) }
}

function ProofItGame({ level, mode, feedback, onTrial, rounds, onDone, paused }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [doc, setDoc] = useState(() => makeProofDoc(level))
  const [found, setFound] = useState<number[]>([])
  const [wrong, setWrong] = useState<number[]>([])
  const [ended, setEnded] = useState<string | null>(null)
  const lastAt = useRef(performance.now())
  /** What is left of the document's clock; it stands still while the runner is paused. */
  const leftMs = useRef(DOC_MS)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  function end(why: string, f = found) {
    if (ended) return
    doc.errors.filter((e) => !f.includes(e.i)).forEach((e) => onTrial({ correct: false, rt: DOC_MS, level: itemLevel.current, kind: `miss:${e.type}` }))
    if (!r.count()) setEnded(why)
  }
  const endRef = useRef(end)
  useEffect(() => {
    endRef.current = end
  })
  useEffect(() => {
    if (ended) {
      const t = setTimeout(
        () => {
          itemLevel.current = levelRef.current
          setDoc(makeProofDoc(levelRef.current))
          setFound([])
          setWrong([])
          setEnded(null)
          leftMs.current = DOC_MS
          lastAt.current = performance.now()
        },
        feedback ? 3500 : 600,
      )
      return () => clearTimeout(t)
    }
    if (paused) return
    const from = performance.now()
    const t = setTimeout(() => endRef.current('Time is up'), leftMs.current)
    return () => {
      clearTimeout(t)
      leftMs.current -= performance.now() - from
    }
  }, [doc, ended, feedback, paused])

  function click(i: number) {
    if (ended || found.includes(i) || wrong.includes(i)) return
    const err = doc.errors.find((e) => e.i === i)
    const now = performance.now()
    onTrial({ correct: !!err, rt: now - lastAt.current, level: itemLevel.current, kind: err ? `hit:${err.type}` : 'false' })
    lastAt.current = now
    if (err) {
      const f = [...found, i]
      setFound(f)
      if (f.length === doc.errors.length) end('All errors found', f)
    } else {
      const w = [...wrong, i]
      setWrong(w)
      if (w.length >= MAX_WRONG) end('Three wrong clicks end the document')
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement as HTMLElement | null
      const i = Number(el?.dataset.tok ?? -1)
      const nextI = Math.min(doc.tokens.length - 1, Math.max(0, i + (e.key === 'ArrowLeft' ? -1 : 1)))
      document.querySelector<HTMLButtonElement>(`[data-tok="${nextI}"]`)?.focus()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const missed = ended ? doc.errors.filter((e) => !found.includes(e.i)) : []
  return (
    <div className="game aon-proof">
      <div aria-live="polite" className="game__prompt">
        Click every error: typos, and facts that differ from the table · {doc.errors.length - found.length} left · {MAX_WRONG - wrong.length} wrong clicks left
      </div>
      {!ended && <div key={doc.title + doc.tokens[0]} className="rsn-timer" style={{ '--timer-ms': `${DOC_MS}ms`, animationPlayState: paused ? 'paused' : 'running' } as CSSProperties} aria-hidden="true" />}
      <table className="aon-proof__ref">
        <tbody>
          {doc.ref.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td className="tnum">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <article className="aon-proof__doc">
        <h3>{doc.title}</h3>
        <p>
          {doc.tokens.map((t, i) => {
            const miss = ended && feedback && missed.some((e) => e.i === i)
            return (
              <span key={i}>
                <button type="button" data-tok={i} className="aon-word" data-state={found.includes(i) ? 'hit' : wrong.includes(i) ? 'false' : miss ? 'miss' : undefined} disabled={!!ended} onClick={() => click(i)}>
                  {t}
                </button>{' '}
              </span>
            )
          })}
        </p>
      </article>
      <div className={`game__feedback ${ended ? (missed.length ? 'game__feedback--bad' : 'game__feedback--ok') : ''}`} aria-live="polite">
        {ended && `${ended}.${feedback && missed.length ? ` Missed: ${missed.map((e) => `“${doc.tokens[e.i]}” (should be “${e.was}”)`).join(', ')}` : ''}`}
      </div>
      <div className="game__keys">Tab or ←/→ to move between words · Enter to mark</div>
    </div>
  )
}

export const proofIt: GameDef = {
  id: 'proof-it',
  name: 'Proof It',
  skills: ['attention', 'visual-scanning'],
  howTo: 'Click each typo and each name, number or date that differs from the reference table; three wrong clicks end the document.',
  duration: 300,
  targetRt: 6000,
  Component: ProofItGame satisfies ComponentType<GameProps>,
  details: proofDetails,
}
