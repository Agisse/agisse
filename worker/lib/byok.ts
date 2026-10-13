// Bring your own key: a seeker's own OpenRouter, OpenAI, Anthropic, Gemini or Mistral key pays for their text generation.
// The key is AES-GCM encrypted at rest (key derived from BETTER_AUTH_SECRET, user id as associated data, so a row
// copied to another user won't decrypt), checked against the provider before it is stored, and never sent back
// to the browser: the client only sees the provider, model and last four characters.
import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import type { Db } from '../db'
import * as schema from '../db/schema'
import type { AiProvider } from '../../shared/types'

export type UserKey = { provider: AiProvider; key: string; model: string }

/** Default model per provider; for OpenRouter empty means Agisse's own chain, a model id goes first in it. */
export const DEFAULT_MODEL: Record<AiProvider, string> = { openrouter: '', openai: 'gpt-5-mini', anthropic: 'claude-opus-5-5', gemini: 'gemini-3.8-flash', mistral: 'mistral-large-latest' }

/** OpenAI-compatible chat endpoints; Anthropic goes through its SDK, OpenRouter through Agisse's chain. */
export const COMPAT: Partial<Record<AiProvider, { base: string; maxTokens: 'max_completion_tokens' | 'max_tokens' }>> = {
  openai: { base: 'https://api.openai.com/v1', maxTokens: 'max_completion_tokens' },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', maxTokens: 'max_tokens' },
  mistral: { base: 'https://api.mistral.ai/v1', maxTokens: 'max_tokens' },
}

// Mistral keys carry no prefix.
const PREFIX: Record<AiProvider, string> = { openrouter: 'sk-or-', openai: 'sk-', anthropic: 'sk-ant-', gemini: 'AIza', mistral: '' }

/** Shape check before any network call: the right prefix, no whitespace, sane length. */
export function keyLooksValid(provider: AiProvider, key: string) {
  const otherProvider = provider === 'openai' && /^sk-(ant|or)-/.test(key)
  return key.startsWith(PREFIX[provider]) && !otherProvider && /^[\w-]{20,300}$/.test(key)
}

const enc = (s: string) => new TextEncoder().encode(s)
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function aesKey(secret: string) {
  const base = await crypto.subtle.importKey('raw', enc(secret), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: enc('agisse ai-key v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** "iv.ciphertext", both base64. */
export async function seal(secret: string, userId: string, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(userId) }, await aesKey(secret), enc(plain))
  return `${b64(iv)}.${b64(ct)}`
}

export async function open(secret: string, userId: string, sealed: string) {
  const [iv, ct] = sealed.split('.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc(userId) }, await aesKey(secret), unb64(ct))
  return new TextDecoder().decode(plain)
}

/** One cheap authenticated call; for OpenAI and Anthropic it also proves the model exists for this key. Returns an error message or null. */
export async function verifyKey(k: UserKey): Promise<string | null> {
  try {
    if (k.provider === 'anthropic') {
      await new Anthropic({ apiKey: k.key, maxRetries: 0, timeout: 10_000 }).models.retrieve(k.model)
      return null
    }
    const compat = COMPAT[k.provider]
    const url = compat ? `${compat.base}/models/${encodeURIComponent(k.model)}` : 'https://openrouter.ai/api/v1/key'
    const res = await fetch(url, { headers: { Authorization: `Bearer ${k.key}` }, signal: AbortSignal.timeout(10_000) })
    if (res.ok) return null
    return res.status === 401 || res.status === 403 ? 'The provider rejected this key.' : res.status === 404 ? 'This key cannot use that model.' : `The provider answered ${res.status}; try again.`
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return 'The provider rejected this key.'
    if (err instanceof Anthropic.NotFoundError) return 'This key cannot use that model.'
    return 'Could not reach the provider; try again.'
  }
}

/** Model ids the key can use, for the model picker; empty when the provider won't list them. */
export async function listKeyModels(k: UserKey): Promise<string[]> {
  try {
    if (k.provider === 'anthropic') {
      const page = await new Anthropic({ apiKey: k.key, maxRetries: 0, timeout: 10_000 }).models.list({ limit: 100 })
      return page.data.map((m) => m.id)
    }
    const url = k.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/models' : `${COMPAT[k.provider]!.base}/models`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${k.key}` }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const { data } = (await res.json()) as { data: Array<{ id: string }> }
    // Gemini prefixes ids with "models/"; embedding, speech and image models can't write JSON answers.
    return data.map((m) => m.id.replace(/^models\//, '')).filter((id) => !/embed|tts|whisper|dall-e|image|audio|realtime|moderation|transcribe|ocr/i.test(id)).sort()
  } catch {
    return []
  }
}

/** The user's key, decrypted; null when none is set or it no longer decrypts (e.g. the auth secret was rotated). */
export async function loadUserKey(db: Db, env: Env, userId: string): Promise<UserKey | null> {
  const row = await db.query.aiKey.findFirst({ where: eq(schema.aiKey.userId, userId) })
  if (!row) return null
  try {
    return { provider: row.provider, key: await open(env.BETTER_AUTH_SECRET, userId, row.sealed), model: row.model }
  } catch {
    console.warn('[byok] key for', userId, 'does not decrypt; ignoring it')
    return null
  }
}
