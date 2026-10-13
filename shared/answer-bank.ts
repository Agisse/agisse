// The seeker's standard answers to application-form fields, and which form label asks for which one.
// The extension shows the matching answer to copy; it never types it into the form. Labels in EN, NL, FR, DE, ES.

export const ANSWER_FIELDS = [
  { key: 'notice', label: 'Notice period / start date', placeholder: 'e.g. Available from 1 September; one month notice', re: /notice|start date|earliest start|when can you start|availab|opzegtermijn|beschikbaar|startdatum|pr[ée]avis|disponib|date de d[ée]but|k[üu]ndigungsfrist|eintritt|verf[üu]gbar|fecha de (inicio|incorporaci)/i },
  { key: 'salary', label: 'Salary expectation', placeholder: 'e.g. €42,000–46,000 gross per year', re: /salary|compensation|pay expectation|remuneration|salaris|loonverwachting|salaire|r[ée]mun[ée]ration|gehalt|verg[üu]tung|salario|retribuci/i },
  { key: 'workAuth', label: 'Work permit / sponsorship', placeholder: 'e.g. EU citizen, no sponsorship needed', re: /work (permit|authori[sz]ation)|right to work|authori[sz]ed to work|eligib|sponsor|visa|werkvergunning|arbeitserlaubnis|arbeitsgenehmigung|permis de travail|autorisation de travail|permiso de trabajo/i },
  { key: 'relocate', label: 'Relocation', placeholder: 'e.g. Happy to relocate within the EU', re: /relocat|verhuiz|umzug|umziehen|d[ée]m[ée]nag|mobilit[ée] g[ée]ograph|reubica|traslad/i },
  { key: 'heardFrom', label: 'Where you heard about us', placeholder: 'e.g. Company careers page', re: /hear about|how did you (find|learn|hear)|where did you (find|see|hear)|hoe ken je|hoe heb je .* gevonden|wie (sind sie|haben sie) .* (aufmerksam|erfahren)|comment avez-vous (connu|entendu)|c[óo]mo (te enteraste|conociste)/i },
] as const

export type AnswerKey = (typeof ANSWER_FIELDS)[number]['key']
export type Answers = Record<AnswerKey, string>
export const EMPTY_ANSWERS: Answers = { notice: '', salary: '', workAuth: '', relocate: '', heardFrom: '' }

// Someone else's details: a referee's notice period or a manager's salary is not the seeker's.
const OTHERS = /referee|reference|emergency|guardian|manager'?s|recruiter'?s/i

/** The standard answer this form label asks for, or null. First match wins, in ANSWER_FIELDS order. */
export function matchAnswer(label: string): AnswerKey | null {
  const clean = label.replace(/[_*]+|\((required|optional)\)/gi, ' ')
  if (OTHERS.test(clean)) return null
  return ANSWER_FIELDS.find((f) => f.re.test(clean))?.key ?? null
}
