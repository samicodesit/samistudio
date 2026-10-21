# Compact detail selector implementation

Approved target: docs/design/detail-selector-2026-10-21/combined-review.png.

Scope: replace the flower dock with the compact selected example and label, open a three-example picker, preserve composer dimensions, share approved dog artwork and translated copy across web and native, default missing preferences to Medium while preserving saved choices. Preserve old native request omission semantics. No paid generation or native store release.

Steps:
1. Add behavior coverage for defaults, saved preferences, selection and keyboard dismissal.
2. Implement shared copy/examples, web picker and native picker using existing modal infrastructure.
3. Verify targeted and full suites, types, production build, actual responsive browser and native layouts.
4. Push a coherent source change and deploy web after layout verification. Verify the live result.

Status: implementation starting. Existing dirty Apple and sticky-color work predates this task and must be preserved.
