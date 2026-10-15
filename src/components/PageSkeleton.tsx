import { Skeleton } from '@/components/ui/skeleton'

/** Today's header and first card, shaped like the real ones, while /api/me answers or a page's code loads. */
export function PageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pt-6 pb-8 md:px-10 md:pt-10 md:pb-16" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="flex flex-col gap-1 px-1">
        <Skeleton className="my-1 h-7 w-56 md:h-8" />
        <Skeleton className="my-1 h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </main>
  )
}
