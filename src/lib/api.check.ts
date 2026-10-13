// Run: npx tsx src/lib/api.check.ts
import { isAbort } from './api.ts'

// A cancelled fetch rejects with the DOMException that isAbort recognises; anything else is a real error.
const ac = new AbortController()
ac.abort()
const err = await fetch('http://127.0.0.1:1/never', { signal: ac.signal }).then(() => null, (e: unknown) => e)
if (!isAbort(err)) throw new Error(`aborted fetch not detected: ${String(err)}`)
if (isAbort(new Error('AbortError'))) throw new Error('plain Error mistaken for an abort')
console.log('api.check ok')
