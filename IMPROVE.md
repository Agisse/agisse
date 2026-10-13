# Weekly improvement run

Standing instructions for the scheduled agent that improves Agisse's outputs. A human reads and merges every PR. You never merge, deploy or migrate.

## Inputs

- `npm run quality` prints the quality report: per task, prompt version and model it shows failover, verifier flags, thumbs, edit and sent rates. It also shows score and rank calibration, and the latest thumbs-down notes. It reads `QUALITY_DATABASE_URL`, a read-only role.
- `npm run eval` replays `eval/fixtures/*.json` through the production prompts and model chain. It scores each output with the code verifiers and one judge call, and prints a metric table against `eval/results/baseline.json`. It needs `OPENROUTER_API_KEY` and costs about $0.05–0.20 a run.

## Loop

1. Run `npm ci`, then `npm run quality`. Read the whole report.
2. Pick **at most two** problems, and only ones the data supports:
   - a prompt version with a verifier flag rate above ~20% (for example `cv_experience_dropped` or `shared_ground_dropped`)
   - a cluster of thumbs-down notes saying the same thing
   - a high edit rate on outreach or cover letters
   - a model with high failover on a task
   - calibration drift: a score bucket whose progress rate contradicts its verdict, with n ≥ 30 in the buckets involved

   No problem backed by enough samples means no PR. Stop and say so. Doing nothing is a valid outcome.
3. On a branch named `improve/<yyyy-mm-dd>-<topic>`, run `npm run eval -- --save-baseline` first. Then make the smallest change that targets the problem:
   - **Prompt wording** in `worker/lib/{jobs,pipeline,interview,selection,assessments,companies,helper}.ts`. The prompt version is a hash of the system prompt, so it changes on its own.
   - **Model lists** in `wrangler.jsonc` `vars`.
   - **Thresholds backed by calibration**, such as the 4.0 do-not-apply cutoff in `finalizeEvaluation`, only with n ≥ 30.
   - **A new eval fixture** reproducing a failure mode seen in the report. Make it synthetic and never copy a real seeker's text.
4. Run `npm run eval` again, twice when the deltas are small, because models are not deterministic. Keep the change only if:
   - the target metric improves,
   - no `*.ok` or `evaluation.inBand` drops,
   - `*.invented` does not rise, and
   - cost stays within +20%.
5. Run `npm run build && npm run lint` and every `npx tsx <file>.check.ts`, then open a PR with `gh pr create`. The PR body has:
   - the problem, with its rows from the quality report
   - the change, in one paragraph
   - the before/after eval table and anything the eval printed with `!` or `✗`
   - what to watch in next week's report: the new prompt version appears as its own row

## Never

- Relax a hard constraint in `PRODUCT.md`:
  - never automate LinkedIn
  - at most one model call per user action
  - stay on the Cloudflare free tier
  - never invent facts
- Loosen a code verifier (`verifyCv`, `verifySharedGround`, `finalizeCheck`, `finalizeEvaluation`, `coverProblem`, the outreach length rules) to make a metric look better.
- Touch auth, billing, budgets, access approval or the database schema.
- Run `db:migrate`, deploy, push to `main` or merge.
- Paste any seeker's CV, posting, note or name into a PR, a fixture or a commit. The report's thumbs-down notes may be paraphrased as themes, never quoted with identifying detail.
