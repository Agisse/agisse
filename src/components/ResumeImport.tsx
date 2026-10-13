import { AiWorking } from '@/components/AiWorking'
import { useId, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, Check, FileText, Upload } from 'lucide-react'
import { RESUME_PDF_LIMIT, type Profile } from '../../shared/types'
import { api, isAbort } from '../lib/api'
import { useAbortable } from '../lib/hooks'
import { readPdfText } from '../lib/pdf-text'
import posthog from '../lib/posthog'
import { Link } from 'wouter'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Phase = { kind: 'idle' } | { kind: 'reading'; page: number; pages: number } | { kind: 'extracting' } | { kind: 'linkedin' } | { kind: 'done'; file: string; filled: number; pdf: boolean } | { kind: 'error'; message: string }

/** Pick a PDF résumé; the file is stored with the account, its text is read on this device and one model call maps it onto the badge. */
export function ResumeImport({ onExtracted, autosave }: { onExtracted: (p: Profile) => number; /** The caller saves at once (onboarding), so the copy does not ask for Save. */ autosave?: boolean }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [over, setOver] = useState(false)
  const [linkedin, setLinkedin] = useState('')
  const busy = phase.kind === 'reading' || phase.kind === 'extracting' || phase.kind === 'linkedin'
  const abort = useAbortable()

  const run = async (file: File | undefined) => {
    if (!file || busy) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPhase({ kind: 'error', message: 'Only PDF files are read. Export your résumé as PDF and try again.' })
      return
    }
    if (file.size > RESUME_PDF_LIMIT) {
      setPhase({ kind: 'error', message: 'That PDF is over 10 MB. Export a smaller version and try again.' })
      return
    }
    // Stored alongside the read; awaited below so a failed upload is reported, not swallowed.
    const upload = api.uploadResume(file)
    upload.catch(() => {})
    const signal = abort.start()
    try {
      setPhase({ kind: 'reading', page: 0, pages: 0 })
      const text = await readPdfText(file, (page, pages) => setPhase({ kind: 'reading', page, pages }))
      signal.throwIfAborted()
      if (text.length < 200) throw new Error('That PDF has almost no readable text. If it is a scan, export a text version and try again.')
      setPhase({ kind: 'extracting' })
      const [{ profile }] = await Promise.all([api.extractProfile(text, signal), upload])
      const filled = onExtracted(profile)
      posthog.capture('resume_imported', { fields_filled: filled })
      setPhase({ kind: 'done', file: file.name, filled, pdf: true })
    } catch (err) {
      setPhase(isAbort(err) ? { kind: 'idle' } : { kind: 'error', message: err instanceof Error ? err.message : 'Could not read that résumé' })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const fromLinkedin = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!linkedin.trim() || busy) return
    try {
      setPhase({ kind: 'linkedin' })
      const { profile } = await api.extractLinkedin(linkedin.trim(), abort.start())
      const filled = onExtracted(profile)
      posthog.capture('linkedin_imported', { fields_filled: filled })
      setPhase({ kind: 'done', file: 'your LinkedIn profile', filled, pdf: false })
    } catch (err) {
      setPhase(isAbort(err) ? { kind: 'idle' } : { kind: 'error', message: err instanceof Error ? err.message : 'Could not read that LinkedIn profile' })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void run(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center transition-colors duration-150 hover:border-primary/50 hover:bg-primary/5 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:flex-row sm:py-6 sm:text-left',
          over && 'border-primary bg-primary/5',
          busy && 'cursor-progress',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} id={id} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => void run(e.target.files?.[0])} />
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          {busy ? <FileText className="size-5 motion-safe:animate-pulse" /> : <Upload className="size-5" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <strong className="text-[0.9375rem] font-semibold text-foreground">{phase.kind === 'linkedin' ? 'Reading your LinkedIn profile' : busy ? 'Reading your résumé' : 'Fill this in from your résumé'}</strong>
          <span className="text-sm text-pretty text-muted-foreground" aria-live="polite">
            {phase.kind === 'reading' && (phase.pages ? `Reading page ${phase.page} of ${phase.pages}…` : 'Opening the PDF…')}
            {!busy && (autosave ? 'Drop a PDF or choose one. It is read on this device and kept with your account for tailored CVs.' : 'Drop a PDF or choose one. It is kept with your account for tailored CVs; fields save only when you press Save.')}
          </span>
        </span>
        {busy ? (
          <Button type="button" variant="ghost" className="h-10 px-4" onClick={(e) => { e.preventDefault(); abort.cancel() }}>
            Cancel
          </Button>
        ) : (
          <span className={cn(buttonVariants({ variant: 'outline' }), 'pointer-events-none h-10 px-4')} aria-hidden="true">
            Choose PDF
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-li`}>Or from LinkedIn</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={`${id}-li`}
            className="h-10 px-3 sm:flex-1"
            type="url"
            inputMode="url"
            placeholder="https://www.linkedin.com/in/your-name"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void fromLinkedin(e)}
            disabled={busy}
          />
          <Button type="button" variant="outline" className="h-10 px-4" disabled={busy || !linkedin.trim()} onClick={(e) => void fromLinkedin(e)}>
            {phase.kind === 'linkedin' ? 'Reading…' : 'Fill from LinkedIn'}
          </Button>
        </div>
      </div>
      {(phase.kind === 'extracting' || phase.kind === 'linkedin') && <AiWorking label="Picking out school, work, organizations, skills" />}

      {phase.kind === 'done' && (
        <p className="flex items-start gap-2 rounded-lg bg-(--green-tint) px-3 py-2.5 text-sm text-(--green-ink) [&_a]:underline [&_a]:underline-offset-4" role="status">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {phase.filled === 0 ? (
              <>Nothing new in <strong>{phase.file}</strong>; your profile already had it all.</>
            ) : (
              <>Filled {phase.filled} {phase.filled === 1 ? 'field' : 'fields'} from <strong>{phase.file}</strong>. {autosave ? 'Saved to your profile; you can edit it any time.' : 'Check them, then save.'}</>
            )}
            {phase.pdf && !autosave && <> <Link href="/prepare/cv">See your CV score</Link></>}
          </span>
        </p>
      )}
      {phase.kind === 'error' && (
        <p className="flex items-start gap-2 rounded-lg bg-(--red-tint) px-3 py-2.5 text-sm text-(--red)" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{phase.message}</span>
        </p>
      )}
    </div>
  )
}
