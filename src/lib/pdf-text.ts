// Read the text of a PDF in the browser. pdf.js is ~1 MB, so it is loaded only when a file is chosen,
// and the file itself never leaves the device — only the extracted text is sent for extraction.
import { RESUME_TEXT_LIMIT } from '../../shared/types'

export const PDF_MAX_BYTES = 8 * 1024 * 1024

export async function readPdfText(file: File, onProgress?: (page: number, pages: number) => void): Promise<string> {
  if (file.size > PDF_MAX_BYTES) throw new Error('That PDF is over 8 MB. Export a lighter copy and try again.')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const doc = await task.promise
  try {
    const pages: string[] = []
    const total = Math.min(doc.numPages, 8)
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // Items carry an end-of-line flag; a y-jump between items also starts a new line so columns
      // do not run into one sentence.
      let lastY: number | null = null
      let line = ''
      const lines: string[] = []
      for (const item of content.items) {
        if (!('str' in item)) continue
        const y = item.transform[5] as number
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(line)
          line = ''
        }
        line += (line && !line.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str
        if (item.hasEOL) {
          lines.push(line)
          line = ''
        }
        lastY = y
      }
      if (line) lines.push(line)
      pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'))
      onProgress?.(i, total)
      page.cleanup()
    }
    return pages.join('\n\n').trim().slice(0, RESUME_TEXT_LIMIT)
  } finally {
    await task.destroy()
  }
}
