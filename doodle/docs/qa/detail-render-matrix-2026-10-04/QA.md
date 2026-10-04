# Detail and rendering quality experiment

The owner requested nine new tests, one scene across all three detail levels and all three rendering settings, and asked the agent to choose a setting for Doodle's launch and costs. The owner separately approved up to $0.18. Exactly nine requests completed, with no retries. No app route, credit balance or production setting changed.

The scene was two friends making pancakes together in a cozy kitchen. Current Simple, Medium and Detailed prompt builders were unchanged. Model gpt-image-1-mini, one image per request, 1024 square. Prompt hashes are identical across the three quality settings within each detail level. The genuine PNGs and the output of the unchanged paper-correction helper are retained separately.

## Measurements

| Rendering quality | Mean provider time, this batch | Mean estimated image and prompt cost |
| --- | ---: | ---: |
| LOW | 8.4 seconds | $0.0062 |
| MEDIUM | 12.4 seconds | $0.0122 |
| HIGH | 27.9 seconds | $0.0372 |

Published output rates plus reported text-input tokens total $0.166992 for the batch. This is an estimate, not a reconciled invoice. The original LOW Detailed image had extra color and diffuse texture; paper correction returned uncertain and preserved its bytes. The other eight images were corrected. No marketing edits, image grading loop or regeneration were performed.

## Visual judgment and launch choice

- Simple: MEDIUM is adequate and closest to the minimal round-head shorthand. HIGH adds recognizable clothes and clearer cartoon hand gestures. Both retain an approachable compact scene. LOW has weaker action clarity because the second person is less involved.
- Medium: LOW has rougher faces and less coherent small objects. MEDIUM is usable, but its raised bowl/pan and surrounding rectangular outline make the action less clear. HIGH separates whisk, bowl, hands and pan better and gives the figures a clearer interaction.
- Detailed: LOW has conspicuous messy marks, an ambiguous floating utensil/batter shape and extra color. MEDIUM is readable and usable. HIGH has more developed clothing, kitchen objects and coherent foreground composition. It also includes a wink, dense hair fill and some shading. Those are actual remaining model deviations, not proof that higher quality solves every instruction.

Final owner selection: MEDIUM uniformly for the upcoming release. The agent initially favored HIGH for visual clarity, but the owner explicitly prioritized waiting time and rejected 20-plus-second generation. MEDIUM is usable across all three detail levels and measured about 12.4 seconds in this batch. Preserve one rendering setting across levels, with identical credits, dimensions, model and request count. Do not raise production to HIGH or introduce per-level rendering settings.

The current public web offer was verified at https://doodle.samistudio.nl/ on October 4: EUR 4.99 for ten more doodles. Using this batch's input sizes, ten HIGH outputs would cost approximately $0.37, compared with $0.12 at MEDIUM, an extra $0.25 per pack. These are generation costs only. They exclude platform fees, tax, refunds, infrastructure and currency conversion, so they do not establish net margin. HIGH took about 15.5 additional seconds in this batch. Preserve the current yellow waiting animation; do not promise this measured time as a production latency guarantee.

Limit: one sample per cell and one scene in this batch. The earlier bookshop comparison supplies a second subject for Detailed; it also favored HIGH visually. This is directional evidence, not a statistical consistency claim, broad subject benchmark or Play-installed end-to-end verification. Production is already MEDIUM and stays MEDIUM. Measured provider time excludes the rest of the app flow and is not a maximum waiting-time guarantee.

The same model is scheduled for removal on December 1, 2026 according to https://developers.openai.com/api/docs/deprecations, checked October 4. A separately evaluated migration is required before that date. Do not silently change models in this quality comparison or current feature release.

Replacement candidate: gpt-image-2.5-flare, because official OpenAI documentation positions it for fast everyday image generation, while Sunburst emphasizes editing precision. This is a candidate for measured comparison, not an accepted production replacement. Quality labels and cost do not transfer directly between models; compare actual latency, token usage, subject fidelity and the three detail profiles before migrating. Sources checked October 4: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare and https://developers.openai.com/api/docs/guides/image-generation. No further paid requests or model changes were made.
