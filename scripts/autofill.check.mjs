// Run: node scripts/autofill.check.mjs — fills Greenhouse- and Lever-shaped forms with extension/autofill.js in headless Chromium.
import { chromium } from 'playwright-core'

const d = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+32 470 00 00 00', city: 'Ghent', linkedin: 'https://linkedin.com/in/ada', university: 'Ghent University', gradYear: '2026' }
const form = `
  <label for="fn">First Name *</label><input id="fn" name="job_application[first_name]">
  <label for="ln">Last Name *</label><input id="ln" name="job_application[last_name]">
  <input name="name" placeholder="Full name">
  <label>Email <input type="email" name="email"></label>
  <label>Phone <input name="phone" value="kept"></label>
  <input name="urls[LinkedIn]">
  <label>Location (City) <input name="location"></label>
  <label>School <select name="school"><option value="">Select…</option><option value="7">Ghent University</option></select></label>
  <label>Who referred you? Their email <input name="referrer_email"></label>
  <label>Cover letter <textarea name="cover"></textarea></label>
  <input type="hidden" name="email_hidden">`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<form>${form}</form>`)
await page.addScriptTag({ path: new URL('../extension/autofill.js', import.meta.url).pathname })
const filled = await page.evaluate((d) => agisseFill(d), d)
const values = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[name]')].map((el) => [el.name, el.value])))
await browser.close()

const want = {
  'job_application[first_name]': 'Ada', 'job_application[last_name]': 'Lovelace', name: 'Ada Lovelace', email: 'ada@example.com', phone: 'kept',
  'urls[LinkedIn]': 'https://linkedin.com/in/ada', location: 'Ghent', school: '7', referrer_email: '', cover: '', email_hidden: '',
}
for (const [k, v] of Object.entries(want)) if (values[k] !== v) throw new Error(`${k} = ${JSON.stringify(values[k])}, want ${JSON.stringify(v)}`)
if (filled.length !== 7) throw new Error(`filled ${filled}`)
console.log('autofill ok:', filled.join(', '))

// A German Personio-shaped form.
const de = await chromium.launch()
const dePage = await de.newPage()
await dePage.setContent(`<form>
  <label for="a">Vorname</label><input id="a" name="first_name">
  <label for="b">Nachname</label><input id="b" name="last_name">
  <label for="c">E-Mail-Adresse</label><input id="c" name="email">
  <label for="d">Telefonnummer</label><input id="d" name="phone_number">
  <label for="e">Ort</label><input id="e" name="custom_1">
  <label for="f">Hochschule</label><input id="f" name="custom_2">
  <label for="g">Anschreiben</label><textarea id="g" name="custom_3"></textarea>
</form>`)
await dePage.addScriptTag({ path: new URL('../extension/autofill.js', import.meta.url).pathname })
const deFilled = await dePage.evaluate((d) => agisseFill(d), d)
await dePage.evaluate(() => document.querySelector('form').insertAdjacentHTML('beforeend', '<label for="q1">Warum möchtest du bei uns arbeiten?</label><textarea id="q1" maxlength="500"></textarea><label for="q2">Referenz: Name des Vorgesetzten</label><textarea id="q2"></textarea><label for="q3">Short headline</label><input id="q3">'))
const questions = await dePage.evaluate(() => agisseQuestions())
const wrote = await dePage.evaluate((id) => agisseWrite(id, 'Weil …') && document.getElementById('q1').value, questions.find((q) => q.label.startsWith('Warum'))?.id)
await de.close()
if (JSON.stringify(questions.map((q) => [q.label, q.max])) !== JSON.stringify([['Anschreiben', null], ['Warum möchtest du bei uns arbeiten?', 500]])) throw new Error(`questions ${JSON.stringify(questions)}`)
if (wrote !== 'Weil …') throw new Error(`write-back ${wrote}`)
if (deFilled.join() !== 'firstName,lastName,email,phone,city,university') throw new Error(`german form filled ${deFilled}`)
console.log('german form ok')
