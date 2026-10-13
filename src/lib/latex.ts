import type { TailoredCv } from '../../shared/types'

const ESC: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}
export const tex = (s: string) => s.replace(/[\\&%$#_{}~^]/g, (c) => ESC[c])

const EMAIL = /^\S+@\S+\.\S+$/
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i
const href = (url: string, text: string) => `\\href{${url.replace(/[%#\\{}]/g, (x) => '\\' + x)}}{${text}}`
const urlOf = (c: string) => (/^https?:/i.test(c) ? c : `https://${c}`)

/** A contact entry with its email and URLs linked: "Portfolio: example.com" keeps the label. */
const link = (c: string) =>
  c
    .split(/\s+/)
    .map((w) => (EMAIL.test(w) ? href(`mailto:${w}`, tex(w)) : URL_RE.test(w) ? href(urlOf(w), tex(w.replace(/^https?:\/\/(www\.)?/i, ''))) : tex(w)))
    .join(' ')

/** "Grade: magna cum laude" → bold label; anything else as plain text. */
const labelled = (s: string) => {
  const m = /^([^:]{1,30}):\s+([\s\S]+)$/.exec(s)
  return m ? `\\textbf{${tex(m[1]!)}:} ${tex(m[2]!)}` : tex(s)
}

const items = (lines: string[]) => (lines.length ? `\n\\begin{itemize}\n${lines.map((l) => `    \\item ${l}`).join('\n')}\n\\end{itemize}` : '')

type Entry = { head: string; location?: string; title?: string; dates?: string; bullets: string[] }
const entry = (e: Entry) =>
  `\\subsection*{${e.head}${e.location ? ` \\hfill \\normalfont\\textit{${tex(e.location)}}` : ''}}` +
  (e.title || e.dates ? `\n\\textit{${tex(e.title ?? '')}${e.dates ? ` \\hfill ${tex(e.dates)}` : ''}}` : '') +
  items(e.bullets)

const section = (title: string, body: string[]) => (body.length ? `% ${title}\n\\section*{${tex(title)}}\n\n${body.join('\n\n')}\n\n` : '')

const PREAMBLE = String.raw`\documentclass[a4paper,10pt]{article}
% Packages
\usepackage[a4paper,top=0.35in,bottom=0.32in,left=0.72in,right=0.72in]{geometry}
\usepackage{enumitem}
\usepackage{hyperref}
\hypersetup{hidelinks}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage[T1]{fontenc}
\usepackage{lmodern}

\definecolor{portfolioaccent}{RGB}{67,101,125}


% Disable page numbering
\pagenumbering{gobble}

% Reduce spacing
\setlength{\parskip}{0pt}
\setlength{\parindent}{0pt}

% Tighten list spacing
\setlist[itemize]{noitemsep,leftmargin=15pt,topsep=2pt,parsep=0pt,itemsep=1pt}

% Section Formatting
\titleformat{\section}
  {\normalfont\Large\bfseries}
  {}{0pt}{}[\vspace{-2pt}\titlerule\vspace{2pt}]
\titleformat{\subsection}
  {\bfseries\normalsize}
  {}{0pt}{}
\titlespacing*{\section}{0pt}{7pt}{2pt}
\titlespacing*{\subsection}{0pt}{4pt}{1pt}

% Document
\begin{document}

`

/** The tailored CV in the seeker's one-page layout (pdfLaTeX, Overleaf-ready). Must render cv-template.tex exactly; see latex.check.ts. */
export function cvToLatex(cv: TailoredCv): string {
  const contact = [cv.contact, cv.contactLine2 ?? []].filter((l) => l.length).map((l) => l.map(link).join(' \\, | \\,\n    '))
  const header = `% Header\n\\begin{center}\n    {\\huge \\textbf{${tex(cv.name)}}}\\\\\n    \\vspace{1mm}\n    \\small\n    ${contact.join('\\\\\n    ')}\n\\end{center}\n\n`

  const education = cv.education.map((e) => entry({ head: tex(e.org), location: e.location, title: e.degree, dates: e.dates, bullets: (e.bullets ?? []).map(labelled) }))
  const role = (e: TailoredCv['experience'][number]) => entry({ head: tex(e.org), location: e.location, title: e.title, dates: e.dates, bullets: e.bullets.map(tex) })
  const projects = cv.projects.map((p) => entry({ head: p.url ? href(urlOf(p.url), tex(p.name)) : tex(p.name), title: p.title, dates: p.dates, bullets: p.bullets.map(tex) }))
  const groups = cv.skillGroups?.length ? cv.skillGroups : cv.skills.length ? [{ label: 'Skills', items: cv.skills }] : []
  const skills = groups.filter((g) => g.items.length).map((g) => `\\textbf{${tex(g.label)}:} ${g.items.map(tex).join(', ')}`)

  return (
    PREAMBLE +
    header +
    section('Education', education) +
    section('Professional Experience', cv.experience.map(role)) +
    section('Leadership & Extracurriculars', (cv.leadership ?? []).map(role)) +
    section(projects.length > 1 ? 'Personal Projects' : 'Personal Project', projects) +
    section('Skills & Interests', skills.length ? [items(skills).trimStart()] : []) +
    '\\end{document}\n'
  )
}

/** The CV body under the seeker's own preamble (fonts, margins, section styles). Returns null when `template` has no \begin{document}. */
export function withTemplate(latex: string, template: string): string | null {
  const at = template.indexOf('\\begin{document}')
  if (at < 0) return null
  // ponytail: only the preamble is kept; custom body macros (\resumeSubheading…) go unused. Fill placeholders if users ask.
  const preamble = /\\usepackage(\[[^\]]*\])?\{[^}]*\bhyperref\b/.test(template.slice(0, at)) ? template.slice(0, at) : template.slice(0, at) + '\\usepackage{hyperref}\n'
  return preamble + latex.slice(latex.indexOf('\\begin{document}'))
}
