// Transactional mail through Resend's REST API (no SDK: one fetch).
// Without RESEND_API_KEY (local dev) it logs instead of sending, so sign-up never fails on mail.

declare global {
  interface Env {
    RESEND_API_KEY?: string
  }
}

const FROM = 'Agisse <hello@agisse.xyz>'

export async function sendEmail(env: Env, to: string, subject: string, lines: string[], cta?: { label: string; url: string }) {
  if (!env.RESEND_API_KEY) return console.log('email (no RESEND_API_KEY):', to, subject)
  const text = [...lines, ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', '— Agisse · hello@agisse.xyz'].join('\n')
  const html = `<div style="font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:520px;margin:0 auto;padding:24px">
${lines.map((l) => `<p style="margin:0 0 14px">${escape(l)}</p>`).join('')}
${cta ? `<p style="margin:24px 0"><a href="${escape(cta.url)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">${escape(cta.label)}</a></p>` : ''}
<p style="margin:32px 0 0;color:#888;font-size:13px">Agisse · invite-only beta · <a href="mailto:hello@agisse.xyz" style="color:#888">hello@agisse.xyz</a></p></div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: 'hello@agisse.xyz', subject, text, html }),
  })
  // A lost email is not worth failing the request that triggered it; log for Sentry/observability.
  if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there'

export const mails = {
  waitlisted: (env: Env, to: { email: string; name: string }, origin: string, code: string, position: number) =>
    sendEmail(env, to.email, `You're #${position} on the Agisse waitlist`, [
      `Hi ${firstName(to.name)},`,
      `Agisse is an invite-only beta, getting better every day. You're #${position} in line, and you can already run one free search.`,
      'Every friend who joins with your link moves you up the list.',
    ], { label: 'Your invite link', url: `${origin}/?ref=${code}` }),
  approved: (env: Env, to: { email: string; name: string }, origin: string) =>
    sendEmail(env, to.email, "You're in: welcome to Agisse", [
      `Hi ${firstName(to.name)},`,
      'Your spot in the Agisse beta is open. Everything is unlocked: the job feed, tailored CVs, interview prep.',
      'You also have invites for friends. Find your link on the Today page.',
    ], { label: 'Open Agisse', url: origin }),
  friendJoined: (env: Env, to: { email: string; name: string }, friend: string, origin: string, approved: boolean) =>
    sendEmail(env, to.email, `${firstName(friend)} joined Agisse with your link`, [
      `Hi ${firstName(to.name)},`,
      approved ? `${friend} just joined with your invite and is straight in.` : `${friend} just joined with your link, which moves you up the waitlist.`,
    ], { label: 'Open Agisse', url: origin }),
  resetPassword: (env: Env, to: { email: string; name: string }, url: string) =>
    sendEmail(env, to.email, 'Reset your Agisse password', [
      `Hi ${firstName(to.name)},`,
      'Someone asked to reset the password for this account. If that was not you, ignore this email.',
    ], { label: 'Choose a new password', url }),
}
