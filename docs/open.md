---
title: Agisse in the open
description: What Agisse has and what agisse.xyz costs to run, from the live job feed and GitHub numbers to the monthly costs, updated by hand.
---

<script setup>
import { ref, onMounted } from 'vue'

// Live from /api/public/stats (cached an hour). A number it didn't give, or a zero, isn't shown.
const s = ref({})
onMounted(() => fetch('/api/public/stats').then((r) => (r.ok ? r.json() : {})).then((j) => (s.value = j), () => {}))
const n = (x) => x.toLocaleString('en')
</script>

# Agisse in the open

Agisse is free and open source. Here's what it has, and what it costs to run. The numbers update by themselves where they can; the rest is updated by hand once a month.

## The job feed today

<ul v-if="s.open">
  <li>{{ n(s.open) }} open roles</li>
  <li v-if="s.companies">at {{ n(s.companies) }} employers</li>
  <li v-if="s.countries">in {{ n(s.countries) }} countries</li>
</ul>
<p v-else>Live from agisse.xyz; the numbers show there.</p>

## The project

<ul>
  <li><a href="https://github.com/Agisse/agisse">The code on GitHub</a><template v-if="s.stars">: {{ n(s.stars) }} stars</template></li>
  <li v-if="s.hired"><a href="https://github.com/Agisse/agisse/blob/main/HIRED.md">{{ n(s.hired) }} people hired</a>, who shared their story</li>
</ul>

## What agisse.xyz costs per month

Last updated October 2026.

| What | Cost |
|---|---|
| Cloudflare Workers and R2 | Free tier |
| Neon Postgres | Free tier |
| Error tracking: Sentry | Sponsored plan for open source |
| AI on Agisse's key: Mistral Small 4 (EU); tailored CVs on free models | Paid, with a daily cap |

Paid by: Lennart, the founder, out of pocket. No ads, no selling data, no paid placement in the feed, and no paid plans. When you connect your own AI key, your provider bills you directly, and Agisse sees none of that money.

## Thanks

[Sentry](https://sentry.io) sponsors Agisse's error tracking, free, as an open-source project.

## What isn't open, and why

All the code is open (AGPL-3.0). The job feed isn't: the postings come from many sites whose terms don't allow bulk redistribution, and keeping it curated costs time and money. A self-hosted copy has every feature and starts with an empty feed. [Self-hosting](/self-host).

[Why Agisse exists](/manifesto)
