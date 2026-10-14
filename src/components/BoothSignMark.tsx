import { cn } from '@/lib/utils'

/** The wordmark's mark, shared by the app's shell, the homepage and sign-in. */
export function BoothSignMark({ className }: { className?: string }) {
  return (
    <img className={cn('booth-sign__mark', className)} src="/favicon.svg" alt="" aria-hidden="true" />
  )
}
