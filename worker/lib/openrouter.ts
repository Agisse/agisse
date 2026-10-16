import Anthropic from '@anthropic-ai/sdk'
import { COMPAT, type UserKey } from './byok'
import { redactor } from './redact'

declare global {
  interface Env {
    /** Agisse's own key. Unset on a bring-your-own-key server: model calls then need the user's key. */
    OPENROUTER_API_KEY?: string
  }
}

// OpenRouter structured generation with a free-model fallback chain.
// Free models have low rate limits; we walk a preference list, then any other ":free" model,
// and fail transparently when nothing answers. Models without structured output get the schema in the prompt.

type ModelInfo = {
  id: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  supported_parameters?: string[]
  created?: number
}

let catalog: { at: number; models: ModelInfo[] } | null = null
const DISCOVERY_TTL = 60 * 60 * 1000

async function listModels(apiKey: string): Promise<ModelInfo[]> {
  if (catalog && Date.now() - catalog.at < DISCOVERY_TTL) return catalog.models
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) return []
    const { data } = (await res.json()) as { data: ModelInfo[] }
    catalog = { at: Date.now(), models: data }
    return data
  } catch {
    return []
  }
}

const structured = (m: ModelInfo) => (m.supported_parameters ?? []).includes('structured_outputs')

export function freeModels(models: ModelInfo[]): string[] {
  return models
    .filter((m) => m.id.endsWith(':free') && m.pricing?.prompt === '0' && m.pricing?.completion === '0')
    .filter((m) => (m.context_length ?? 0) >= 32_000)
    .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
    .map((m) => m.id)
}

/** Paid models under the price cap, newest first.
 *  ponytail: recency stands in for quality (the catalog has no quality signal); the curated list in OPENROUTER_SMART_MODELS goes ahead of these. */
export function smartModels(models: ModelInfo[], maxUsdPerM: number): string[] {
  return models
    .filter((m) => !m.id.endsWith(':free') && !m.id.endsWith(':batch') && !m.id.startsWith('~'))
    .filter((m) => {
      const out = Number(m.pricing?.completion) * 1e6
      return out > 0 && out <= maxUsdPerM
    })
    .filter(structured)
    .filter((m) => (m.context_length ?? 0) >= 64_000)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((m) => m.id)
}

export class NoModelAvailable extends Error {
  attempts: Array<{ model: string; error: string }>
  constructor(attempts: Array<{ model: string; error: string }>) {
    super('No model could answer right now')
    this.attempts = attempts
  }
}

/** No key to call a model with: the seeker hasn't connected one and this server has no OPENROUTER_API_KEY. */
export class NoAiKey extends Error {
  constructor() {
    super('Connect your AI key in Profile to use this.')
  }
}

export type StructuredResult<T> = { data: T; model: string }

/** Running spend for one request; every provider response counts, even ones that fail validation.
 *  `smart` = the user chose the Smart model: paid models first, free chain as fallback. */
export type Meter = {
  tokens: number
  costUsd: number
  smart?: { preferred: string[]; maxUsdPerM: number }
  /** The last successful call in this request, logged by charge() so quality can be measured per prompt and model. */
  gen?: Generation
  /** The job, person or search the output belongs to; set by the route once it knows it. */
  ref?: string
  /** What the code verifiers dropped or corrected, e.g. { cv_employers_dropped: 1 }. */
  flags?: Record<string, number>
  /** Per task (schemaName), each measured model's quality score in 0..1; see rankModels in quality.ts. */
  rank?: Record<string, Record<string, number>>
  /** The seeker's own key: their provider bills these calls, so nothing is booked against the Agisse budget. */
  byok?: UserKey
  /** One-time credit left on Agisse's key: these paid models go first, and charge() draws what they cost (× eurPerUsd) from it. */
  credit?: { models: string[]; eurPerUsd: number }
}

export type Generation = { task: string; model: string; prompt: string; failed: string[]; output: unknown }

/** Adds n to a verifier flag; no-op without a meter, so pure checks can skip it. */
export function flag(meter: Meter | undefined, name: string, n = 1) {
  if (!meter || n <= 0) return
  meter.flags = { ...meter.flags, [name]: (meter.flags?.[name] ?? 0) + n }
}

/** Prompt version: the first 8 hex of SHA-256 over the system prompt, so every wording change is a new version without bumping anything. */
export async function promptVersion(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Orders models by measured quality; unmeasured ones count as 0.5 and ties keep the configured order (the sort is stable). */
export function byRank(models: string[], rank: Record<string, number> | undefined) {
  if (!rank) return models
  return [...models].sort((a, b) => (rank[b] ?? 0.5) - (rank[a] ?? 0.5))
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Some free models wrap JSON in a code fence or add prose; take the outermost object.
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('no JSON object in response')
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      // JSON.parse's own message quotes the text, which is model output; it would reach the logs and Sentry.
      throw new Error('response is not valid JSON')
    }
  }
}

/** The provider's error message only: the rest of an error body can quote the prompt (a moderation error's `flagged_input`). */
const providerMessage = (body: string) => body.match(/"message"\s*:\s*"((?:[^"\\]|\\.){0,160})/)?.[1] ?? ''

export async function generateStructured<T>(opts: {
  apiKey?: string
  preferredModels: string[]
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
  validate: (raw: unknown) => T
  /** Total wall-clock budget across all attempts. */
  deadlineMs?: number
  /** Per-attempt ceiling; the last attempts get whatever budget remains. */
  attemptMs?: number
  meter?: Meter
  /** Text hashed for the prompt version when the system prompt embeds per-request data (default: system). */
  promptKey?: string
  /** Paid models tried first with room to reason, whatever the user's Smart setting: for tasks free models do badly. */
  strong?: { models: string[]; effort: 'low' | 'medium' | 'high' }
}): Promise<StructuredResult<T>> {
  // Contact details never reach a model, on any key; the answer gets them back before it is validated.
  const { hide, show } = redactor()
  const validate = opts.validate
  opts = { ...opts, system: hide(opts.system), user: hide(opts.user), validate: (raw) => validate(show(raw)) }
  const byok = opts.meter?.byok
  if (byok && byok.provider !== 'openrouter') return generateDirect(byok, opts)
  const apiKey = byok?.key ?? opts.apiKey
  if (!apiKey) throw new NoAiKey()
  const models = await listModels(apiKey)
  const rank = opts.meter?.rank?.[opts.schemaName]
  const isFree = (m: string) => m.endsWith(':free')
  const free = byRank([...new Set([...opts.preferredModels.filter(isFree), ...freeModels(models)])].slice(0, 5), rank)
  // Agisse's key: the credit's paid models while it lasts, any paid entries in OPENROUTER_MODELS (Mistral Small 4 on agisse.xyz), then the free chain. Smart's pricier models only on the seeker's own key.
  const smart = byok ? opts.meter?.smart : undefined
  const paid = smart
    ? byRank([...new Set([...smart.preferred, ...smartModels(models, smart.maxUsdPerM)])].slice(0, 3), rank)
    : byok ? [] : [...(opts.meter?.credit?.models ?? []), ...opts.preferredModels.filter((m) => !isFree(m))]
  const strong = byok ? (opts.strong?.models ?? []) : []
  // The model the seeker picked for their own OpenRouter key goes first, ahead of Agisse's choices.
  const own = byok?.model ? [byok.model] : []
  // Strong models get a second try: even good ones now and then return malformed JSON.
  // So do the paid models on Agisse's key: a fresh sample fixes most rejections (a banned word in a letter) in seconds, the free chain takes a minute.
  const retry = byok ? [] : paid.filter((m) => !strong.includes(m))
  const chain = [...own, ...strong.filter((m) => !own.includes(m)), ...strong.filter((m) => !own.includes(m)), ...retry, ...[...new Set([...paid, ...free])].filter((m) => !strong.includes(m) && !own.includes(m))]
  const attempts: Array<{ model: string; error: string }> = []
  const started = Date.now()
  const deadline = opts.deadlineMs ?? 120_000
  const attemptCeiling = opts.attemptMs ?? 60_000

  for (const [i, model] of chain.entries()) {
    const remaining = deadline - (Date.now() - started)
    if (remaining < 8_000) break
    // Hold back the minimum for each model still queued, so one hung model can't starve the fallbacks behind it.
    // Not an even split: most failures (404, 429, 400) return at once, and an even split cut working models off mid-answer.
    // Unlisted models (catalog fetch failed) are assumed to support structured output, as before.
    const info = models.find((m) => m.id === model)
    const native = !info || structured(info)
    const share = Math.max(8_000, Math.min(attemptCeiling, remaining - 8_000 * (chain.length - i - 1)))
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://agisse.app',
          'X-Title': 'Agisse',
        },
        body: JSON.stringify({
          model,
          // Newer models (Haiku 5.5, GPT-6 Luna) reject temperature, and require_parameters turns that into a 404.
          ...((!info || (info.supported_parameters ?? []).includes('temperature')) && { temperature: 0.2 }),
          max_tokens: 6000,
          // Free reasoning models otherwise spend the whole budget thinking; paid ones get a little room to think.
          reasoning: (strong.includes(model) || own.includes(model)) && opts.strong ? { effort: opts.strong.effort } : own.includes(model) || paid.includes(model) ? { effort: 'low' } : { enabled: false },
          messages: [
            { role: 'system', content: native ? opts.system : `${opts.system}\n\nReply with only a JSON object matching this JSON Schema, no prose:\n${JSON.stringify(opts.schema)}` },
            { role: 'user', content: opts.user },
          ],
          ...(native && {
            response_format: {
              type: 'json_schema',
              json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
            },
          }),
          // Mistral's models run only on Mistral's own EU endpoint (owner, 2026-10-16); when it fails, the chain moves on.
          provider: { require_parameters: native, ...(model.startsWith('mistralai/') && { only: ['mistral/eu'] }) },
          // Returns usage.cost (USD) so each call can be billed against the user's budget.
          usage: { include: true },
        }),
        signal: AbortSignal.timeout(Math.floor(Math.min(share, remaining))),
      })
      if (!res.ok) {
        const why = providerMessage(await res.text().catch(() => ''))
        attempts.push({ model, error: `${res.status} ${why}` })
        console.warn('[openrouter]', model, 'http', res.status, why)
        continue
      }
      const json = (await res.json()) as {
        model?: string
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
        error?: { message?: string }
        usage?: { total_tokens?: number; cost?: number }
      }
      if (opts.meter && !byok) {
        opts.meter.tokens += json.usage?.total_tokens ?? 0
        opts.meter.costUsd += json.usage?.cost ?? 0
      }
      if (json.error) {
        attempts.push({ model, error: json.error.message ?? 'provider error' })
        continue
      }
      const content = json.choices?.[0]?.message?.content
      if (!content) {
        attempts.push({ model, error: 'empty completion' })
        continue
      }
      const data = opts.validate(extractJson(content))
      if (opts.meter) {
        const prompt = await promptVersion(opts.promptKey ?? opts.system)
        opts.meter.gen = { task: opts.schemaName, model: json.model ?? model, prompt, failed: attempts.map((a) => a.model), output: data }
      }
      return { data, model: json.model ?? model }
    } catch (err) {
      // ponytail: an aborted attempt returns no usage, so a paid model cut off by the timeout is never booked; keep slow models out of OPENROUTER_SMART_MODELS, or stream to read usage if this grows.
      const error = err instanceof Error ? err.message : String(err)
      console.warn('[openrouter]', model, 'failed:', error.slice(0, 300))
      attempts.push({ model, error })
    }
  }
  console.error('[openrouter] all models failed', JSON.stringify(attempts))
  throw new NoModelAvailable(attempts)
}

/** One answer from the seeker's own OpenAI-compatible or Anthropic key: their chosen model, a second try for malformed JSON, no fallback to Agisse's key. */
async function generateDirect<T>(
  k: UserKey,
  opts: { system: string; user: string; schemaName: string; schema: Record<string, unknown>; validate: (raw: unknown) => T; deadlineMs?: number; meter?: Meter; promptKey?: string; strong?: { effort: 'low' | 'medium' | 'high' } },
): Promise<StructuredResult<T>> {
  const attempts: Array<{ model: string; error: string }> = []
  const started = Date.now()
  const deadline = opts.deadlineMs ?? 120_000
  const effort = opts.strong?.effort ?? 'low'
  // Dropped after a model rejects it: the seeker may pick a model that doesn't reason.
  let reasoning = true
  for (let i = 0; i < 2; i++) {
    const remaining = deadline - (Date.now() - started)
    if (remaining < 8_000) break
    try {
      let content: string | undefined
      let model = k.model
      if (k.provider === 'anthropic') {
        const client = new Anthropic({ apiKey: k.key, maxRetries: 0, timeout: remaining })
        const res = await client.beta.messages.create({
          model: k.model,
          max_tokens: 16000,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
          output_config: { effort, format: { type: 'json_schema', schema: opts.schema } },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
        if (res.stop_reason === 'refusal') throw new Error(`refused (${res.stop_details?.category ?? 'no category'})`)
        content = res.content.find((b) => b.type === 'text')?.text
        model = res.model
      } else {
        const compat = COMPAT[k.provider]!
        const res = await fetch(`${compat.base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${k.key}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: k.model,
            [compat.maxTokens]: 16000,
            ...(reasoning && { reasoning_effort: effort }),
            messages: [
              { role: 'system', content: opts.system },
              { role: 'user', content: opts.user },
            ],
            response_format: { type: 'json_schema', json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
          }),
          signal: AbortSignal.timeout(remaining),
        })
        if (!res.ok) throw new Error(`${res.status} ${providerMessage(await res.text().catch(() => ''))}`)
        const json = (await res.json()) as { model?: string; choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }> }
        const msg = json.choices?.[0]?.message
        // The refusal is model output and may quote the CV, so only the fact is kept.
        if (msg?.refusal) throw new Error('refused')
        content = msg?.content ?? undefined
        model = json.model ?? model
      }
      if (!content) throw new Error('empty completion')
      const data = opts.validate(extractJson(content))
      if (opts.meter) {
        const prompt = await promptVersion(opts.promptKey ?? opts.system)
        opts.meter.gen = { task: opts.schemaName, model, prompt, failed: attempts.map((a) => a.model), output: data }
      }
      return { data, model }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.warn('[byok]', k.provider, k.model, 'failed:', error.slice(0, 300))
      attempts.push({ model: k.model, error })
      if (/^400 .*reasoning/i.test(error)) reasoning = false
      // A rejected key or unknown model won't fix itself on a second try.
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.NotFoundError || /^(401|403|404) /.test(error)) break
    }
  }
  throw new NoModelAvailable(attempts)
}

/** Speech to text for one recorded answer (base64 audio). One paid call, booked on the meter; no fallback chain. */
export async function transcribe(opts: { apiKey?: string; model: string; audio: string; format: 'webm' | 'ogg' | 'mp4' | 'wav'; meter?: Meter }): Promise<string> {
  // An own OpenRouter key pays for audio too; OpenAI and Anthropic keys don't, so Agisse's key does and it is booked.
  const own = opts.meter?.byok?.provider === 'openrouter' ? opts.meter.byok.key : null
  if (!own && !opts.apiKey) throw new NoAiKey()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${own ?? opts.apiKey}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://agisse.app', 'X-Title': 'Agisse' },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_tokens: 1500,
      reasoning: { enabled: false },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this interview answer verbatim, including filler words such as um and uh. Output only the transcript.' },
            { type: 'input_audio', input_audio: { data: opts.audio, format: opts.format } },
          ],
        },
      ],
      usage: { include: true },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${providerMessage(await res.text().catch(() => ''))}`)
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }>; usage?: { total_tokens?: number; cost?: number } }
  if (opts.meter && !own) {
    opts.meter.tokens += json.usage?.total_tokens ?? 0
    opts.meter.costUsd += json.usage?.cost ?? 0
  }
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}
