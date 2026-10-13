// Assessment centre kit, no model: a day-of checklist per country, group exercise briefs with the behaviours
// assessors score, and in-tray packs scored against a key.

// ---- Day-of checklist ----

export type CountryGuide = { name: string; dress: string; punctuality: string; address: string; greeting: string; bring: string; travel: string; ask: [string, string, string] }

const ASK_DEFAULT: [string, string, string] = [
  'What does a good first six months look like in this role?',
  'How do graduates get feedback, and how often?',
  'What do people who do well here have in common?',
]

/** General norms to check against the invitation; the employer's own dress code always wins. */
export const COUNTRIES: Record<string, CountryGuide> = {
  BE: { name: 'Belgium', dress: 'Banking, law, consulting: dark suit. Tech and start-ups: smart casual. Public sector and EU institutions: suit or blazer.', punctuality: 'Arrive 10 minutes early.', address: 'Use “Meneer/Mevrouw” or “Monsieur/Madame” with the surname until told otherwise; check whether the interview runs in Dutch, French or English.', greeting: 'Firm, brief handshake with everyone on the panel.', bring: 'ID, printed CV, the invitation, a notepad and a pen.', travel: 'Rail and Brussels ring-road delays are common: plan one train earlier.', ask: ASK_DEFAULT },
  NL: { name: 'Netherlands', dress: 'Finance and law: suit, tie often optional. Consulting: suit or smart blazer. Tech and start-ups: neat casual.', punctuality: 'On time means on time; 5 to 10 minutes early.', address: 'First names are normal, even with seniors. Directness is expected: answer the question asked.', greeting: 'Handshake and say your first and last name.', bring: 'ID, CV, a notepad and a pen.', travel: 'Check NS for engineering works; cycling? Allow time to park and cool down.', ask: ['How are decisions made in the team?', 'What would you expect from me in the first three months?', 'What is the hardest part of this role?'] },
  FR: { name: 'France', dress: 'Banking, law, consulting: dark suit, conservative. Tech: smart casual, still polished.', punctuality: 'Arrive 10 minutes early; a late panel is not a sign you can be late.', address: '“Monsieur/Madame” with the surname and “vous” throughout, unless invited otherwise. Your degree and school matter here: be ready to explain them.', greeting: 'Handshake; “Bonjour Madame/Monsieur” on entering.', bring: 'ID, CV, copies of diplomas if asked, a notepad.', travel: 'Check for strikes the evening before and plan a second route.', ask: ASK_DEFAULT },
  DE: { name: 'Germany', dress: 'Banking, law, industry: dark suit. Consulting: suit. Tech: smart casual.', punctuality: 'Arrive 10 minutes early. Lateness is noticed.', address: '“Herr/Frau” with the surname and “Sie”. Use titles such as “Dr.” when known.', greeting: 'Firm handshake and eye contact with each person.', bring: 'ID, CV, copies of certificates and references (Zeugnisse) if asked, a notepad.', travel: 'Deutsche Bahn delays are frequent: aim to arrive 30 minutes early nearby.', ask: ['How is the onboarding for graduates structured?', 'Which projects would I join first?', 'How is performance assessed in the first year?'] },
  LU: { name: 'Luxembourg', dress: 'Banking, funds, Big Four, EU bodies: dark suit.', punctuality: 'Arrive 10 minutes early.', address: 'Formal: “Monsieur/Madame” or “Herr/Frau”. Interviews often switch between French, German and English: say which you are comfortable in.', greeting: 'Handshake with each panel member.', bring: 'ID, CV, a notepad.', travel: 'Cross-border traffic jams at rush hour: plan for them.', ask: ASK_DEFAULT },
  UK: { name: 'United Kingdom', dress: 'Banking, law: suit. Consulting: suit or smart business. Tech and the public sector: smart casual unless told otherwise.', punctuality: 'Arrive 10 minutes early; check in at reception.', address: 'First names are common; follow the interviewer’s lead.', greeting: 'Handshake and a short “Nice to meet you”.', bring: 'Photo ID, plus right-to-work documents if requested, a notepad.', travel: 'Check for rail strikes and planned engineering works.', ask: ASK_DEFAULT },
  IE: { name: 'Ireland', dress: 'Finance and law: suit. Tech multinationals: smart casual.', punctuality: 'Arrive 10 minutes early.', address: 'First names, friendly and informal tone; keep the content sharp.', greeting: 'Handshake and small talk; it is part of the assessment.', bring: 'ID, CV, a notepad.', travel: 'Dublin traffic is slow at rush hour: leave early.', ask: ASK_DEFAULT },
  ES: { name: 'Spain', dress: 'Banking, law, consulting: suit. Tech: smart casual.', punctuality: 'Be on time even if the panel runs late.', address: '“Usted” at first; many switch to “tú” quickly. Follow their lead.', greeting: 'Handshake; colleagues may greet each other with two kisses, but not you at an interview.', bring: 'ID (DNI/NIE or passport), CV, a notepad.', travel: 'Check the timetable for long lunch breaks if your slot is mid-day.', ask: ASK_DEFAULT },
  IT: { name: 'Italy', dress: 'Polished and well cut: suit in banking, law and consulting; smart in tech.', punctuality: 'Be on time; meetings may start a little late.', address: '“Lei” and titles such as “Dottore/Dottoressa” or “Ingegnere”.', greeting: 'Firm handshake and eye contact.', bring: 'ID, CV, a notepad.', travel: 'Check Trenitalia and local strikes the day before.', ask: ASK_DEFAULT },
  NORDICS: { name: 'Nordics', dress: 'Often smart casual even in finance; a blazer is safe. Check the invitation.', punctuality: 'Strictly on time.', address: 'First names, flat hierarchy. Modesty is valued: let examples speak rather than self-praise.', greeting: 'Handshake and eye contact.', bring: 'ID, CV, a notepad.', travel: 'Winter weather: allow extra time from November to March.', ask: ['How does the team give feedback?', 'How much autonomy would I have in the first year?', 'What does a normal working week look like?'] },
  CH: { name: 'Switzerland', dress: 'Banking, insurance, pharma, consulting: dark suit, very polished.', punctuality: 'Arrive 5 to 10 minutes early; trains run to the minute, so should you.', address: 'Formal: “Herr/Frau”, “Monsieur/Madame” and “Sie/vous”. Check the language of the interview.', greeting: 'Firm handshake with each person.', bring: 'ID, CV, copies of diplomas and references (Arbeitszeugnisse) if asked.', travel: 'Book the train one connection earlier than needed.', ask: ASK_DEFAULT },
}

// ---- Group exercise ----

/** What assessors tick on a group exercise grid. */
export const BEHAVIOURS = [
  'Opened with a structure or plan',
  'Invited quiet members in',
  'Built on others’ ideas by name',
  'Disagreed with reasons',
  'Kept time',
  'Summarised to a decision',
] as const

export type GroupBrief = { id: string; title: string; minutes: number; brief: string; facts: string[]; task: string }

export const GROUP_BRIEFS: GroupBrief[] = [
  {
    id: 'budget',
    title: 'Split a €50,000 graduate fund',
    minutes: 25,
    brief: 'You are the graduate committee of a 400-person firm. Next year’s €50,000 fund must be split across these proposals. Not everything can be funded.',
    facts: [
      'Mentoring programme: €15,000, every graduate gets a senior mentor.',
      'Mental-health app licences: €12,000 for all staff.',
      'Two-day offsite for 60 graduates: €28,000.',
      'Language courses: €8,000 for 20 people.',
      'Charity volunteering days: €5,000 for organisation and transport.',
      'Hackathon with university students: €18,000, also a recruiting channel.',
    ],
    task: 'Agree the split, with a reason for each item funded or cut, and present it in two minutes at the end.',
  },
  {
    id: 'cities',
    title: 'Rank five cities for a bike-share launch',
    minutes: 25,
    brief: 'A bike-share start-up can launch in one new city next spring. You have the summary below.',
    facts: [
      'Lyon: 520k people, many cycle lanes, one strong competitor.',
      'Ghent: 265k people, car-free centre, no competitor, small market.',
      'Leipzig: 620k people, growing, few cycle lanes, city council supportive.',
      'Porto: 230k people (1.7m metro), hilly, many tourists, no competitor.',
      'Aarhus: 360k people, high cycling culture, high costs, one weak competitor.',
    ],
    task: 'Rank the cities, choose one, and name the biggest risk and how to test it within three months.',
  },
  {
    id: 'charity',
    title: 'Pick a three-year charity partner',
    minutes: 20,
    brief: 'Your firm will support one charity for three years with money and staff volunteering. Staff voted, but the board wants a reasoned recommendation.',
    facts: [
      'Food bank network: most staff votes, easy volunteering, little link to the firm’s skills.',
      'Coding school for refugees: uses staff skills, needs weekly volunteers, small reach.',
      'Rewilding project: popular with clients, volunteering only in summer, results take years.',
      'Youth mental-health line: urgent need, training required before volunteering.',
    ],
    task: 'Agree one partner, the criteria you used, and how you will know after a year that it works.',
  },
]

export type GroupSession = { briefId: string; at: string; scores: number[] }

/** A session's score as a share of the maximum (each behaviour 0–3). */
export const groupPct = (scores: number[]) => Math.round((scores.reduce((a, b) => a + b, 0) / (BEHAVIOURS.length * 3)) * 100)

// ---- In-tray / e-tray ----

export const TRAY_ACTIONS = { now: 'Do now', delegate: 'Delegate', schedule: 'Schedule', drop: 'Drop' } as const
export type TrayAction = keyof typeof TRAY_ACTIONS
export type TrayItem = { id: string; from: string; subject: string; body: string; key: TrayAction; why: string }
export type TrayPack = { id: string; title: string; scene: string; minutes: number; items: TrayItem[] }

const t = (id: string, from: string, subject: string, body: string, key: TrayAction, why: string): TrayItem => ({ id, from, subject, body, key, why })

export const TRAY_PACKS: TrayPack[] = [
  {
    id: 'logistics',
    title: 'Graduate analyst, logistics firm',
    scene: 'Monday 8:30. Your manager, Sara, is on leave until Thursday. You have a team of two interns, Tom and Lina.',
    minutes: 20,
    items: [
      t('l1', 'Key client (Rotterdam)', 'Shipment stuck at customs', 'Our 40 containers are held at customs since Saturday. We need to know by 11:00 whether they leave today.', 'now', 'Client-facing, time-critical and only you can coordinate it while Sara is away.'),
      t('l2', 'HR', 'Reminder: training survey', 'Please complete the onboarding survey by the end of the month.', 'schedule', 'Required but not urgent; put it in your calendar.'),
      t('l3', 'Tom (intern)', 'Can’t log in to the planning tool', 'My account is locked, so I can’t start the weekly report.', 'delegate', 'IT helpdesk fixes it; point Tom there and check later.'),
      t('l4', 'Finance', 'Invoice data needed today', 'We need last month’s fuel costs by 17:00 for the quarterly close.', 'now', 'Hard same-day deadline that affects reporting.'),
      t('l5', 'Supplier newsletter', '10 trends in warehousing', 'Our monthly round-up of industry news.', 'drop', 'Nice to read, no action needed.'),
      t('l6', 'Sara (manager), auto-reply', 'Out of office', 'I am on leave until Thursday. For urgent matters contact Marc.', 'drop', 'Information only; note that Marc is the escalation point.'),
      t('l7', 'Marc (Sara’s peer)', 'Can you cover the Wednesday ops call?', 'Sara usually runs it. Can you present the weekly numbers?', 'schedule', 'Accept and block prep time before Wednesday.'),
      t('l8', 'Lina (intern)', 'Data clean-up done', 'I finished cleaning the route data. Should I start on the cost model?', 'delegate', 'Give Lina the next task with clear instructions.'),
      t('l9', 'Warehouse lead', 'Safety incident, forklift', 'A minor forklift collision this morning; nobody hurt. Report form attached.', 'now', 'Safety comes first: acknowledge and make sure it is reported properly today.'),
      t('l10', 'Recruiter (another firm)', 'Exciting opportunity', 'Would you like to chat about a role at our company?', 'drop', 'Not related to your work.'),
      t('l11', 'Client (Antwerp)', 'Quote for Q3', 'Could you send a quote for Q3 volumes when you have a moment? No rush this week.', 'schedule', 'Real work, explicitly not urgent: plan it.'),
      t('l12', 'Facilities', 'Parking spaces reassigned', 'From next month, parking is allocated by request. Reply if you need a space.', 'schedule', 'Quick reply, but nothing breaks today.'),
    ],
  },
  {
    id: 'policy',
    title: 'Policy officer, regional government',
    scene: 'Thursday 9:00. You leave at 15:00 for a two-day training. Your colleague Ahmed covers your inbox while you are away.',
    minutes: 20,
    items: [
      t('p1', 'Director’s office', 'Briefing for tomorrow’s debate', 'The director needs a one-page briefing on the cycling budget by 13:00 today.', 'now', 'Senior, hard deadline before you leave.'),
      t('p2', 'Journalist', 'Comment on cycling budget?', 'Can you give us a quote on the new budget for tomorrow’s paper?', 'delegate', 'Officers do not speak to the press; forward to the press office.'),
      t('p3', 'Citizen', 'Pothole on my street', 'There has been a dangerous pothole on Kerkstraat for weeks.', 'delegate', 'Belongs to the roads department; forward and reply that you did.'),
      t('p4', 'Ahmed (colleague)', 'Handover?', 'Can we do a 15-minute handover before you leave?', 'now', 'Cheap and protects everything else while you are away: book it today.'),
      t('p5', 'Training provider', 'Pre-reading', 'Please read the attached 20 pages before Friday’s session.', 'schedule', 'Needed for tomorrow, but after the urgent work.'),
      t('p6', 'Statistics unit', 'New traffic data available', 'The Q2 traffic counts are published on the intranet.', 'schedule', 'Useful for later analysis; not today.'),
      t('p7', 'Mailing list', 'Lunchtime yoga is back!', 'Join us every Tuesday at 12:30.', 'drop', 'Not work-critical.'),
      t('p8', 'Finance', 'Budget line error', 'Line 4.2 of your draft budget double-counts the bike-parking grant. Please correct before Monday’s sign-off.', 'delegate', 'Ahmed can correct it before Monday; give him the details in the handover.'),
      t('p9', 'Minister’s office', 'Question from parliament', 'A written question on cycling deaths needs a draft answer within 10 working days.', 'schedule', 'Important, deadline far enough to plan after training.'),
      t('p10', 'Unknown sender', 'Your account will be closed', 'Click this link to confirm your password.', 'drop', 'Phishing: do not click; report it if there is a process.'),
      t('p11', 'Mayor’s office', 'Event invitation', 'Would you attend the opening of the new bike bridge next month?', 'schedule', 'Reply after checking with your manager; not urgent.'),
      t('p12', 'Manager', 'Quick check on the briefing', 'Send me the briefing draft before it goes to the director, please.', 'now', 'Part of the 13:00 deadline: plan time for review.'),
    ],
  },
]

/** One point for the key's action; half a point when both are things you do yourself (now vs schedule). */
export function scoreTray(pack: TrayPack, answers: Partial<Record<string, TrayAction>>) {
  const items = pack.items.map((it) => {
    const got = answers[it.id] ?? null
    const points = got === it.key ? 1 : got && [got, it.key].every((a) => a === 'now' || a === 'schedule') ? 0.5 : 0
    return { item: it, got, points }
  })
  const points = items.reduce((a, b) => a + b.points, 0)
  return { items, points, pct: Math.round((points / pack.items.length) * 100) }
}
