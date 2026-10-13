// Run: npx tsx src/lib/csv.check.ts
import { csvField, toCsv } from './csv.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(csvField('Acme'), 'Acme', 'plain')
eq(csvField('Amsterdam, NL'), '"Amsterdam, NL"', 'comma is quoted')
eq(csvField('The "Best" Co'), '"The ""Best"" Co"', 'quotes are doubled')
eq(csvField('line\nbreak'), '"line\nbreak"', 'newline is quoted')
eq(csvField(null), '', 'null is empty')
eq(csvField(4.2), '4.2', 'number')
eq(csvField('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`, 'formula defused and quoted')
eq(csvField('-1'), "'-1", 'leading minus in text defused')
eq(toCsv([['a', 'b'], ['c,d', null]]), 'a,b\r\n"c,d",\r\n', 'rows')

console.log('csv ok')
