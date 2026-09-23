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
- Owner preference: avoid unnecessary AI wording in promotional copy, app/store titles and visual assets. Keep required platform disclosures and accurate privacy/data information. Never imply machine-generated examples were drawn by hand; describe them as drawing ideas or app examples. Do not add an AI caption by default just because generation uses AI.
- Check every detail for timing: does the reader need it to make this decision, or does it distract from the purpose? Discovery posts should establish usefulness and an easy next step; purchase screens must clearly explain price and terms before payment.
- Do not turn this into a blanket rule to omit prices. Include pricing when requested, required by the channel, relevant to the post's purpose, or necessary to avoid a misleading impression. Never imply unlimited free use when the trial is limited. For a brief Doodle introduction, "Try your first two doodles free" can communicate the trial without reproducing checkout copy.
- Read the final draft as a first-time user: is it immediately clear what Doodle does, why I might want it, and what to do next? Remove details that compete with those answers unless they are necessary disclosures.
- Owner approval establishes permission, not quality. The agent remains responsible for the recommendation and must not rely on the owner to catch weak choices. Give delegated reviewers this same audience-and-purpose brief.
- Every current channel recommendation must record the source date and the latest meaningful audience interaction or demand signal. A pinned or allowed thread, or fresh promotional comments alone, does not establish reach. Separate first-hand self-reported growth from verified metrics, and never call first-party testing visitors customers.
- Do not use the owner's personal Instagram or Facebook for Doodle promotion or publishing. Treat those accounts as outside the campaign audience even when they are already signed in.

Apply this as a short internal check, not another approval round or a lengthy review ritual. When a correction reveals a reusable mistake, record the decision rule and apply it to subsequent work rather than only patching that instance.

Use sub-agents when independent work can progress in parallel, such as responsive QA, Android readiness research, and launch execution. Give each agent a bounded scope and clear file or browser ownership so one visible workflow does not stall while unrelated work proceeds.

### Required final presentation check

- Loading UI preference: preserve the generous yellow animated card and its rotating messages as pleasant waiting feedback ("wait therapy"). Remove redundant copy below the card, rather than shrinking the animation or deleting the in-card messages. Keep message placement steady as the copy changes and apply this preference to app captures and demos.

- Before publishing, inspect the rendered preview when available, not only the source text. Check wording, paragraph spacing, link labels, images, and the clarity of the next action as the intended reader would see them.
- Never present a fixed or mock UI preview as functional app validation. Label previews before user use, state which flows are simulated, and restore or open the real app for functional testing. Report code review, fixture screenshots, live backend generation, and Play-installed native end-to-end results separately.
- Before release, verify fixture mode is disabled and validate actual output for changed generation prompts. Do not claim prompt quality from literal-string tests alone.
- Use meaningful clickable text for links where the platform supports it. Keep tracking parameters in the destination, not in visible copy. Verify the actual destination separately.
- After saving, inspect the actual published result visually and confirm that the content and link destination survived the editor. A successful save or an accessibility-tree check alone is not sufficient visual QA.
- For app UI changes, check both desktop and mobile. For external posts, inspect the published rendering and any available mobile preview; state any unverified surface accurately.
- Fix obvious presentation defects within the authorized scope before declaring completion. Do not make the owner identify each defect or request another routine correction.
- Record the specific verification performed in the relevant delivery record. If verification is unavailable, describe the limitation instead of claiming completion.
- For UI typography, inspect at actual CSS/phone size as well as export resolution. Check inherited fonts, letter spacing, transforms and rasterization; never rotate or scale readable controls with decorative artwork. Use a consistent type scale and familiar component patterns, with secondary actions disclosed when needed rather than displaying every action at equal emphasis.
- Inspect initial, transient, and error states as well as the settled layout. Do not leave blank controls without an explanation, and ensure programmatic initial focus does not visually promote a secondary or cancel action while preserving legitimate keyboard focus indicators.
- Use Doodle's brand typography across app, demo overlays and promotional assets: Bricolage Grotesque for headings, IBM Plex Sans for body and controls, with Alexandria for Arabic. Verify the actual fonts loaded/rendered rather than accepting a CSS family name alone. Fix spacing/transforms directly instead of replacing brand fonts with generic system fonts to hide rendering defects.
- Require a professional, restrained, brand-consistent result with balanced typography, proportions, and spacing; clear hierarchy; polished settled, loading, error, and motion states; and no redundant controls, placeholders, or filler. Inspect actual mobile, desktop, and export output, obtain independent review before release, and do not label work "AAA" from test passes alone.
- For marketing and UI gallery assets, keep an explicit current approved asset manifest with provenance and review status. Select only listed current assets. Never reuse failed or obsolete QA captures, and never treat a "final" filename as evidence of approval.

## Browser handoff

When the user is completing verification, authentication, payment approval, or another manual browser step, leave their browser tabs untouched until they explicitly say they are finished. Do not navigate, close dialogs, retry buttons, or inspect the active flow while they are working. Continue independent local work instead. Tell every delegated agent about the handoff.

### Persistent Chrome handoff

- Agent-created Chrome tabs are temporary and close when the turn ends unless
  they are explicitly marked.
- Before handing off a CAPTCHA, login, approval, or unfinished workflow, call
  `tab.markHandoff()` on the live tab. Verify the rendered screenshot and the
  browser inventory still show the target tab before reporting the handoff.
- Do not describe a managed tab as persistent from DOM state alone. Prefer an
  existing user tab when navigation is safe, and preserve unrelated tabs.

## Workspace housekeeping

Follow the global workspace housekeeping rule in `C:\Users\Sami\.codex\AGENTS.md` for disposable scratch files, test outputs, diagnostics, and build intermediates. Preserve source, final deliverables, minimal QA evidence, and active or shared files.
