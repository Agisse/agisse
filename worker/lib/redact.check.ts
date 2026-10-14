// Run: npx tsx worker/lib/redact.check.ts
import { redactor } from './redact.ts'

// Synthetic CV: every contact detail below is made up.
const cv = `Alex Example
alex.example@example.com | +32 470 12 34 56 | Ghent, Belgium
Date of birth: 01/02/2003
Address: Examplestraat 1, 9000 Gent
Rijksregisternummer: 03.02.01-123.45
Photo: attached

Education
MSc Statistics, Example University, 2021 - 2023 (expected June 2027)
Grew revenue 30% in 2022; ran 0.5 FTE project; tel 0470/123456

Work
Analyst, Example Corp, 09/2023 – present. Reach the team at jobs@example.com.`

const { hide, show } = redactor()
const out = hide(cv)
for (const leak of ['alex.example@example.com', '470 12 34 56', '01/02/2003', 'Examplestraat', '03.02.01-123.45', '0470/123456', 'jobs@example.com', 'attached']) {
  if (out.includes(leak)) throw new Error(`leaked: ${leak}\n${out}`)
}
for (const kept of ['Alex Example', 'Ghent, Belgium', '2021 - 2023', 'June 2027', '30% in 2022', '0.5 FTE', '09/2023 – present', 'Example Corp']) {
  if (!out.includes(kept)) throw new Error(`lost: ${kept}\n${out}`)
}
if (!out.includes('[email 1]') || !out.includes('[email 2]') || !out.includes('[phone 2]')) throw new Error(`numbering:\n${out}`)
// The same value twice gets one placeholder; hiding twice changes nothing.
if (hide('alex.example@example.com') !== '[email 1]' || hide(out) !== out) throw new Error('not stable')

// The answer gets the real values back, escaped for JSON.
const answer = show({ contact: ['[email 1]', '[phone 1]'], letter: 'Write to [email 2].\n[address 1]' })
if (answer.contact[0] !== 'alex.example@example.com' || answer.contact[1] !== '+32 470 12 34 56') throw new Error(JSON.stringify(answer))
if (answer.letter !== 'Write to jobs@example.com.\nAddress: Examplestraat 1, 9000 Gent') throw new Error(answer.letter)
const quoted = redactor()
quoted.hide('Address: "Rue d\'Exemple" 2\\b')
if (quoted.show({ a: '[address 1]' }).a !== 'Address: "Rue d\'Exemple" 2\\b') throw new Error('escaping')
// Nothing hidden: the answer comes back as it was.
const plain = { a: 1 }
if (redactor().show(plain) !== plain) throw new Error('copied for nothing')

console.log('redact ok')
