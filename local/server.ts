// `npx agisse`: the Worker's Hono app on Node, with local stand-ins for its Cloudflare bindings (docs/self-host-local.md).
// Nothing in worker/ imports this folder, so none of it reaches the Worker bundle.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator'
import { createDb, schema, type Db } from '../worker/db'
import { importFeed } from '../scripts/import-feed'
import './html-rewriter'
import worker from '../worker/index'

const command = process.argv[2]
if (command && command !== 'import-feed') {
  console.error(`Unknown command "${command}". Run without one to start Agisse, or with import-feed to load public roles.`)
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = resolve(process.env.AGISSE_DATA ?? 'agisse-data')
const port = Number(process.env.PORT ?? 3000)
mkdirSync(join(data, 'files'), { recursive: true })

// One secret per data folder, made on the first run.
const secretFile = join(data, 'auth-secret')
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('base64url'), { mode: 0o600 })

// DATABASE_URL: a Neon database, over HTTP as on Cloudflare. Otherwise PGlite in the data folder.
// ponytail: Neon only; a plain Postgres URL needs the node-postgres driver (one more dependency) when someone asks for it.
const migrationsFolder = join(root, 'drizzle')
let db: Db | undefined
let pglite: PGlite | undefined
if (process.env.DATABASE_URL) {
  await migrateNeon(createDb(process.env.DATABASE_URL), { migrationsFolder })
} else {
  // PGlite takes no lock of its own, and two processes on one folder can corrupt it.
  // ponytail: a pid file, not an atomic lock; two starts in the same instant could both pass.
  const lock = join(data, 'db.pid')
  const holder = existsSync(lock) ? Number(readFileSync(lock, 'utf8')) : 0
  if (holder && holder !== process.pid && running(holder)) {
    console.error(`Agisse is already running on ${data} (process ${holder}). Stop it first, or delete ${lock} if that process isn't Agisse.`)
    process.exit(1)
  }
  writeFileSync(lock, String(process.pid))
  process.on('exit', () => rmSync(lock, { force: true }))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))
  pglite = new PGlite(join(data, 'db'), { extensions: { vector } })
  const local = drizzle(pglite, { schema, casing: 'snake_case' })
  await migrate(local, { migrationsFolder })
  db = local as unknown as Db
}
const store = db ?? createDb(process.env.DATABASE_URL!)

if (command === 'import-feed') {
  await importFeed(store)
  await pglite?.close()
  process.exit(0)
}

function running(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const client = join(root, 'dist/client')
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
}
// Like Workers assets: the file, else `<path>.html`, else `<path>/index.html`; a 404 lets app.notFound fall back to the SPA.
const ASSETS = {
  async fetch(input: Request | URL | string) {
    const path = decodeURIComponent(new URL(input instanceof Request ? input.url : input).pathname)
    for (const name of [path, `${path}.html`, join(path, 'index.html')]) {
      const file = join(client, name)
      if (!file.startsWith(client)) break
      try {
        return new Response(await readFile(file), { headers: { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' } })
      } catch {
        // try the next name
      }
    }
    return new Response('Not found', { status: 404 })
  },
}

const fileOf = (key: string) => {
  const file = resolve(data, 'files', key)
  if (!file.startsWith(join(data, 'files'))) throw new Error(`Bad file key: ${key}`)
  return file
}
const RESUMES = {
  async put(key: string, body: ReadableStream | ArrayBuffer | string) {
    const file = fileOf(key)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, body instanceof ReadableStream ? Buffer.from(await new Response(body).arrayBuffer()) : typeof body === 'string' ? body : Buffer.from(body))
  },
  async delete(key: string) {
    await rm(fileOf(key), { force: true })
  },
}

// Fixed one-minute windows per key, in this process only.
const limiter = (limit: number) => {
  const hits = new Map<string, { until: number; n: number }>()
  return {
    async limit({ key }: { key: string }) {
      const now = Date.now()
      const h = hits.get(key)
      if (!h || h.until < now) hits.set(key, { until: now + 60_000, n: 1 })
      else h.n++
      return { success: (hits.get(key)?.n ?? 0) <= limit }
    },
  }
}

// No edge cache locally: every shared response is computed again.
Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => {} } } })

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? 'pglite',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? readFileSync(secretFile, 'utf8'),
  DB: db,
  ASSETS,
  RESUMES,
  AUTH_LIMITER: limiter(10),
  API_LIMITER: limiter(60),
  CF_VERSION_METADATA: { id: version, tag: '', timestamp: '' },
  PUBLIC_LAUNCH: '0',
} as unknown as Env
const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(console.error), passThroughOnException() {}, props: {} } as unknown as ExecutionContext

serve({
  port,
  fetch: async (req, info: { incoming: { socket: { remoteAddress?: string } } }) => {
    // Hashed build files skip the app, as with run_worker_first in wrangler.jsonc: a missing one is a 404, not the SPA.
    if (/^\/(docs\/)?assets\//.test(new URL(req.url).pathname)) {
      const res = await ASSETS.fetch(req)
      if (res.ok) res.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      res.headers.set('X-Content-Type-Options', 'nosniff')
      return res
    }
    req.headers.set('cf-connecting-ip', info.incoming.socket.remoteAddress ?? 'unknown')
    return worker.fetch(req, env, ctx)
  },
})

// The Worker's daily cron, on a timer.
const daily = () => worker.scheduled({} as ScheduledController, env).catch(console.error)
void daily()
setInterval(daily, 24 * 60 * 60 * 1000).unref()

console.log(`Agisse is running on http://localhost:${port} (data in ${data})`)
const feed = await store.select({ url: schema.vacancy.url }).from(schema.vacancy).limit(1)
// The bundle (dist/agisse.mjs) is what `npx agisse` runs; local/server.ts is `npm run local` in a clone.
const cli = import.meta.url.endsWith('.mjs') ? 'npx agisse' : 'npm run local --'
if (!feed.length) console.log(`The job feed is empty. To load public roles from Arbeitnow, stop Agisse and run: ${cli} import-feed`)
