// Prints the quality report as Markdown (see shared/quality.ts). Reads only.
// Run: npm run quality [-- days]   Uses QUALITY_DATABASE_URL (a read-only Neon role) when set, else DATABASE_URL from .env.
import { createDb } from '../worker/db'
import { qualityReport } from '../worker/lib/quality'
import { reportMarkdown } from '../shared/quality'

const url = process.env.QUALITY_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL (agisse/.env) or QUALITY_DATABASE_URL')
console.log(reportMarkdown(await qualityReport(createDb(url), Number(process.argv[2]) || 90)))
