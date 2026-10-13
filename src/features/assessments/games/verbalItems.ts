// Original True / False / Cannot say passages for the verbal-tfc engine. Hand-written for Agisse; not taken from any test vendor.
export type Tfc = 'true' | 'false' | 'cannot-say'
export type VerbalPassage = { id: string; topic: string; text: string; statements: { text: string; answer: Tfc; why: string }[] }

export const VERBAL_PASSAGES: VerbalPassage[] = [
  {
    id: 'v01',
    topic: 'Warehouse automation',
    text: "Kestrel Freight, a logistics company based in the fictional port city of Vardholm, began automating its warehouses in 2023. By the end of 2025, robotic picking systems had been installed in nine of its fourteen depots. The remaining five depots are smaller sites, and the company has said that automating them would not be cost-effective at current volumes. According to Kestrel's annual report, average order-processing time at automated depots fell from 42 minutes to 19 minutes. Over the same period, the company's workforce grew slightly, as staff were redeployed to maintenance and quality-control roles rather than made redundant. Kestrel plans to review the case for the smaller depots in 2027, once a new generation of compact picking robots becomes commercially available.",
    statements: [
      {
        text: "Most of Kestrel Freight's depots had robotic picking systems by the end of 2025.",
        answer: 'true',
        why: 'Nine of fourteen depots had been automated, which is a majority.',
      },
      {
        text: 'Kestrel Freight cut jobs as a result of automating its warehouses.',
        answer: 'false',
        why: "The workforce grew and staff were redeployed 'rather than made redundant'.",
      },
      {
        text: 'The fall in order-processing time was caused entirely by the robotic picking systems.',
        answer: 'cannot-say',
        why: 'The passage reports the fall at automated depots but never says robots were the only cause.',
      },
    ],
  },
  {
    id: 'v02',
    topic: 'Offshore wind',
    text: 'In March 2026 the government of the fictional state of Norland held its third offshore wind auction, offering contracts for 3.2 gigawatts of capacity. Seven consortia submitted bids, and four were successful. Unlike in the two previous rounds, bidders were scored not only on price but also on their plans for recycling turbine blades at the end of their working life; this criterion accounted for 15 per cent of the total score. The winning strike prices averaged €58 per megawatt-hour, about 10 per cent higher than in the 2024 round. Officials attributed the increase to higher steel and financing costs. Construction of the first project must begin by 2028, or the contract will lapse unless the developer can show that delays were caused by grid connection works.',
    statements: [
      {
        text: "Recycling plans were a scoring criterion in Norland's 2024 offshore wind auction.",
        answer: 'false',
        why: "The recycling criterion was new: it applied 'unlike in the two previous rounds', which include 2024.",
      },
      {
        text: 'More than half of the consortia that bid were awarded contracts.',
        answer: 'true',
        why: 'Four of the seven bidding consortia were successful, which is more than half.',
      },
      {
        text: "Price accounted for 85 per cent of each bid's score.",
        answer: 'cannot-say',
        why: 'Only the 15 per cent recycling weight is given; other criteria besides price may exist.',
      },
    ],
  },
  {
    id: 'v03',
    topic: 'Congestion charge',
    text: 'The fictional city of Lindmark introduced a congestion charge in its historic centre in September 2024. Drivers entering the zone between 7 a.m. and 7 p.m. on weekdays pay €6 per day; entry at weekends is free. Electric vehicles were exempt until January 2026, when they began paying half the standard rate. Residents of the zone receive a 90 per cent discount, and registered disabled drivers pay nothing. In the first year, traffic entering the zone during charging hours fell by 18 per cent, while bus ridership on routes serving the centre rose by 11 per cent. Revenue from the charge, after operating costs, must by law be spent on public transport and cycling infrastructure within the city.',
    statements: [
      {
        text: 'In February 2026, a non-resident without a disability exemption, driving an electric car into the zone at 9 a.m. on a Tuesday, paid €3.',
        answer: 'true',
        why: 'From January 2026 electric vehicles pay half the €6 weekday rate, which is €3.',
      },
      {
        text: 'The rise in bus ridership was caused by the congestion charge.',
        answer: 'cannot-say',
        why: 'The two changes happened in the same year, but the passage does not say one caused the other.',
      },
      {
        text: 'Drivers entering the zone on a Saturday afternoon pay the standard €6 charge.',
        answer: 'false',
        why: "The passage states that 'entry at weekends is free'.",
      },
    ],
  },
  {
    id: 'v04',
    topic: 'Clinical trial',
    text: 'Halvern Biotech, a fictional pharmaceutical company, has completed a phase II trial of HB-207, an experimental treatment for chronic migraine. The trial enrolled 340 adult patients across 22 clinics in four EU countries. Half received HB-207 and half received a placebo, and neither patients nor doctors knew who was in which group. After twelve weeks, patients on HB-207 reported an average of 4.1 fewer migraine days per month, compared with 1.6 fewer days in the placebo group. Mild nausea was the most common side effect. Halvern intends to begin a larger phase III trial in 2027, subject to approval from regulators. The company has not yet decided whether to seek a partner to share the costs of the next phase.',
    statements: [
      {
        text: 'Neither the patients nor their doctors knew whether a patient was receiving HB-207.',
        answer: 'true',
        why: "The passage says 'neither patients nor doctors knew who was in which group'.",
      },
      {
        text: 'Patients in the placebo group reported no reduction in migraine days.',
        answer: 'false',
        why: 'The placebo group reported 1.6 fewer migraine days per month on average.',
      },
      {
        text: 'Each of the four countries hosted the same number of trial clinics.',
        answer: 'false',
        why: '22 clinics cannot be divided equally between four countries (22 ÷ 4 = 5.5), so they cannot each have hosted the same number.',
      },
    ],
  },
  {
    id: 'v05',
    topic: 'Remote work',
    text: 'From 1 April 2026, staff at Corvane Bank, a fictional lender with 6,500 employees, are required to work from the office at least three days a week, up from two. The rule applies to all head-office and regional staff, with two exceptions: employees with a documented medical need, and those in specialist IT roles hired on fully remote contracts before 2025. Managers may approve a temporary return to two office days for up to three months to support caring responsibilities. The bank said the change was intended to improve the training of junior staff, who had told an internal survey that they learned more when working alongside colleagues. Branch staff were not affected, as they already work on site full time.',
    statements: [
      {
        text: 'Every Corvane Bank employee must now spend at least three days a week in the office.',
        answer: 'false',
        why: 'Staff with a documented medical need and certain remote IT specialists are exempt.',
      },
      {
        text: 'An IT specialist hired on a fully remote contract in 2023 is exempt from the three-day rule.',
        answer: 'true',
        why: 'Specialist IT staff on fully remote contracts hired before 2025 are named as an exception.',
      },
      {
        text: 'The training of junior staff has improved since the policy came into effect.',
        answer: 'cannot-say',
        why: 'Better training is stated only as the aim; no results after April 2026 are reported.',
      },
    ],
  },
  {
    id: 'v06',
    topic: 'Returns policy',
    text: "Brightwell, a fictional clothing retailer operating in six EU countries, changed its returns policy in January 2026. Customers still have 30 days to return items bought online, but returns sent by post now cost €2.95, deducted from the refund. Returns made in any Brightwell store remain free. Members of the retailer's loyalty scheme are exempt from the postal fee, as are customers returning faulty goods. Swimwear and underwear can be returned only if the hygiene seal is intact. Brightwell said that about one in three online orders had been at least partly returned in 2025, and that the cost of handling postal returns had risen sharply. The company expects the new fee to reduce postal returns but has not published a target.",
    statements: [
      {
        text: 'A customer who returns a faulty item by post does not pay the €2.95 fee.',
        answer: 'true',
        why: 'Customers returning faulty goods are explicitly exempt from the postal fee.',
      },
      {
        text: 'Brightwell aims to cut postal returns by a third.',
        answer: 'cannot-say',
        why: 'The company expects a reduction but has not published a target, so its aim is unknown.',
      },
      {
        text: 'The returns window for online purchases was shortened in January 2026.',
        answer: 'false',
        why: "Customers 'still have 30 days', so the window did not change.",
      },
    ],
  },
  {
    id: 'v07',
    topic: 'Rail liberalisation',
    text: "Since December 2025, the fictional country of Estmark has allowed private operators to run passenger trains on its main intercity line, ending the state operator's 70-year monopoly. Two new entrants, Arrow Rail and Lumo Transit, were granted access to the line. Arrow Rail began services in February 2026; Lumo Transit's launch has been postponed to 2027 because its new trains have not yet been certified. The state operator continues to run the majority of daily services. In Arrow Rail's first six months, average advance fares on the line fell by 14 per cent, according to the national rail regulator. Track access charges are set by the infrastructure manager and are the same for every operator, regardless of size.",
    statements: [
      {
        text: 'Lumo Transit began running services before Arrow Rail.',
        answer: 'false',
        why: "Arrow Rail started in February 2026, while Lumo Transit's launch is postponed to 2027.",
      },
      {
        text: 'Advance fares fell because of competition from Arrow Rail.',
        answer: 'cannot-say',
        why: "Fares fell during Arrow Rail's first six months, but no cause is given for the fall.",
      },
      {
        text: 'The state operator still runs more than half of the daily services on the line.',
        answer: 'true',
        why: "It 'continues to run the majority of daily services'.",
      },
    ],
  },
  {
    id: 'v08',
    topic: 'Food labelling',
    text: 'Under new rules adopted by the fictional Alpine Union in 2025, pre-packed foods sold in member states must display a colour-coded nutrition label on the front of the pack from July 2027. The label grades products from A (healthiest) to E. Small producers with fewer than ten employees are exempt until 2029, and products sold loose, such as bakery items wrapped at the point of sale, are not covered at all. The grade is calculated per 100 grams, not per portion, which critics say penalises products such as olive oil that are eaten in small quantities. Manufacturers may display additional information, but it must not be larger than the official label. Supermarket own-brand products are treated in the same way as branded goods.',
    statements: [
      {
        text: 'Bread wrapped at a bakery counter must show the label from July 2027.',
        answer: 'false',
        why: "Bakery items wrapped at the point of sale 'are not covered at all'.",
      },
      {
        text: 'Olive oil will receive a grade of D or E.',
        answer: 'cannot-say',
        why: "Critics say olive oil is penalised, but the passage never gives its actual grade.",
      },
      {
        text: 'Pre-packed supermarket own-brand products are covered by the same labelling rules as branded goods.',
        answer: 'true',
        why: "Own-brand products 'are treated in the same way as branded goods'.",
      },
    ],
  },
  {
    id: 'v09',
    topic: 'Startup funding',
    text: "Quillio, a fictional Lisbon-based startup that sells scheduling software to dental clinics, has raised €18 million in a Series A funding round. The round was led by a venture capital fund that had not previously invested in the company; two existing investors also took part. Quillio said it would use the money to expand into Spain and Italy and to double its engineering team, currently 40 people, by the end of 2027. The company's annual recurring revenue reached €4.5 million in 2025, up from €1.9 million a year earlier. Quillio is not yet profitable and does not expect to break even before 2028. Its founders retain a majority of the shares after the round.",
    statements: [
      {
        text: 'All of the investors in the Series A round were new to Quillio.',
        answer: 'false',
        why: 'Two existing investors also took part alongside the new lead fund.',
      },
      {
        text: "Quillio's annual recurring revenue more than doubled between 2024 and 2025.",
        answer: 'true',
        why: 'It rose from €1.9 million to €4.5 million, which is more than double.',
      },
      {
        text: "The lead investor received a seat on Quillio's board.",
        answer: 'cannot-say',
        why: 'The passage says nothing about board seats or governance terms.',
      },
    ],
  },
  {
    id: 'v10',
    topic: 'Battery recycling',
    text: 'A fictional recycling plant operated by Reclaim Metals near the town of Sorvik processes used lithium-ion batteries from electric vehicles. The plant opened in 2024 with an annual capacity of 25,000 tonnes and ran at roughly 60 per cent of capacity in its first full year, because fewer vehicles than expected reached the end of their lives. The process recovers over 90 per cent of the lithium, cobalt and nickel in each battery, which is then sold to cathode manufacturers. Batteries from electric buses are accepted, but those from e-scooters are not, as their varied designs make dismantling too costly. Reclaim Metals has said it will not build a second plant until the first operates at no less than 85 per cent of capacity.',
    statements: [
      {
        text: 'In its first full year, the plant processed roughly 15,000 tonnes of batteries.',
        answer: 'true',
        why: 'Roughly 60 per cent of a 25,000-tonne capacity is about 15,000 tonnes.',
      },
      {
        text: 'The plant accepts batteries from e-scooters.',
        answer: 'false',
        why: 'E-scooter batteries are explicitly not accepted because dismantling them is too costly.',
      },
      {
        text: 'Reclaim Metals will build a second plant once the first reaches 85 per cent of capacity.',
        answer: 'cannot-say',
        why: "85 per cent is stated as a minimum condition ('not until'), not a promise to build.",
      },
    ],
  },
  {
    id: 'v11',
    topic: 'University admissions',
    text: 'From the 2027 intake, the fictional University of Marrenburg will stop requiring an entrance exam for its undergraduate economics programme. Instead, applicants will be ranked on their final school grades and a short written statement. The exam will remain in place for medicine and law, which receive the most applications per place. The university said the change aimed to widen access, noting that applicants from lower-income households were less likely to have paid for exam preparation courses. Some lecturers have warned that school grades are harder to compare across countries. International applicants will be required to submit a recognised English-language certificate, as all economics teaching is in English. The number of places on the programme, 420, will not change.',
    statements: [
      {
        text: 'Applicants for medicine at Marrenburg will no longer sit an entrance exam from 2027.',
        answer: 'false',
        why: "The exam 'will remain in place for medicine and law'.",
      },
      {
        text: 'The number of places on the economics programme will stay at 420.',
        answer: 'true',
        why: "The passage says the number of places, 420, 'will not change'.",
      },
      {
        text: 'Most Marrenburg lecturers oppose the change.',
        answer: 'cannot-say',
        why: "Only 'some lecturers' raised a concern; the view of most lecturers is not given.",
      },
    ],
  },
  {
    id: 'v12',
    topic: 'Coffee supply',
    text: 'Tavira Roasters, a fictional coffee company based in Antwerp, buys green beans from cooperatives in Colombia, Ethiopia and Honduras. Since 2024 it has paid a fixed premium of 20 per cent above the international market price to cooperatives that meet its environmental standards, which include no deforestation since 2020. Eleven of the fourteen cooperatives it works with currently qualify. Beans from Ethiopia make up the largest share of its purchases. In 2025, a poor harvest in Honduras forced Tavira to buy more from Colombia, and its average purchase cost rose by 9 per cent. The company passed only part of this increase on to retail customers. From 2026 it must also comply with new EU rules requiring proof that imported coffee is not linked to deforestation.',
    statements: [
      {
        text: 'All of the cooperatives Tavira currently works with receive the 20 per cent premium.',
        answer: 'false',
        why: 'Only eleven of the fourteen cooperatives currently qualify for the premium.',
      },
      {
        text: 'Tavira buys more coffee from Colombia than from Honduras.',
        answer: 'cannot-say',
        why: 'Only Ethiopia is ranked (largest share); the relative shares of Colombia and Honduras are not given.',
      },
      {
        text: 'Tavira buys more beans from Ethiopia than from Colombia.',
        answer: 'true',
        why: 'Ethiopian beans make up the largest share of its purchases.',
      },
    ],
  },
]
