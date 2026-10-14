import { Link } from 'wouter'

const PLANS = [
  { name: 'Free', price: '€0', includes: 'Everything, with your own AI key, forever' },
  { name: 'Pro', price: '€12/month or €49/season', includes: "Agisse's AI key, people search, nothing to set up" },
  { name: 'Supporter', price: 'Pay what you want', includes: "Funds free Pro for students who can't pay" },
]

/** Plans preview. There's no checkout yet, so nothing here takes payment. Linked from the account menu. */
export function PricingRoute({ trial }: { trial: boolean }) {
  return (
    <main className="map map--stack pricing-page">
      <h1 className="display intake__title">Plans</h1>
      <ul>
        {PLANS.map((p) => (
          <li key={p.name}>
            <h2>{p.name}</h2>
            <p className="pricing-page__price">{p.price}</p>
            <p className="pricing-page__includes">{p.includes}</p>
          </li>
        ))}
      </ul>
      <div className="pricing-page__notes">
        <p className="profile__note">
          Paid plans aren't open yet; nothing here takes payment.
          {!trial && <> Free works today: <Link href="/profile">add your AI key in Profile</Link>.</>}
        </p>
        <p className="profile__note">
          Career centre or student association? Campus licences: <a href="mailto:hello@agisse.xyz">talk to us</a>.
        </p>
      </div>
    </main>
  )
}
