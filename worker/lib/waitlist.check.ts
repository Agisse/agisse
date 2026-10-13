// Run: npx tsx worker/lib/waitlist.check.ts
import { newReferralCode, readCookie } from './waitlist.ts'

const eq = (a: unknown, b: unknown, what: string) => { if (a !== b) throw new Error(`${what}: got ${String(a)}, want ${String(b)}`) }

const header = 'theme=dark; agisse_ref=k3m9xq2a;agisse_invite=AbC-12_x ; other=1'
eq(readCookie(header, 'agisse_ref'), 'k3m9xq2a', 'ref cookie')
eq(readCookie(header, 'agisse_invite'), 'AbC-12_x', 'invite cookie (trimmed)')
eq(readCookie(header, 'ref'), undefined, 'no partial-name match')
eq(readCookie(null, 'agisse_ref'), undefined, 'no header')
eq(readCookie('agisse_ref=', 'agisse_ref'), undefined, 'empty value')

const codes = new Set(Array.from({ length: 500 }, newReferralCode))
eq(codes.size, 500, 'codes unique')
for (const c of codes) if (!/^[a-hj-km-np-z2-9]{8}$/.test(c)) throw new Error(`bad code ${c}`)
console.log('waitlist ok')
