# Doodle launch readout, 30 September 2026

Read inline around 22:50 Europe/Amsterdam. Public Android version 0.1.3/code 5 launched earlier today. Website/backend production is deployment `dpl_97oxygv35DEv33X5tzU8DuWKakna`.

| Surface | Reporting window | Observed result | Interpretation |
| --- | --- | --- | --- |
| Google Ads, campaign 24311833129 | Today, September 30, account Central European Time | Enabled, Eligible (Learning), EUR 4/day; 0 impressions, 0 installs, EUR 0.00 reported spend | No delivery is reported yet. Reporting is delayed. Do not increase the budget to force delivery. Existing October 4 end date remains unchanged. |
| Google Play Grow users | September 2 through September 29, chart dates visually inspected | 12 device impressions, 18 device acquisitions, 14 first opens, 9 monthly active devices; retention unavailable | Entire window predates the public launch and includes testing. These are not acquired production customers. |
| Vercel Production website analytics | September 29, 11pm through September 30, 10:59pm as displayed | 22 visitors, 36 page views, 59% bounce rate; 7 t.co referrals; Doodle Created: 4 visitors, 5 events | Includes owner/agent QA. Website events are not native-app usage, paying customers or install conversions. No source-to-generation attribution is established. |
| Play Monitor and improve | Last 28 days | No policy issues found; crash, ANR and cold-start data unavailable | Unavailable is not zero failures. |
| Play Monetize with Play | Last 28 days | EUR 0.00 reported revenue; monthly buyer count and ARPPU unavailable | Not a live receipt count or proof that no purchase has happened today. |
| Vercel request logs | 10:29pm through 10:59pm as displayed | No request logs in the selected window | No generation success/failure rate can be inferred from this empty window. |

## Concrete remaining work

- Google Play flags build 5 DEX obfuscation at 2%, below its 25% threshold, with a February 2027 deadline. Address R8 optimization and inspect the resulting bundle in the next Android update. Re-test Google sign-in, Play Integrity and purchases on that actual build before publication. This warning is separate from the current app's Published status. [Official Android guidance](https://developer.android.com/topic/performance/issues/code-optimization), updated September 21, 2026, checked September 30.
- Reinstall-proof trial protection is awaiting Google's device-recall early-access selection. Existing signed trial sessions, retained native trial identity, attestation and free-generation limits remain in place. They do not establish complete resistance to reinstall abuse.
- Native successful-first-doodle conversion is not measured by the current website analytics. Keep this as an explicit gap. Before adding telemetry, use existing server request reporting and Play acquisition/revenue reporting; any new measurement must distinguish QA and preserve the generation/payment path.
- Compare the campaign's actual delivery, installs and spending after reporting catches up. A five-day, small-budget campaign provides exploratory evidence, not a guaranteed profitable acquisition channel. No automatic extension or increased spending is authorized here.

## Reporting destinations

- [Google Ads campaign](https://ads.google.com/aw/adgroups?campaignId=24311833129&ocid=8521229714)
- [Play acquisition](https://play.google.com/console/u/0/developers/5843530199260119810/app/4973301025063263916/grow-overview)
- [Website analytics](https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/analytics)
- [Production request logs](https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/logs)

No ad settings, budget, credentials or Android release were changed in this pass. Reporting views were inspected directly; no new tracking SDK or monitoring automation was installed.

## Source organization completed

Main is a clean web production baseline. All 217 non-generated source/release files match the live Vercel upload by exact SHA1. Current instruction files, generated metadata, permanent regression tests and operational records are kept separately from runtime equivalence. Fresh validation passed 474 tests with one opt-in live image test skipped, the production build and lint with no errors. Existing lint warnings were retained.

The native source, unpublished Android cleanup, legacy TWA source and local marketing/store assets are preserved on `codex/doodle-next-update`, in `C:/Users/Sami/.codex/worktrees/doodle-next-update/samistudio/doodle`. Both checkouts are clean. The original final Android binaries remain ignored in the original workspace. `studio-terminal` is an independent nested Git repository and is excluded locally from the parent repository's status; its files were not changed.

The desktop worktree tool created the directory but failed application registration for the WSL repository. The existing checkout was retained and attached to the named branch using Git; no duplicate worktree was created. Windows download-zone metadata was omitted from the pending branch because it prevented a Windows checkout. Source and image bytes were preserved.
