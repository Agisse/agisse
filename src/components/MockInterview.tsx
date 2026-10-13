// Interview rehearsal: one-way video (HireVue-style), live video, in person, phone screen and timed presentations.
// Prep and answer countdowns, retakes, transcript, delivery metrics and feedback with one follow-up question.
// The video never leaves the browser. The transcript comes from the browser's speech recognition, or, where there is
// none (Firefox), from one audio upload that is transcribed and discarded.
import { AskAssistant } from '@/components/AssistantChat'
import { useEffect, useRef, useState } from 'react'
import { Circle, Mic, Square, Video } from 'lucide-react'
import { AiWorking } from './AiWorking'
import { FeedbackView } from './SelectionProcess'
import { ErrorNote } from '../features/assessments/components/AssessmentPrep'
import { fillerCount, type AnswerDelivery, type AnswerFeedback, type InterviewQuestion } from '../../shared/interview'
import { FIELDS, FIELD_QUESTIONS, MODE_INFO, deliveryNotes, formatFor, type FieldId, type MockFormat, type Mode } from '../../shared/interview-kit'
import { bestStoryFor } from '../../shared/stories'
import type { Job } from '../../shared/types'
import { api, isAbort } from '../lib/api'
import { useAbortable, useResource } from '../lib/hooks'
import posthog from '../lib/posthog'
import '../features/interviews/interviews.css'

type Phase = 'ready' | 'prep' | 'answer' | 'review'

type SpeechRec = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null }
const SpeechRecognition = (globalThis as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (globalThis as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const THEME_LABEL: Record<InterviewQuestion['theme'], string> = { motivation: 'Motivation', behavioural: 'Past experience', situational: 'Situation', knowledge: 'Role knowledge' }
const noop = async () => {}

/** Delivery stats from a transcript and timings. Pure, so it is checkable. */
export function deliveryOf(transcript: string, durationSec: number, retakes: number, startDelaySec: number): AnswerDelivery {
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0
  return { durationSec: Math.round(durationSec), words, wpm: durationSec > 0 ? Math.round((words / durationSec) * 60) : 0, fillers: fillerCount(transcript), retakes, startDelaySec: Math.round(startDelaySec) }
}

const blobBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

/** Motivation first, then four more from the field's bank in a random order. */
const fieldSet = (field: FieldId, n: number) => {
  const [first, ...rest] = FIELD_QUESTIONS[field]
  return [first!, ...rest.sort(() => Math.random() - 0.5)].slice(0, n)
}

type Props = {
  /** Questions and format from this posting; without one, the field's question bank. */
  job?: Job | null
  field?: FieldId
  mode?: Mode
  /** Presentation mode: the topic and talk length. */
  topic?: string
  talkSec?: number
  onSpend?: () => Promise<void>
  /** Leave the interview (End interview, Back to Interviews). Without it, ending returns to this rehearsal's start screen. */
  onExit?: () => void
}

export function MockInterview({ job = null, field = 'business', mode = 'one-way', topic, talkSec, onSpend = noop, onExit }: Props) {
  const set = useResource(() => (job && mode !== 'presentation' ? api.interviewQuestions(job.id) : Promise.resolve(null)), [job?.id, mode])
  const [fieldQuestions] = useState(() => fieldSet(field, 5))
  const [started, setStarted] = useState(false)
  const [camera, setCamera] = useState(MODE_INFO[mode].camera)
  if (set.error) return <ErrorNote text={set.error} />
  if (job && mode !== 'presentation' && !set.data) return set.loading ? <AiWorking label="Preparing your interview questions" /> : null

  const presentation = mode === 'presentation'
  const base = formatFor(mode, set.data?.format)
  const format: MockFormat = presentation && talkSec ? { ...base, answerSec: talkSec } : base
  const questions: InterviewQuestion[] = presentation
    ? [{ text: topic ?? 'Present a topic of your choice.', theme: 'situational', tip: 'Open with your answer, give three reasons, close with a next step.' }]
    : (set.data?.questions ?? fieldQuestions).slice(0, format.questions)
  const info = MODE_INFO[mode]

  if (!started)
    return (
      <div className="mock">
        <p className="prep__lede">
          {presentation
            ? `${clock(format.prepSec)} to prepare, then up to ${clock(format.answerSec)} to present.`
            : `${questions.length} questions, ${format.prepSec ? `${format.prepSec} s to think, ` : 'no thinking time, '}up to ${clock(format.answerSec)} each${format.retakes ? `, ${format.retakes} retake${format.retakes > 1 ? 's' : ''}` : ''}${job && mode === 'one-way' ? `: the format ${job.company} is reported to use` : ''}.`}
        </p>
        <ul className="mock__tips">
          {info.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {mode !== 'phone' && (
          <label className="field--check">
            <input type="checkbox" checked={!camera} onChange={(e) => setCamera(!e.target.checked)} /> Audio only, no camera
          </label>
        )}
        <p className="prep__meta">Your camera and microphone stay in this browser; nothing is uploaded.{SpeechRecognition ? '' : ' Your browser has no speech recognition, so each answer’s audio is sent once to be transcribed, then discarded.'}</p>
        <button type="button" className="btn btn--primary" onClick={() => setStarted(true)}>
          {camera ? <Video aria-hidden="true" /> : <Mic aria-hidden="true" />} {presentation ? 'Start presentation' : 'Start interview'}
        </button>
      </div>
    )
  return <Session job={job} field={field} mode={mode} camera={camera && mode !== 'phone'} questions={questions} format={format} onSpend={onSpend} onExit={onExit ?? (() => setStarted(false))} onAgain={() => setStarted(false)} canLeave={!!onExit} />
}

function Session({ job, field, mode, camera, questions, format, onSpend, onExit, onAgain, canLeave }: { job: Job | null; field: FieldId; mode: Mode; camera: boolean; questions: InterviewQuestion[]; format: MockFormat; onSpend: () => Promise<void>; onExit: () => void; onAgain: () => void; canLeave: boolean }) {
  const [index, setIndex] = useState(0)
  const [follow, setFollow] = useState<InterviewQuestion | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [left, setLeft] = useState(0)
  const [retakesUsed, setRetakesUsed] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'transcribing' | 'reviewing' | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [reviewed, setReviewed] = useState(0)
  const [ending, setEnding] = useState(false)
  const stories = useResource(() => api.stories().then((r) => r.stories), [])
  const stream = useRef<MediaStream | null>(null)
  const preview = useRef<HTMLVideoElement | null>(null)
  const rec = useRef<{ media: MediaRecorder; audio: MediaRecorder | null; speech: SpeechRec | null; startedAt: number; firstWordAt: number | null } | null>(null)
  const timing = useRef({ durationSec: 0, startDelaySec: 0 })
  const abort = useAbortable()
  const q = follow ?? questions[index]!
  const presentation = mode === 'presentation'
  const prepSec = follow ? 0 : format.prepSec

  // Camera (unless audio only) and microphone for the whole session.
  useEffect(() => {
    let cancelled = false
    const audioOnly = () => navigator.mediaDevices.getUserMedia({ audio: true })
    ;(camera ? navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(audioOnly) : audioOnly())
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (preview.current) preview.current.srcObject = s
      })
      .catch(() => setError('Cannot reach your microphone. Allow microphone access in your browser’s address bar and reload, or type your answer instead.'))
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [camera])
  useEffect(() => () => void (mediaUrl && URL.revokeObjectURL(mediaUrl)), [mediaUrl])

  // One countdown drives both timed phases.
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'answer') return
    const until = Date.now() + (phase === 'prep' ? prepSec : format.answerSec) * 1000
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setLeft(l)
      if (l !== 0) return
      if (phase === 'prep') record()
      else stop()
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const reset = () => {
    setError(null)
    setFeedback(null)
    setTranscript('')
  }
  const beginPrep = () => {
    reset()
    if (prepSec) setPhase('prep')
    else record()
  }

  function record() {
    const s = stream.current
    if (!s) return setError('The microphone is not ready yet.')
    const chunks: Blob[] = []
    const audioChunks: Blob[] = []
    const media = new MediaRecorder(s)
    media.ondataavailable = (e) => chunks.push(e.data)
    media.onstop = () => setMediaUrl(URL.createObjectURL(new Blob(chunks, { type: media.mimeType })))
    let audio: MediaRecorder | null = null
    let speech: SpeechRec | null = null
    const state: NonNullable<typeof rec.current> = { media, audio, speech, startedAt: Date.now(), firstWordAt: null }
    if (SpeechRecognition) {
      speech = new SpeechRecognition()
      speech.continuous = true
      speech.interimResults = false
      speech.lang = document.documentElement.lang || 'en-GB'
      speech.onresult = (e) => {
        state.firstWordAt ??= Date.now()
        let add = ''
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) add += `${e.results[i]![0].transcript} `
        setTranscript((t) => (t + add).trimStart())
      }
      speech.start()
    } else {
      audio = new MediaRecorder(new MediaStream(s.getAudioTracks()))
      audio.ondataavailable = (e) => audioChunks.push(e.data)
      audio.onstop = () => void transcribeAudio(new Blob(audioChunks, { type: audio!.mimeType }))
      audio.start()
    }
    state.audio = audio
    state.speech = speech
    rec.current = state
    media.start()
    setPhase('answer')
  }

  function stop() {
    const r = rec.current
    if (!r) return
    rec.current = null
    timing.current = { durationSec: (Date.now() - r.startedAt) / 1000, startDelaySec: r.firstWordAt ? (r.firstWordAt - r.startedAt) / 1000 : 0 }
    r.media.stop()
    r.audio?.stop()
    r.speech?.stop()
    setPhase('review')
  }

  async function transcribeAudio(blob: Blob) {
    setBusy('transcribing')
    try {
      const type = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm'
      const { text } = await api.transcribe(await blobBase64(blob), type)
      setTranscript(text)
    } catch (e) {
      setError(e instanceof Error ? `${e.message}. Type what you said below instead.` : 'Could not transcribe; type what you said below instead.')
    } finally {
      setBusy(null)
      void onSpend()
    }
  }

  const retake = () => {
    setRetakesUsed((n) => n + 1)
    beginPrep()
  }

  const review = async () => {
    setBusy('reviewing')
    setError(null)
    try {
      const delivery = deliveryOf(transcript, timing.current.durationSec, retakesUsed, timing.current.startDelaySec)
      const { feedback: f } = job ? await api.answerFeedback(job.id, q.text, transcript, abort.start(), { delivery }) : await api.fieldAnswerFeedback(FIELDS[field], q.text, transcript, abort.start())
      posthog.capture('mock_answer_reviewed', { theme: q.theme, wpm: delivery.wpm, retakes: retakesUsed, mode, follow_up: !!follow, posting: !!job })
      setFeedback(f)
      setReviewed((n) => n + 1)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not review the answer')
    } finally {
      setBusy(null)
      void onSpend()
    }
  }

  const answerFollowUp = () => {
    setFollow({ text: feedback!.followUp!, theme: q.theme, tip: 'Answer it directly in a sentence, then add one concrete detail.' })
    setMediaUrl(null)
    reset()
    record()
  }

  // No microphone, or you would rather write: straight to the transcript box.
  const typeInstead = () => {
    reset()
    timing.current = { durationSec: 0, startDelaySec: 0 }
    setPhase('review')
  }
  const endNow = () => {
    rec.current?.speech?.stop()
    rec.current?.audio?.stop()
    rec.current = null
    onExit()
  }

  const next = () => {
    setIndex(index + 1)
    setFollow(null)
    setRetakesUsed(0)
    setMediaUrl(null)
    setPhase('ready')
    reset()
  }

  const d = phase === 'review' ? deliveryOf(transcript, timing.current.durationSec, retakesUsed, timing.current.startDelaySec) : null
  const notes = d && d.durationSec > 0 ? deliveryNotes({ transcript, durationSec: d.durationSec, allowedSec: format.answerSec, wpm: d.wpm, fillers: d.fillers, keywords: job?.evaluation?.keywords ?? [], presentation }) : []
  const last = index + 1 >= questions.length
  const story = feedback && stories.data ? bestStoryFor(q.text, stories.data) : null
  const count = `Question ${index + 1} of ${questions.length}`
  const label = presentation ? 'Presentation' : follow ? `Follow-up · ${count}` : count
  const more = !!feedback?.followUp && !follow
  const done = (feedback || presentation) && last && !follow && !more

  return (
    <section className="mock" aria-label={`${MODE_INFO[mode].label} practice, ${label}`}>
      <div className="practice__bar">
        <span className="label">
          {label} <span className="label--muted">· {follow ? 'Probing' : presentation ? MODE_INFO[mode].label : THEME_LABEL[q.theme]}</span>
        </span>
        {/* The state is announced once when it changes; the ticking clock below is not live. */}
        <span className="label label--muted" role="status">
          {phase === 'answer' ? 'Recording…' : phase === 'prep' ? 'Thinking time' : ''}
        </span>
        {(phase === 'prep' || phase === 'answer') && (
          <span className="practice__clock tnum" role="timer" aria-live="off" aria-label={`${left} seconds left`}>
            {phase === 'answer' && <Circle className="mock__rec" aria-hidden="true" />} {clock(left)}
          </span>
        )}
      </div>
      <p className="mock__question">{q.text}</p>
      {phase === 'ready' && prepSec > 0 && <p className="prep__meta">You get {prepSec >= 60 ? clock(prepSec) : `${prepSec} s`} to think, then recording starts.</p>}
      {camera && <video ref={preview} className="mock__video" autoPlay muted playsInline hidden={phase === 'review'} aria-label="Camera preview" />}
      {phase === 'review' && mediaUrl && (camera ? <video className="mock__video" src={mediaUrl} controls playsInline aria-label="Your recorded answer" /> : <audio src={mediaUrl} controls aria-label="Your recorded answer" />)}
      {error && <ErrorNote text={error} />}

      {phase === 'ready' && (
        <div className="posting__actions">
          <button type="button" className="btn btn--primary" onClick={beginPrep}>
            {camera ? <Video aria-hidden="true" /> : <Mic aria-hidden="true" />} {prepSec ? 'Start thinking time' : presentation ? 'Start presenting' : 'Record answer'}
          </button>
          {!presentation && (
            <button type="button" className="btn btn--quiet" onClick={typeInstead}>
              Type your answer instead
            </button>
          )}
        </div>
      )}
      {phase === 'prep' && (
        <button type="button" className="btn" onClick={record}>
          {presentation ? 'Start presenting' : 'Record answer'}
        </button>
      )}
      {phase === 'answer' && (
        <button type="button" className="btn btn--primary" onClick={stop}>
          <Square aria-hidden="true" /> Stop
        </button>
      )}
      {phase === 'review' && (
        <>
          {busy === 'transcribing' && <AiWorking label="Transcribing" />}
          <label className="field">
            <span className="label">Transcript (fix any mishearing)</span>
            <textarea className="field__input" rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          </label>
          {notes.length > 0 && (
            <dl className="mock__delivery tnum">
              {notes.map((n) => (
                <div key={n.metric}>
                  <dt>{n.metric}</dt>
                  <dd>
                    <span className={n.ok ? undefined : 'mock__flag'}>{n.value}</span> <span className="prep__meta">{n.tip}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="posting__actions">
            {!feedback && !presentation && (
              <button type="button" className="btn btn--primary" onClick={() => void review()} disabled={!!busy || transcript.trim().length < 20} aria-busy={busy === 'reviewing'}>
                Get feedback
              </button>
            )}
            {feedback?.followUp && !follow && (
              <button type="button" className="btn" onClick={answerFollowUp} disabled={!!busy}>
                Answer the follow-up
              </button>
            )}
            {!follow && retakesUsed < format.retakes && (
              <button type="button" className="btn" onClick={retake} disabled={!!busy}>
                Try again ({format.retakes - retakesUsed} left)
              </button>
            )}
            {!last && (
              <button type="button" className={feedback && !more ? 'btn btn--primary' : 'btn'} onClick={next} disabled={!!busy}>
                Next question
              </button>
            )}
          </div>
          {busy === 'reviewing' && <AiWorking label="Reviewing your answer" onCancel={abort.cancel} />}
          {feedback && <FeedbackView feedback={feedback} />}
          {story && (
            <p className="prep__meta">
              From your story bank, <strong>{story.title}</strong> fits this question.
            </p>
          )}
          {feedback && <AskAssistant question={`Help me improve my answer to the interview question “${q.text}”, using the feedback I just got.`}>Improve this answer with the assistant</AskAssistant>}
          <p className="prep__meta">Tip: {q.tip}</p>
          {done && (
            <div className="mock__done" role="status">
              <p className="prep__lede">
                {presentation ? 'Presentation done.' : `Interview done. ${reviewed} ${reviewed === 1 ? 'answer' : 'answers'} reviewed.`}
                {job && !presentation ? ' Your answers and feedback are saved under Your progress on Prepare.' : ''}
              </p>
              <div className="posting__actions">
                <button type="button" className="btn btn--primary" onClick={onAgain}>
                  Practise again
                </button>
                {canLeave && (
                  <button type="button" className="btn" onClick={onExit}>
                    Back to Interviews
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {!done &&
        (ending ? (
          <div className="mock__end" role="group" aria-label="End interview">
            <span className="prep__meta">End this interview? Your recording is not kept.</span>
            <button type="button" className="btn" onClick={endNow}>
              End interview
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setEnding(false)}>
              Keep going
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--quiet mock__exit" onClick={() => setEnding(true)}>
            End interview
          </button>
        ))}
    </section>
  )
}
