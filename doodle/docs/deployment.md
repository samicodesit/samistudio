# Backend deployment

From the Doodle project directory in Ubuntu/WSL, use the standard Vercel command:

```sh
npx vercel --prod
```

The project is already linked to Doodle in `.vercel/project.json`. This publishes the web backend and website. A backend-only update does not require an Android build or Google Play submission.

Use the intended release source in the checkout. The command uploads the current checkout; it does not distinguish unfinished local work from approved release changes. Obtain the owner's deployment approval under AGENTS.md, then run the command. Do not invent a separate prompt-specific deployment command or repeat completed QA.

On 30 September 2026, the vague-subject update was deployed as `dpl_2oNzhiU8HDfcVDUvEva6LjAmC9gd`. Vercel returned READY with aliases assigned. The release retained the previous production source, changing only the generation prompt and its obsolete no-text test assertion.

Current production is `dpl_G6kXgdejq8wtZFhVSoyS5BF4upMm`, published 1 October 2026 from `13ea356`. It raises the server-owned free trial to four successful doodles and keeps older Android guest startup compatible. Previously used trial counts and paid credits are preserved. The earlier usage metrics remain available with `npm run metrics`; see `docs/usage-metrics.md`. Main matches all 228 uploaded source hashes; see `docs/production-baseline.json`.

Public Android is still build 6 (0.1.4). Build 7 (0.1.5) is signed and uploaded into Play edit `13975943408303764340`, but is not submitted: the API account receives HTTP 403 on validate/commit and the browser helper cannot initialize. Its canonical source is `aacd2ce` on `codex/doodle-next-update` at `C:/Users/Sami/.codex/worktrees/doodle-next-update/samistudio/doodle`. The final bundle is `/home/mests/projects/samistudio/doodle/mobile/artifacts/doodle-release-v7.aab`. Resume by committing that edit through an authorized publisher or finishing the production release in Play Console. Verify the current edit before acting, since opening a new Console workflow can invalidate an existing API edit. Do not claim the prepared track is public. Deploy web releases from main, rather than the native checkout.
