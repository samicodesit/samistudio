# Terminal screen refinement

Current accepted intent: About must provide useful hiring information rather than repeat the homepage. The independent design review rejected the name/stat/process layout.

## Final design

About has two plain groups: Build a new product (Websites, apps and extensions), and Improve an existing one (UX fixes, features and performance). Discuss your project opens the same contact dialog, preserving drafts and returning focus to its own entry. No slogan, statistic, process labels, connectors or decorative panels.

Contact retains its compact Let's talk CTA and direct email alternative.

Pagination: a 680 ms monochrome chevron flicker, narrow double-image echo and 5 px outward nudge. Begin after 1.5 seconds of idle Work visibility. Defer during input, hidden content and dialogs. Repeat after 5 idle seconds only until actual pagination. Actual paging suppresses the cue for the remainder of the visit. Reduced motion skips it.

## Evidence

186 automated tests pass. Ten viewport sizes were measured for the revised About, from 320 px to 2560 px, with no overflow. The cue was observed in the browser after About to Work; the counter stayed unchanged. Actual pagination and the About contact link/focus-return flow were checked. An independent designer reviewed mobile and desktop screenshots and found no material visual issues.

Local preview only. No deployment.
