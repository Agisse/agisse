// Node has no HTMLRewriter. app.notFound uses it on index.html for two things only: an attribute on <html> and
// emptying #root. This does exactly those with string operations; any other selector throws, so a new use in the
// Worker fails loudly instead of being skipped.
type Element = { setAttribute(name: string, value: string): void; setInnerContent(content: string): void }

class LocalHTMLRewriter {
  private edits: ((html: string) => string)[] = []

  on(selector: string, handler: { element(el: Element): void }) {
    if (selector !== 'html' && selector !== '#root') throw new Error(`Local HTMLRewriter can't handle "${selector}"`)
    this.edits.push((html) => {
      let out = html
      handler.element({
        setAttribute: (name, value) => {
          if (selector !== 'html') throw new Error('setAttribute is only supported on html')
          out = out.replace(/<html\b/, `<html ${name}="${value}"`)
        },
        setInnerContent: (content) => {
          if (selector !== '#root') throw new Error('setInnerContent is only supported on #root')
          // #root is the last element in <body> (index.html), so its content runs to the last </div> before </body>.
          const start = out.indexOf('<div id="root">')
          const end = out.lastIndexOf('</div>', out.indexOf('</body>'))
          if (start >= 0 && end > start) out = out.slice(0, start + '<div id="root">'.length) + content + out.slice(end)
        },
      })
      return out
    })
    return this
  }

  transform(res: Response) {
    const headers = new Headers(res.headers)
    headers.delete('Content-Length')
    const body = res.text().then((html) => this.edits.reduce((out, edit) => edit(out), html))
    return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await body)); c.close() } }), { status: res.status, headers })
  }
}

if (!('HTMLRewriter' in globalThis)) Object.assign(globalThis, { HTMLRewriter: LocalHTMLRewriter })
