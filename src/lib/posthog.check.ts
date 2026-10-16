// Run: npx tsx src/lib/posthog.check.ts
import { scrubUrl } from '../../shared/scrub-url.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(scrubUrl('https://agisse.xyz/reset-password?token=abc123'), 'https://agisse.xyz/reset-password', 'reset token')
eq(scrubUrl('https://agisse.xyz/?invite=Xy7-k2pQ&ref=ab12'), 'https://agisse.xyz/', 'invite and referral codes')
eq(scrubUrl('https://agisse.xyz/consent?client_id=c&sig=s#x'), 'https://agisse.xyz/consent', 'OAuth request and fragment')
eq(scrubUrl('https://agisse.xyz/jobs/3f2a9c1e-8b7d-4e6f-a1b2-c3d4e5f60718/cv'), 'https://agisse.xyz/jobs/:id/cv', 'job uuid')
eq(scrubUrl('/s/abcdefab-cdef-abcd-efab-cdefabcdefab'), '/s/:id', 'uuid without digits')
eq(scrubUrl('/scout/k2j4h5g6f7'), '/scout/:id', 'id with digits')
eq(scrubUrl('/prepare/interviews/banking'), '/prepare/interviews/banking', 'route words stay')
eq(scrubUrl('http://localhost:5173/jobs'), 'http://localhost:5173/jobs', 'host with port stays')
eq(scrubUrl('https://www.google.com/search?q=agisse+jobs'), 'https://www.google.com/search', 'referrer query')
console.log('posthog ok')
