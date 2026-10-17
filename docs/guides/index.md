---
title: Graduate and internship selection processes
description: How consulting, banking, Big Four and corporate employers in Europe screen graduates and interns, and every online test they use, explained.
---

<script setup>
import { CURATED_ASSESSMENTS } from '../../shared/assessment-catalog'
import { PROVIDER_IDS, providerName, slug } from '../.vitepress/names'
</script>

# Selection processes and online tests

What happens after you press apply: the online test, the video interview and the rounds after, per employer. Every page lists its sources and the date they were checked.

## By employer

<ul><li v-for="c in CURATED_ASSESSMENTS" :key="c.company"><a :href="`/docs/guides/${slug(c.company)}`">{{ c.company }}</a></li></ul>

## By test

<ul><li v-for="id in PROVIDER_IDS" :key="id"><a :href="`/docs/tests/${slug(id)}`">{{ providerName(id) }}</a></li></ul>

[Practise every test in Agisse](https://agisse.xyz/?utm_source=docs&utm_medium=guide) — free beta.
