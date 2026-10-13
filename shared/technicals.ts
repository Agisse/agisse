// Technical interview flashcards (finance, consulting/business basics) with a small spaced-repetition scheduler.
// Progress lives in the browser; no model.

/** Investment banking interview topics, in the order banks usually test them (finance deck only). */
export const TOPICS = { accounting: 'Accounting', valuation: 'Valuation', ma: 'M&A', lbo: 'LBO', markets: 'Markets', fit: 'Fit' } as const
export type Topic = keyof typeof TOPICS

export type Card = { id: string; deck: 'finance' | 'business'; topic?: Topic; q: string; a: string }
const c = (deck: Card['deck'], id: string, q: string, a: string): Card => ({ id, deck, q, a })
const topic = (t: Topic, cards: Card[]) => cards.map((x) => ({ ...x, topic: t }))

export const DECKS = { finance: 'Finance', business: 'Consulting & business' } as const

export const CARDS: Card[] = [
  ...topic('accounting', [
  c('finance', 'f1', 'Walk me through the three financial statements.', 'Income statement: revenue to net income over a period. Balance sheet: assets = liabilities + equity at a point in time. Cash flow statement: starts from net income, adjusts for non-cash items and working capital, then investing and financing flows, to the change in cash.'),
  c('finance', 'f2', 'Depreciation goes up by €10. Walk it through the statements (25% tax).', 'Income statement: operating income −10, net income −7.5. Cash flow: net income −7.5, add back depreciation +10, cash +2.5. Balance sheet: PP&E −10, cash +2.5, so assets −7.5; retained earnings −7.5. It balances.'),
  c('finance', 'f3', 'Inventory rises by €10, paid in cash. Effect on the statements?', 'No income statement effect. Cash flow from operations −10 (working capital). Balance sheet: inventory +10, cash −10.'),
  c('finance', 'f4', 'What is working capital?', 'Current assets minus current liabilities. Operating working capital usually excludes cash and debt: receivables + inventory − payables.'),
  c('finance', 'f5', 'Why can a profitable company run out of cash?', 'Profit is not cash: growing receivables and inventory, heavy capex or debt repayments can drain cash while the income statement shows a profit.'),
  c('finance', 'f6', 'What is goodwill?', 'The premium paid in an acquisition above the fair value of the identifiable net assets. It sits on the balance sheet and is tested for impairment.'),
  c('finance', 'f7', 'EBITDA vs net income?', 'EBITDA is earnings before interest, taxes, depreciation and amortisation: a proxy for operating cash profit, independent of capital structure. Net income is after all of them.'),
  c('finance', 'f8', 'What is deferred revenue?', 'Cash received before the service is delivered. A liability until earned, then it moves to revenue.'),
  c('finance', 'f9', 'IFRS vs US GAAP: one difference that matters in interviews?', 'IFRS 16 puts nearly all leases on the balance sheet with depreciation and interest, which raises EBITDA versus older treatment; IFRS also bans LIFO inventory.'),
  c('finance', 'f10', 'What is free cash flow?', 'Cash from operations minus capex. Unlevered FCF (for a DCF): EBIT × (1 − tax) + D&A − capex − change in working capital.'),
  ]),
  ...topic('valuation', [
  c('finance', 'f11', 'Enterprise value vs equity value?', 'Equity value is what belongs to shareholders (share price × diluted shares). Enterprise value is the value of the operations to all capital providers: equity + debt + preferred + minority interest − cash.'),
  c('finance', 'f12', 'Why subtract cash when going from equity value to EV?', 'An acquirer gets the cash with the company, so it effectively reduces the price of the operations; EV measures the business alone.'),
  c('finance', 'f13', 'A company raises €100 of debt and keeps the cash. EV changes?', 'No. Debt +100 and cash +100 cancel. Equity value is also unchanged at that moment.'),
  c('finance', 'f14', 'Which multiples use EV and which use equity value?', 'Match the numerator to whose earnings: EV/EBITDA, EV/Revenue, EV/EBIT (all capital providers); P/E and P/B use equity value (shareholders only).'),
  c('finance', 'f15', 'Name the three main valuation methods.', 'Comparable companies (trading multiples), precedent transactions (deal multiples, include a control premium), and a DCF (intrinsic value). An LBO gives a floor from a financial buyer.'),
  c('finance', 'f16', 'Walk me through a DCF.', 'Project unlevered free cash flows for 5–10 years, compute a terminal value (perpetuity growth or exit multiple), discount both at WACC to today: that is EV. Subtract net debt for equity value, divide by diluted shares.'),
  c('finance', 'f17', 'What is WACC?', 'The weighted average cost of capital: E/(D+E) × cost of equity + D/(D+E) × cost of debt × (1 − tax).'),
  c('finance', 'f18', 'How do you get the cost of equity?', 'CAPM: risk-free rate + beta × equity risk premium.'),
  c('finance', 'f19', 'Why is debt usually cheaper than equity?', 'Debt holders are paid first and interest is tax-deductible, so they take less risk and the after-tax cost is lower.'),
  c('finance', 'f20', 'Two terminal value methods?', 'Gordon growth: FCF × (1 + g) / (WACC − g). Exit multiple: final-year EBITDA × an EV/EBITDA multiple. Cross-check one against the other.'),
  c('finance', 'f21', 'What usually drives most of a DCF’s value?', 'The terminal value, often 60–80%. Small changes in WACC or growth move it a lot, hence sensitivity tables.'),
  c('finance', 'f22', 'WACC rises by 1 point. What happens to the DCF?', 'Value falls: future cash flows are discounted more heavily, and the terminal value falls most.'),
  c('finance', 'f23', 'Why might precedent transactions give a higher value than comparables?', 'They include a control premium buyers pay to take over, and sometimes synergies.'),
  c('finance', 'f24', 'What is beta?', 'The sensitivity of a stock’s returns to the market. Levered beta includes the effect of debt; unlever comps’ betas and relever at the target structure.'),
  c('finance', 'f25', 'What is dilution, and the treasury stock method?', 'Options and convertibles can add shares. TSM: in-the-money options are exercised, and the proceeds buy back shares at the current price; the net new shares are added.'),
  ]),
  ...topic('ma', [
  c('finance', 'f26', 'Accretion / dilution in one line?', 'A deal is accretive if the buyer’s EPS rises after the deal, which roughly happens when the target’s earnings yield exceeds the cost of the funding used.'),
  c('finance', 'f27', 'Cost of funding with cash, debt and stock?', 'Cash: forgone interest after tax. Debt: interest after tax. Stock: the buyer’s earnings yield (1 / P/E).'),
  c('finance', 'f32', 'What are synergies?', 'Value created by combining: cost synergies (overlap, scale) are more reliable than revenue synergies (cross-selling).'),
  ]),
  ...topic('lbo', [
  c('finance', 'f28', 'Walk me through an LBO.', 'A sponsor buys a company with mostly debt, uses its cash flow to pay down debt over 3–7 years, then sells. Returns come from EBITDA growth, debt paydown and multiple expansion.'),
  c('finance', 'f29', 'What makes a good LBO candidate?', 'Stable, predictable cash flows, low capex needs, strong market position, room for cost savings, and a realistic exit.'),
  c('finance', 'f30', 'Rough IRR: money doubles in 3 years. In 5 years?', 'About 26% for 2× in 3 years; about 15% for 2× in 5 years. Rule of 72 gives a quick check.'),
  c('finance', 'f31', 'Why use debt in an LBO?', 'Less equity needed means a higher return on equity, interest is tax-deductible, and debt adds discipline. It also adds risk of default.'),
  ]),
  ...topic('markets', [
  c('finance', 'f33', 'Interest rates rise. What happens to bond prices?', 'They fall: existing fixed coupons are worth less than new, higher-yielding bonds. Longer duration means a bigger fall.'),
  c('finance', 'f34', 'What is duration?', 'The sensitivity of a bond’s price to interest rates, roughly the weighted average time to its cash flows.'),
  c('finance', 'f35', 'Why might a company buy back shares?', 'To return cash when it has no better investment, signal undervaluation, offset dilution, or raise EPS.'),
  c('finance', 'f36', 'What does the ECB do, and why does it matter to banks?', 'It sets euro-area policy rates and supervises the largest banks. Rates drive lending margins, funding costs and asset prices.'),
  c('finance', 'f37', 'Dividend vs buyback for shareholders?', 'Same total value in theory. Buybacks are flexible and may be taxed differently; dividends signal steady commitment.'),
  c('finance', 'f38', 'What is a leveraged recap?', 'A company raises debt to pay a large dividend or buy back shares, changing its capital structure without a sale.'),
  c('finance', 'f39', 'What is a covenant?', 'A condition in a loan, such as a maximum net debt / EBITDA. Breaching it lets lenders renegotiate or call the loan.'),
  c('finance', 'f40', 'Pitch me a stock in 60 seconds: structure?', 'Company and what it does, your thesis (two or three reasons), valuation versus peers, key risk, and what would change your mind.'),
  ]),
  // Investment banking: the topics a first round covers, after the WSP Red Book's structure. Answers are our own.
  ...topic('accounting', [
  c('finance', 'ia1', 'A company buys €100 of equipment with new debt. Walk it through the statements.', 'Income statement: nothing yet. Cash flow: investing −100 (capex), financing +100, so cash is unchanged. Balance sheet: PP&E +100, debt +100.'),
  c('finance', 'ia2', 'Year one for that €100 of equipment: 5-year straight-line depreciation, 10% interest, 25% tax.', 'Income statement: depreciation 20 + interest 10, pre-tax −30, net income −22.5. Cash flow: −22.5 + 20 depreciation added back = cash −2.5. Balance sheet: cash −2.5, PP&E −20, so assets −22.5; retained earnings −22.5. Debt is unchanged until principal is repaid.'),
  c('finance', 'ia3', 'A €10 sale is made on credit (25% tax). Effect on the statements?', 'Income statement: revenue +10, net income +7.5. Cash flow: +7.5, minus the €10 rise in receivables = cash −2.5 (the tax paid). Balance sheet: receivables +10, cash −2.5, so assets +7.5; retained earnings +7.5.'),
  c('finance', 'ia4', 'An asset is written down by €20 (25% tax, deductible). Effect?', 'Income statement: −20 pre-tax, net income −15. Cash flow: −15 + 20 non-cash add-back = cash +5 (the tax saving). Balance sheet: asset −20, cash +5; retained earnings −15. In practice a write-down is often not deductible straight away, which creates a deferred tax asset.'),
  c('finance', 'ia5', 'Stock-based compensation of €10 (25% tax, deductible). Effect?', 'Income statement: expense −10, net income −7.5. Cash flow: −7.5 + 10 non-cash add-back = cash +2.5. Balance sheet: cash +2.5; equity −7.5 retained earnings and +10 paid-in capital, so equity +2.5.'),
  c('finance', 'ia6', 'How do the three statements link together?', 'Net income starts the cash flow statement and adds to retained earnings. Non-cash items are added back, changes in balance sheet working capital flow through operations, capex changes PP&E, debt and equity moves sit in financing, and ending cash equals balance sheet cash.'),
  c('finance', 'ia7', 'What are deferred tax assets and liabilities?', 'Timing differences between book and tax accounts. A liability means tax is paid later than the books show (for example faster tax depreciation). An asset means tax is paid earlier or saved later (for example loss carryforwards).'),
  c('finance', 'ia8', 'Equity method vs consolidation?', 'At 20–50% with significant influence: one investment line on the balance sheet and a share of profit on the income statement. Above 50% with control: consolidate 100% of the subsidiary and show the part you do not own as non-controlling interest.'),
  c('finance', 'ia9', 'One statement to judge a company’s health: which?', 'The cash flow statement. It shows whether the business actually generates cash, which accounting choices can hide on the income statement.'),
  ]),
  ...topic('valuation', [
  c('finance', 'iv1', 'How do you choose comparable companies?', 'Same industry and business model, then similar size, growth, margins and geography. Usually 5–10 peers, compared on the median and quartiles rather than the mean.'),
  c('finance', 'iv2', 'Why use EV/EBITDA rather than P/E?', 'EV/EBITDA is neutral to capital structure and sits before depreciation policy and tax. P/E moves with leverage, tax and one-off items.'),
  c('finance', 'iv3', 'Unlevered vs levered free cash flow?', 'Unlevered FCF is before interest and goes to all capital providers: discount at WACC for enterprise value. Levered FCF is after interest and debt repayment and goes to shareholders: discount at the cost of equity for equity value.'),
  c('finance', 'iv4', 'What is the mid-year convention?', 'It assumes cash flows arrive mid-year instead of at year end, so each is discounted by half a year less. Value rises slightly.'),
  c('finance', 'iv5', 'How do you value a company that loses money?', 'Revenue or operating-metric multiples (EV/Revenue, EV/users), or a DCF with a longer forecast to a steady state. P/E means nothing with negative earnings.'),
  c('finance', 'iv6', 'How do you sanity-check an exit-multiple terminal value?', 'Back out the implied perpetual growth: g = (TV × WACC − FCF) ÷ (TV + FCF). If it is above long-run nominal growth (about 2–3%), the multiple is aggressive.'),
  c('finance', 'iv7', 'What is a football field?', 'A bar chart of the value ranges each method gives (52-week trading range, comparables, precedents, DCF, LBO) on one axis, used to frame a price.'),
  c('finance', 'iv8', 'How do convertible bonds enter diluted shares?', 'If-converted method: if the share price is above the conversion price, add face value ÷ conversion price in shares and remove the bond from debt. For EPS, add back the after-tax interest.'),
  c('finance', 'iv9', 'Which is higher, cost of equity or WACC?', 'Cost of equity, because WACC blends in cheaper after-tax debt. With no debt they are equal.'),
  c('finance', 'iv10', 'Where does the equity risk premium come from?', 'It is the extra return investors want for holding equities over risk-free bonds: from historical averages or implied from today’s prices. Damodaran publishes both, free.'),
  ]),
  ...topic('ma', [
  c('finance', 'im1', 'Walk me through a merger model.', 'Set the price and the funding mix. Combine the two net incomes, add synergies, subtract forgone interest on cash, new interest on debt and amortisation of new intangibles, all after tax. Divide by the buyer’s shares plus any new shares issued, and compare with the buyer’s standalone EPS.'),
  c('finance', 'im2', 'Buyer P/E 20×, target P/E 10× at the offer price, all-stock deal. Accretive?', 'Yes. The buyer pays with stock costing a 5% earnings yield (1 ÷ 20) and buys earnings at a 10% yield (1 ÷ 10). Rule: all-stock is accretive when the buyer’s P/E is above the price paid as a P/E.'),
  c('finance', 'im3', 'Why pay with stock rather than cash?', 'The buyer’s shares are richly valued, it lacks cash or debt capacity, or it wants sellers to share the risk. Cash avoids dilution and signals confidence.'),
  c('finance', 'im4', 'What is a purchase price allocation?', 'The price is spread over the target’s assets and liabilities at fair value: assets are written up and new intangibles recognised, with a deferred tax liability on the write-ups. The rest is goodwill.'),
  c('finance', 'im5', 'Strategic vs financial buyer: who pays more?', 'Usually the strategic buyer, because synergies justify a higher price. A financial sponsor is capped by its return target and how much debt it can raise.'),
  c('finance', 'im6', 'Walk me through a sell-side process.', 'Prepare the teaser, information memorandum and model; contact buyers (broad or targeted auction); sign NDAs; take indicative bids; run management presentations and the data room; take binding bids; negotiate the purchase agreement; sign; close after approvals.'),
  c('finance', 'im7', 'What is an earn-out?', 'Part of the price paid later only if the target hits agreed targets. It bridges a gap between what the buyer and seller think the business is worth.'),
  c('finance', 'im8', 'What are breakeven synergies?', 'The pre-tax synergies needed to make a dilutive deal EPS-neutral: the shortfall in net income ÷ (1 − tax rate).'),
  c('finance', 'im9', 'Why do many deals destroy value?', 'Overpaying, overestimated synergies, weak integration, culture clashes, and management distraction from the core business.'),
  ]),
  ...topic('lbo', [
  c('finance', 'il1', 'Walk me through a simple LBO model.', 'Entry price (EBITDA × multiple), sources and uses, five years of free cash flow, debt paid down with it, exit at a multiple of final EBITDA, equity at exit = exit EV − remaining net debt, then IRR and money multiple.'),
  c('finance', 'il2', 'What goes in sources and uses?', 'Uses: equity purchase price, refinancing the existing debt, fees. Sources: the debt tranches, the sponsor’s equity, sometimes rolled-over management equity and cash on the balance sheet.'),
  c('finance', 'il3', 'Over five years, what IRR do 2×, 2.5× and 3× give?', 'About 15%, 20% and 25%. Over three years, 2× is about 26%.'),
  c('finance', 'il4', 'Why does paying down debt create returns?', 'Each euro of debt repaid becomes a euro of equity at exit: the same enterprise value is split more to equity.'),
  c('finance', 'il5', 'Senior vs subordinated debt?', 'Senior: secured, paid first, cheaper, often amortising, with maintenance covenants. Subordinated (high yield, mezzanine): unsecured, dearer, repaid at maturity, fewer covenants, sometimes interest paid in kind.'),
  c('finance', 'il6', 'What is a dividend recap?', 'The portfolio company borrows more to pay the sponsor a dividend. Cash comes back early, which lifts the IRR more than the money multiple.'),
  c('finance', 'il7', 'How can a sponsor raise its IRR without improving the business?', 'More leverage, a lower entry price, a higher exit multiple, or getting cash back sooner (an earlier exit or a recap).'),
  c('finance', 'il8', 'IRR vs money multiple: why look at both?', 'IRR rewards speed: a quick flip can show a high IRR on a small gain. Investors also want a high multiple of cash returned.'),
  ]),
  ...topic('markets', [
  c('finance', 'ik1', 'What should you check about markets the morning of an interview?', 'The ECB deposit rate, the 10-year Bund yield, a main index (Euro Stoxx 50, or your country’s), EUR/USD, and one or two recent deals the bank worked on.'),
  c('finance', 'ik2', 'Rates rise. What happens to equity values and to deals?', 'Higher discount rates cut present values, most for long-duration growth stocks. Debt gets dearer, so LBOs need more equity and pay lower prices.'),
  c('finance', 'ik3', 'What is a credit spread?', 'The extra yield over the risk-free rate a borrower pays for default and liquidity risk. Spreads widen when markets are stressed.'),
  c('finance', 'ik4', 'What is an accelerated bookbuild?', 'A bank sells a block of shares to institutional investors overnight, usually at a small discount to the last price.'),
  c('finance', 'ik5', 'Walk me through a recent deal.', 'Who bought whom and for how much, the rationale, the multiple and premium paid, how it was financed, and your view: does it make sense and what is the risk?'),
  ]),
  ...topic('fit', [
  c('finance', 'iq1', 'Tell me about yourself.', 'About 90 seconds, a story rather than your CV read aloud: who you are, the moment finance caught you, two to four experiences with what each taught you and why it led to the next, then why you fit this role. Write it under Your pitch.'),
  c('finance', 'iq2', 'Why investment banking?', 'Specific and personal: the learning curve, live deals, what a past experience showed you, what bankers you spoke to told you. Not money or prestige.'),
  c('finance', 'iq3', 'Why our bank?', 'Something true only of this bank: people you spoke to by name, recent deals, a sector strength, the team size. A line from the website is not enough.'),
  c('finance', 'iq4', 'Why should we hire you?', 'Three strengths an analyst needs (detail, work ethic, teamwork, numbers), each with one piece of evidence.'),
  c('finance', 'iq5', 'What is your biggest weakness?', 'A real one that is not fatal for the job, with what you are doing about it. No disguised strengths.'),
  c('finance', 'iq6', 'Tell me about a time you worked under pressure in a team.', 'Situation, task, action, result. Say what you did, put a number on the result, end with what you learned.'),
  c('finance', 'iq7', 'Tell me about a time you failed.', 'A real failure that you own, specific, and what you do differently since.'),
  c('finance', 'iq8', 'What does an analyst actually do?', 'Models, comparables, pitch books, research, due diligence lists, coordinating with lawyers and clients, and checking every number. Long hours, a lot of learning.'),
  c('finance', 'iq9', 'Where else are you applying?', 'Honest and consistent: other banks or close roles. It should show you are committed to banking.'),
  c('finance', 'iq10', 'How do you handle a brain teaser?', 'Think aloud, state your assumptions, round the numbers, and check that the answer makes sense. The method is what is scored.'),
  c('finance', 'iq11', 'Do you have any questions for us?', 'Two or three real questions about their deals, team or path. Never pay, or anything the website answers.'),
  ]),
  // Consulting and business basics
  c('business', 'b1', 'Profit formula?', 'Profit = revenue − costs = price × volume − (fixed costs + variable cost × volume).'),
  c('business', 'b2', 'Contribution margin?', 'Price minus variable cost per unit: what each unit adds towards fixed costs and profit.'),
  c('business', 'b3', 'Breakeven volume?', 'Fixed costs ÷ contribution margin per unit.'),
  c('business', 'b4', 'Market share vs market size growth: which matters more for revenue?', 'Revenue = market size × share. Ask which one moved before deciding where the problem is.'),
  c('business', 'b5', 'Customer lifetime value?', 'Average margin per period × expected number of periods a customer stays (minus acquisition cost for a net view).'),
  c('business', 'b6', 'CAGR formula?', '(End ÷ start)^(1 / years) − 1. Doubling in 7 years is about 10% a year.'),
  c('business', 'b7', 'Payback period?', 'Initial investment ÷ annual cash inflow: how many years until it is recovered.'),
  c('business', 'b8', 'What is a MECE structure?', 'Mutually exclusive, collectively exhaustive: buckets that do not overlap and together cover the whole problem.'),
  c('business', 'b9', 'Fixed vs variable costs: examples?', 'Fixed: rent, salaried staff, insurance. Variable: materials, packaging, shipping, commissions.'),
  c('business', 'b10', 'Economies of scale?', 'Unit costs fall as volume grows, because fixed costs spread over more units and purchasing power rises.'),
  c('business', 'b11', 'Price elasticity?', '% change in volume ÷ % change in price. Above 1 in absolute value, a price rise lowers revenue.'),
  c('business', 'b12', 'Porter’s five forces?', 'Rivalry among competitors, threat of new entrants, threat of substitutes, power of buyers, power of suppliers.'),
  c('business', 'b13', 'How do you open a case?', 'Repeat the question and goal, ask one or two clarifying questions, take a minute, then present a short structure and say where you want to start.'),
  c('business', 'b14', 'How do you close a case?', 'Recommendation first, the two or three reasons, the main risk, and the next steps.'),
  c('business', 'b15', 'Gross margin vs operating margin?', 'Gross margin: (revenue − cost of goods sold) ÷ revenue. Operating margin also subtracts operating expenses such as sales and admin.'),
]

// ---- Spaced repetition (Leitner boxes) ----

export type Grade = 'again' | 'hard' | 'good' | 'easy'
export type CardState = { box: number; due: number }

const DAY = 86_400_000
/** Days until a card in each box is due again. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35]

/** Again resets to box 0 and comes back in this session; hard stays; good moves up one box; easy two. */
export function schedule(state: CardState | undefined, grade: Grade, now: number): CardState {
  const box = state?.box ?? 0
  const next = grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, box) : grade === 'good' ? box + 1 : box + 2
  const b = Math.min(BOX_DAYS.length - 1, next)
  return { box: b, due: grade === 'again' ? now + 60_000 : now + Math.max(1, grade === 'hard' ? Math.ceil(BOX_DAYS[b]! / 2) : BOX_DAYS[b]!) * DAY }
}

/** Cards to study now: due ones first (oldest due first), then up to `newLimit` never-seen cards. */
export function dueCards(cards: Card[], states: Record<string, CardState>, now: number, newLimit = 10): Card[] {
  const due = cards.filter((x) => states[x.id] && states[x.id]!.due <= now).sort((a, b) => states[a.id]!.due - states[b.id]!.due)
  const fresh = cards.filter((x) => !states[x.id]).slice(0, newLimit)
  return [...due, ...fresh]
}
