// Original workplace scenarios for the sjt engine. Hand-written for Agisse; the key reflects common graduate-employer competency frameworks, not any vendor's scoring.
export type SjtScenario = {
  id: string
  /** The competency the scenario tests, e.g. 'Ownership', 'Teamwork', 'Integrity', 'Client focus', 'Resilience', 'Prioritising', 'Communication', 'Learning'. */
  competency: string
  situation: string
  responses: [string, string, string, string]
  /** Effectiveness of each response, 1 = counterproductive, 2 = fairly ineffective, 3 = fairly effective, 4 = highly effective. */
  ratings: [number, number, number, number]
  /** One or two sentences: why the best response wins and the worst one fails, naming the competency. */
  note: string
}

export const SJT_SCENARIOS: SjtScenario[] = [
  {
    id: 's01',
    competency: 'Prioritising',
    situation:
      'You are a graduate analyst at a strategy consultancy in Amsterdam. On Tuesday morning two managers each ask you for a full day’s work, both due by Wednesday at 9:00. One is a market-sizing model for a pitch; the other is a slide refresh for an existing client’s steering committee. You cannot finish both to a good standard.',
    responses: [
      'Work late on both and hand in whatever you have by the deadline.',
      'Tell both managers about the clash straight away, give an estimate for each task, and ask them to agree which comes first.',
      'Pick the pitch model because new business seems more important, and tell the other manager on Wednesday morning.',
      'Ask a fellow graduate whether they could take on the slide refresh, then let both managers know the plan.',
    ],
    ratings: [2, 4, 1, 3],
    note: 'Prioritising means surfacing a conflict early so the people who own the trade-off can make it. Choosing silently and revealing it at the deadline leaves a manager with no time to react.',
  },
  {
    id: 's02',
    competency: 'Teamwork',
    situation:
      'You are a graduate in an FMCG brand team in Brussels, preparing a launch plan with three other graduates. One teammate has missed two check-ins and their section on retailer pricing is still empty, with the plan due to the brand manager in four days. The rest of the team is getting frustrated and talking about it in a side chat.',
    responses: [
      'Quietly write the pricing section yourself so the plan is complete on time.',
      'Raise it with the brand manager so they can deal with the teammate directly.',
      'Message the teammate privately, ask how things are going, and agree what they can realistically deliver and when.',
      'Suggest in the side chat that the team reallocates the pricing work without involving the teammate.',
    ],
    ratings: [2, 3, 4, 1],
    note: 'Good teamwork starts with a direct, private conversation that may reveal a fixable problem. Reallocating work behind someone’s back damages trust and the team’s ability to work together.',
  },
  {
    id: 's03',
    competency: 'Ownership',
    situation:
      'You are a graduate consultant. Yesterday your team sent a client a deck you built, and this morning you notice a chart in it uses last year’s revenue figures, which overstates growth by several points. Nobody else has spotted it, and the client is presenting the deck to their board next week.',
    responses: [
      'Tell your manager about the error now, bring a corrected chart, and offer to help draft a short note to the client.',
      'Fix the chart in your own files so the next version is right, without mentioning the sent version.',
      'Email the client directly with the corrected chart to save your manager time.',
      'Wait to see if the client raises it, since the overall message of the deck is unchanged.',
    ],
    ratings: [4, 2, 3, 1],
    note: 'Ownership means admitting the mistake quickly and arriving with the fix. Waiting to see if anyone notices risks the client presenting wrong numbers to their board.',
  },
  {
    id: 's04',
    competency: 'Integrity',
    situation:
      'You are a first-year audit associate. Over lunch, a finance manager at the client you are auditing mentions that you also audit their main competitor. He jokes that you must know their margins and asks, half-seriously, whether their costs are higher than his. Your senior is not at the table.',
    responses: [
      'Laugh it off and change the subject without saying anything else.',
      'Give a vague hint that his margins compare well, since it seems harmless and keeps the relationship warm.',
      'Say you would rather not talk about other clients and move on, then mention it to your senior later.',
      'Explain politely that you never share anything about other clients, just as you would never share his information, and move the conversation on.',
    ],
    ratings: [2, 1, 3, 4],
    note: 'Integrity means a clear, polite boundary that also reassures the client their own data is safe. Even a vague hint breaches confidentiality, however harmless it feels.',
  },
  {
    id: 's05',
    competency: 'Ownership',
    situation:
      'You are a graduate in a bank’s operations team in Frankfurt. A colleague went on two weeks’ leave yesterday. This morning a client calls asking about a payment instruction your colleague was handling, and you find no handover note about it. Your team lead is in meetings all day.',
    responses: [
      'Tell the client your colleague is away and that they will call back when they return.',
      'Email your colleague on leave and wait for their reply before doing anything.',
      'Tell the client you will look into it today, check the system and shared inbox for the instruction’s status, and update your team lead by message.',
      'Process the payment based on what the client tells you on the phone, so they are not kept waiting.',
    ],
    ratings: [2, 3, 4, 1],
    note: 'Ownership means picking up the gap and keeping your lead informed. Acting on an unverified phone instruction skips the controls that protect clients and the bank.',
  },
  {
    id: 's06',
    competency: 'Teamwork',
    situation:
      'You are a graduate in a tech company’s product team in Dublin. The team is planning its quarterly social, and the suggestions in the chat are all late-evening bar events. A new colleague who doesn’t drink and has caring duties in the evenings has gone quiet in the thread. The organiser asks everyone to vote by tomorrow.',
    responses: [
      'Vote for the bar option as most people seem keen on it.',
      'Suggest adding a daytime option, such as a team lunch or activity, so everyone can join, without singling anyone out.',
      'Message the new colleague to ask whether they want you to raise their situation with the organiser on their behalf.',
      'Post in the chat that the plans exclude people who don’t drink and ask the team to rethink.',
    ],
    ratings: [1, 4, 3, 2],
    note: 'Inclusive teamwork widens the options for everyone without putting one person on the spot. Going with the majority quietly excludes a colleague who already feels unable to speak up.',
  },
  {
    id: 's07',
    competency: 'Resilience',
    situation:
      'You are a graduate analyst at an investment bank. Your associate returns your first valuation memo covered in comments, saying the logic is hard to follow and that the work “isn’t at the level we need”. You worked late on it for three nights and feel the feedback was blunt. The revised memo is due Friday.',
    responses: [
      'Accept every comment without question and resubmit as quickly as you can.',
      'Tell the associate the tone of the feedback was unfair given the hours you put in.',
      'Take an evening to absorb it, then rework the memo and ask a peer to sanity-check it.',
      'Ask the associate for fifteen minutes to walk through the main comments, confirm what “good” looks like, and then revise.',
    ],
    ratings: [2, 1, 3, 4],
    note: 'Resilience means turning tough feedback into a clear target for the next draft. Arguing about the tone puts the focus on how you feel rather than on improving the work.',
  },
  {
    id: 's08',
    competency: 'Integrity',
    situation:
      'You are a graduate consultant on a project in Milan. After a late client workshop, your team orders dinner to the office. The bill is just over the per-person limit in the expense policy. A colleague suggests splitting it into two receipts so each one falls under the limit and it goes through without questions.',
    responses: [
      'Submit the bill as it is, with a short note explaining the late workshop, and let the approver decide.',
      'Split the receipts as suggested, since the overspend is small and the dinner was for work.',
      'Pay the difference yourself so the claim stays within the limit.',
      'Ask the project manager whether the team should split the receipts this time.',
    ],
    ratings: [4, 1, 3, 2],
    note: 'Integrity means being transparent and letting the policy owner judge the exception. Splitting receipts to dodge a limit is misreporting, however small the amount.',
  },
  {
    id: 's09',
    competency: 'Communication',
    situation:
      'You are a graduate engineer in a team split between Lisbon and Warsaw. You thought a colleague in Warsaw was building the data export feature, but at the weekly call it turns out they thought you were. It is now three days behind. The ticket only said “export – TBD” and there were no meeting notes.',
    responses: [
      'Point out that you assumed they had it because they commented on the ticket first.',
      'Start building the export yourself straight after the call to make up time.',
      'Agree an owner and a new date on the call, update the ticket, and suggest posting short written actions after each meeting.',
      'Escalate to the team lead so they can decide who should have done it.',
    ],
    ratings: [1, 3, 4, 2],
    note: 'Clear communication fixes the immediate gap and the habit that caused it: written owners and actions. Arguing over who assumed what wastes time and sours a remote relationship.',
  },
  {
    id: 's10',
    competency: 'Prioritising',
    situation:
      'You are a graduate policy officer at a European public agency. Your head of unit asks you to “pull together something on e-scooter regulation” before she leaves for a conference, then leaves the room. You are not sure if she wants a one-page summary, a country comparison, or draft recommendations, and you have three other tasks this week.',
    responses: [
      'Produce a detailed country comparison so that whatever she needs will be covered.',
      'Send her a two-line message proposing a one-page summary by Thursday and asking her to confirm or redirect.',
      'Wait until she is back next week and ask her then.',
      'Ask a colleague what she usually means by “something” and go with their view.',
    ],
    ratings: [2, 4, 1, 3],
    note: 'Prioritising an ambiguous brief means proposing a scope and getting a quick yes or no. Waiting a week leaves her without anything and leaves you guessing.',
  },
  {
    id: 's11',
    competency: 'Ownership',
    situation:
      'You are a graduate in an HR advisory team. Minutes ago you emailed a spreadsheet with employees’ names, salaries and sick-leave records to the wrong person at the client, someone with a similar name. Your firm has a data protection officer, and under GDPR some breaches must be reported to the regulator within 72 hours.',
    responses: [
      'Report it to your manager and the data protection officer immediately, with exactly what was sent and to whom.',
      'Try to recall the email and say nothing if the recall seems to work.',
      'Email the recipient asking them to delete the file, then tell your manager at your next one-to-one.',
      'Ask the recipient to delete it and to confirm in writing, before telling your manager the same afternoon.',
    ],
    ratings: [4, 1, 2, 3],
    note: 'Ownership of a data slip means reporting it at once so the right people can meet legal deadlines. Hiding it behind a recall that may have failed puts employees and the firm at risk.',
  },
  {
    id: 's12',
    competency: 'Integrity',
    situation:
      'You are a first-year audit associate. Under deadline pressure, your senior tells you to reduce the number of invoices you test for a client’s revenue, saying “last year was clean, so we can assume it’s fine”. The audit plan set a higher sample size, and nobody has documented a reason to change it.',
    responses: [
      'Follow the instruction, since your senior has more experience and is responsible for the file.',
      'Test the full sample anyway in your own time without mentioning it.',
      'Go straight to the engagement partner to report that your senior is cutting corners.',
      'Ask your senior politely whether the change to the sample should be documented and approved, given the audit plan.',
    ],
    ratings: [1, 3, 2, 4],
    note: 'Integrity can be shown respectfully: asking for the change to be approved and documented protects the audit. Silently following an undocumented shortcut makes you part of it.',
  },
  {
    id: 's13',
    competency: 'Learning',
    situation:
      'You are a graduate in a bank’s risk team. Your manager asks you to automate a weekly report using Python by the end of the month. You have only done a short online course and have never written code for real work. Two colleagues on the team use Python daily, and the firm offers internal training.',
    responses: [
      'Say yes and try to work it out alone so no one doubts your ability.',
      'Be honest about your level, propose a plan using the internal training and a weekly check-in with a colleague, and confirm the deadline is still realistic.',
      'Tell your manager it is outside your skills and suggest one of the experienced colleagues takes it.',
      'Accept and find a ready-made script online that roughly does the job.',
    ],
    ratings: [2, 4, 3, 1],
    note: 'A learning mindset means stretching while being honest about the gap and using the support available. Running untested code from the internet in a risk report could produce errors nobody can explain.',
  },
  {
    id: 's14',
    competency: 'Client focus',
    situation:
      'You are a graduate key-account assistant at a food manufacturer. A supermarket buyer calls, angry that a delivery arrived two days late and short by forty cases ahead of a weekend promotion. You can see the order details but don’t know why it went wrong. Your account manager is on a flight until this evening.',
    responses: [
      'Explain that logistics is a different department and give the buyer their contact details.',
      'Tell the buyer your account manager will call when she lands this evening.',
      'Acknowledge the problem, promise to find out what happened and what can still be delivered before the weekend, and call back within two hours.',
      'Offer the buyer a discount on the next order straight away to calm the situation.',
    ],
    ratings: [1, 2, 4, 3],
    note: 'Client focus means owning the customer’s problem and committing to a specific next step. Sending an upset buyer to another department makes the problem theirs to chase.',
  },
  {
    id: 's15',
    competency: 'Teamwork',
    situation:
      'You are a graduate in a consulting team’s weekly meeting. A quiet colleague starts to share an idea about the client’s supply chain but is talked over twice by a louder senior consultant, and the discussion moves on. You heard enough to think her point was relevant to the problem the team is stuck on.',
    responses: [
      'Present the idea yourself later, since what matters is that it gets heard.',
      'Say nothing in the meeting and tell her afterwards that she should speak up more.',
      'Tell the senior consultant after the meeting that he keeps interrupting people.',
      'When there is a pause, say you would like to hear the rest of her point about the supply chain, and hand back to her.',
    ],
    ratings: [1, 2, 3, 4],
    note: 'Good teamwork creates space for others in the moment, so the idea is heard and credited to her. Presenting it yourself takes credit and leaves the pattern unchanged.',
  },
  {
    id: 's16',
    competency: 'Resilience',
    situation:
      'You are a graduate in a tech firm’s marketing team. For six weeks you led the research for a new campaign, often working evenings. This morning leadership cancelled the campaign because of budget cuts, and your work will not be used. You feel deflated, and your manager has asked you to start on a new brief tomorrow.',
    responses: [
      'Note what you learned from the research, ask your manager whether any of it can feed into future work, and start the new brief.',
      'Start the new brief but put in only the minimum effort, since work can be cancelled at any time.',
      'Ask your manager for a day to recover before you start the new brief.',
      'Tell colleagues you are frustrated with leadership’s decision so they know how much you put in.',
    ],
    ratings: [4, 1, 3, 2],
    note: 'Resilience means accepting the setback, keeping the value of the work and moving on. Pulling back effort turns one disappointment into a lasting performance problem.',
  },
  {
    id: 's17',
    competency: 'Communication',
    situation:
      'You are a graduate analyst on a cost-reduction project. Your analysis shows the savings the client’s CFO announced internally are about half what is realistic. Your manager asks you to present this finding in a ten-minute slot at tomorrow’s meeting with the CFO, who is known to be impatient and dislikes long presentations.',
    responses: [
      'Present the full methodology first so the CFO trusts the analysis before hearing the result.',
      'Open with the headline gap and its main causes, keep the detail in an appendix, and suggest options to close it.',
      'Soften the finding by calling it a range and avoid stating a firm number.',
      'Ask your manager to deliver the finding instead because it will land better from someone senior.',
    ],
    ratings: [2, 4, 1, 3],
    note: 'Effective communication leads with the answer and gives a way forward. Blurring the number to avoid discomfort leaves the CFO with a misleading picture.',
  },
  {
    id: 's18',
    competency: 'Learning',
    situation:
      'You are a graduate on rotation, moving from a retail client to an energy company. In your first week the client uses terms like “hedging ratio” and “capacity market” that you don’t understand, and you have struggled to follow meetings. The team is busy and your next client workshop is in ten days.',
    responses: [
      'Keep quiet in meetings and hope the terms become clear over time.',
      'Ask the client directly to explain each term as it comes up in meetings.',
      'Read general industry reports in the evenings without asking anyone.',
      'Keep a list of unclear terms, read up on them, and book a short session with a teammate to check your understanding before the workshop.',
    ],
    ratings: [1, 2, 3, 4],
    note: 'Learning works best when it is structured and checked against someone who knows. Staying silent and hoping lets the gap grow until it shows in front of the client.',
  },
  {
    id: 's19',
    competency: 'Client focus',
    situation:
      'You are a graduate consultant working on site at a logistics client. A client manager you get on well with asks if you could “quickly” add a new warehouse analysis to your work. It is not in the agreed scope and would take you about two days. Your engagement manager is at another client today.',
    responses: [
      'Agree and do the extra analysis in the evenings so the client stays happy.',
      'Tell the client manager it is out of scope and that they will need to raise a change request.',
      'Say you are keen to help, explain you need to check it with your engagement manager because of the timeline, and get back to them today.',
      'Agree to do a lighter version of the analysis in half a day without telling your manager.',
    ],
    ratings: [1, 3, 4, 2],
    note: 'Client focus balances enthusiasm with keeping the engagement on track. Quietly taking on two days of unscoped work risks the agreed deliverables and sets an expectation your team didn’t agree to.',
  },
  {
    id: 's20',
    competency: 'Prioritising',
    situation:
      'You are a graduate in a corporate finance team. It is 14:00 and you have three tasks: a reconciliation your manager needs by 17:00 for month-end close, a colleague’s request to proofread a newsletter “when you can”, and forty unread emails. You also promised to help organise next month’s team offsite.',
    responses: [
      'Block the afternoon for the reconciliation, check emails briefly for anything urgent, and tell your colleague you can proofread tomorrow.',
      'Clear your inbox first so nothing is missed, then start the reconciliation.',
      'Do the quick proofread first to get it off your list, then focus on the reconciliation.',
      'Spend the time on offsite planning while you wait for the last numbers for the reconciliation to arrive.',
    ],
    ratings: [4, 2, 3, 1],
    note: 'Prioritising means protecting the deadline that matters most and setting expectations on the rest. Drifting to low-urgency work risks missing the month-end close.',
  },
  {
    id: 's21',
    competency: 'Resilience',
    situation:
      'You are a graduate trainee in an accountancy firm studying for professional exams alongside work. You have just learned you failed one module by a few marks. Your peer group mostly passed, a busy season is starting at work, and the resit is in three months. You feel embarrassed to tell your counsellor.',
    responses: [
      'Hold off on telling your counsellor until you have passed the resit.',
      'Defer the resit to next year so it does not clash with the busy season.',
      'Tell your counsellor, review where you lost marks, and agree a study plan that fits around the busy season.',
      'Book extra tutoring and plan to study every weekend until the resit.',
    ],
    ratings: [1, 2, 4, 3],
    note: 'Resilience means facing the setback openly and building a realistic plan to recover. Hiding the result from your counsellor removes the support and flexibility you will need.',
  },
  {
    id: 's22',
    competency: 'Communication',
    situation:
      'You are a graduate on a city council’s digital team. Next month the council moves its parking-permit applications online. You are asked to brief the front-desk staff, many of whom are not confident with technology and are worried about residents’ questions. You have prepared a 25-slide technical overview of the new system.',
    responses: [
      'Present the full technical overview so staff have every detail they might need.',
      'Email the slides to staff and invite them to send questions.',
      'Ask the IT supplier to run the briefing because they know the system best.',
      'Run a short session focused on what changes for residents and staff, demo the main steps, and leave a one-page guide to common questions.',
    ],
    ratings: [2, 1, 3, 4],
    note: 'Good communication fits the message to the audience’s needs and concerns. Emailing a dense technical deck to worried staff leaves them unprepared for residents’ questions.',
  },
]
