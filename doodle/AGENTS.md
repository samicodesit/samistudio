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

### Audience and purpose check

Factual accuracy alone is not sufficient QA. Before recommending or publishing copy, identify who will read it, what they know at this point, and the one action it should help them take. Evaluate the draft against that purpose before asking the owner to approve it.

- For Doodle, lead with an understandable use case: a small drawing for a card, lunchbox note or journal. Match the language and emphasis to the actual channel and audience.
- Check every detail for timing: does the reader need it to make this decision, or does it distract from the purpose? Discovery posts should establish usefulness and an easy next step; purchase screens must clearly explain price and terms before payment.
- Do not turn this into a blanket rule to omit prices. Include pricing when requested, required by the channel, relevant to the post's purpose, or necessary to avoid a misleading impression. Never imply unlimited free use when the trial is limited. For a brief Doodle introduction, "Try your first two doodles free" can communicate the trial without reproducing checkout copy.
- Read the final draft as a first-time user: is it immediately clear what Doodle does, why I might want it, and what to do next? Remove details that compete with those answers unless they are necessary disclosures.
- Owner approval establishes permission, not quality. The agent remains responsible for the recommendation and must not rely on the owner to catch weak choices. Give delegated reviewers this same audience-and-purpose brief.

Apply this as a short internal check, not another approval round or a lengthy review ritual. When a correction reveals a reusable mistake, record the decision rule and apply it to subsequent work rather than only patching that instance.

Use sub-agents when independent work can progress in parallel, such as responsive QA, Android readiness research, and launch execution. Give each agent a bounded scope and clear file or browser ownership so one visible workflow does not stall while unrelated work proceeds.

### Required final presentation check

- Before publishing, inspect the rendered preview when available, not only the source text. Check wording, paragraph spacing, link labels, images, and the clarity of the next action as the intended reader would see them.
- Use meaningful clickable text for links where the platform supports it. Keep tracking parameters in the destination, not in visible copy. Verify the actual destination separately.
- After saving, inspect the actual published result visually and confirm that the content and link destination survived the editor. A successful save or an accessibility-tree check alone is not sufficient visual QA.
- For app UI changes, check both desktop and mobile. For external posts, inspect the published rendering and any available mobile preview; state any unverified surface accurately.
- Fix obvious presentation defects within the authorized scope before declaring completion. Do not make the owner identify each defect or request another routine correction.
- Record the specific verification performed in the relevant delivery record. If verification is unavailable, describe the limitation instead of claiming completion.
- For UI typography, inspect at actual CSS/phone size as well as export resolution. Check inherited fonts, letter spacing, transforms and rasterization; never rotate or scale readable controls with decorative artwork. Use a consistent type scale and familiar component patterns, with secondary actions disclosed when needed rather than displaying every action at equal emphasis.

## Browser handoff

When the user is completing verification, authentication, payment approval, or another manual browser step, leave their browser tabs untouched until they explicitly say they are finished. Do not navigate, close dialogs, retry buttons, or inspect the active flow while they are working. Continue independent local work instead. Tell every delegated agent about the handoff.
