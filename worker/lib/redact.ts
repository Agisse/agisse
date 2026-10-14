// Contact details a model never needs to read a CV: swapped for placeholders before the call, put back in its output after.
// ponytail: patterns, not a parser; a name or an unlabelled street address still goes through. Add patterns as they show up.
const PATTERNS: [string, RegExp][] = [
  ['email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  // Labelled lines first, so a phone or date inside them goes with the line.
  ['birthday', /\b(?:date of birth|birth ?date|d\.o\.b\.?|geboortedatum|date de naissance|né\(?e?\)? le|geburtsdatum|fecha de nacimiento|data di nascita|data urodzenia)\b[^\n]*/gi],
  ['address', /\b(?:address|adres|adresse|anschrift|dirección|indirizzo)\s*:[^\n]*/gi],
  ['national id', /\b(?:national (?:id|identification|insurance|register) (?:number|no\.?)|rijksregisternummer|numéro national|bsn|nir|social security number|ssn|pesel)\s*:?[^\n]*/gi],
  // Belgian national number, written like a date (YY.MM.DD-XXX.XX).
  ['national id', /\b\d{2}\.\d{2}\.\d{2}-\d{3}\.\d{2}\b/g],
  // International (+32 …, 0032 …) or national (0470 …): at least nine digits, so years and date ranges never match.
  ['phone', /(?:\+|\b00)\d(?:[\s().-]*\d){7,}|\b0\d(?:[\s./-]?\d){7,}/g],
  ['photo', /\b(?:photo|foto|picture)\s*:[^\n]*/gi],
]

/** One per model call: `hide` the texts that go out, `show` the answer that comes back. The same value always gets the same placeholder. */
export function redactor() {
  const tokens = new Map<string, string>()
  const hide = (text: string) =>
    PATTERNS.reduce(
      (t, [label, re]) =>
        t.replace(re, (value) => {
          if (/^\[[a-z ]+ \d+\]$/.test(value)) return value
          let token = tokens.get(value)
          if (!token) tokens.set(value, (token = `[${label} ${[...tokens.values()].filter((v) => v.startsWith(`[${label} `)).length + 1}]`))
          return token
        }),
      text,
    )
  /** Puts the values back into a JSON answer; each one escaped for the string it lands in. */
  const show = <T>(raw: T): T => {
    if (!tokens.size) return raw
    let json = JSON.stringify(raw)
    for (const [value, token] of tokens) json = json.split(token).join(JSON.stringify(value).slice(1, -1))
    return JSON.parse(json)
  }
  return { hide, show }
}
