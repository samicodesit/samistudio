# Gallery interaction polish

Goal: cycle the three existing scenes with deliberate vertical input, improve header legibility and show terminal loading inline. Preserve scene artwork and responsive camera geometry.

Work inline. Use native view transitions with decoded assets, a lightweight animation fallback and reduced motion support. Replace the current gallery history entry when cycling, so Back to work remains a single action. Group wheel bursts including momentum; filter sideways gestures and pinch zoom. Use pointer events for touch and keep zoom enabled. No animation library or eager downloading of the whole gallery.

Files: gallery-navigation.mjs for gesture decisions; project-gallery.js/css for lifecycle, glass and loading; index.html for accessible navigation instructions; build allowlist and navigation tests.

Validation: gesture regression tests, complete studio suite and static build; browser wheel, keyboard, Back/Escape, all three scenes at phone/tablet/desktop sizes. Check loading feedback, browser viewport changes and motion preferences. Stage only these changes in the existing release checkout, push and publish the verified static build.
