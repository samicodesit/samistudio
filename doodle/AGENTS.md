<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Quick QA before every step

Before executing any step, briefly check that it makes sense for the user's actual goal. This applies to research, code changes, tests, deployments, marketing, publishing, and spending.

- State the intended outcome internally and check the evidence, audience fit, and prerequisites. Do not act just because a tool or channel is available.
- Check the user's latest corrections, existing authorization, and remaining budget. Never mistake a proposed action for an approved one.
- Check the content and destination before any external action; verify factual claims against the actual app or asset. Do not repeat a channel the user has rejected.
- Choose a proportionate step and define how its outcome will be verified. If the step fails this check, revise or skip it before execution.
- Verify the result afterward and distinguish attempted, prepared, published, and measured outcomes. Do not claim growth from implementation alone.

Keep this check lightweight. Explain material decisions and risks to the user, but do not turn routine checks into repeated permission requests.

Use sub-agents when independent work can progress in parallel, such as responsive QA, Android readiness research, and launch execution. Give each agent a bounded scope and clear file or browser ownership so one visible workflow does not stall while unrelated work proceeds.

## Browser handoff

When the user is completing verification, authentication, payment approval, or another manual browser step, leave their browser tabs untouched until they explicitly say they are finished. Do not navigate, close dialogs, retry buttons, or inspect the active flow while they are working. Continue independent local work instead. Tell every delegated agent about the handoff.
