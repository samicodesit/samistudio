# Backend deployment

From the Doodle project directory in Ubuntu/WSL, use the standard Vercel command:

```sh
npx vercel --prod
```

The project is already linked to Doodle in `.vercel/project.json`. This publishes the web backend and website. A backend-only update does not require an Android build or Google Play submission.

Use the intended release source in the checkout. The command uploads the current checkout; it does not distinguish unfinished local work from approved release changes. Obtain the owner's deployment approval under AGENTS.md, then run the command. Do not invent a separate prompt-specific deployment command or repeat completed QA.

On 30 September 2026, the vague-subject update was deployed as `dpl_2oNzhiU8HDfcVDUvEva6LjAmC9gd`. Vercel returned READY with aliases assigned. The release retained the previous production source, changing only the generation prompt and its obsolete no-text test assertion.

Current production is `dpl_97oxygv35DEv33X5tzU8DuWKakna`, the tested web cleanup. Main now reproduces its runtime source exactly; see `docs/production-baseline.json` for source hashes. Unpublished native work and local assets are isolated on `codex/doodle-next-update` in `C:/Users/Sami/.codex/worktrees/doodle-next-update/samistudio/doodle`. Deploy the intended web release from main, rather than the next-update checkout.
