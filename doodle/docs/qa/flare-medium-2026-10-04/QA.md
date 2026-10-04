# Mini versus Flare at MEDIUM

Owner requested one or two examples with the proposed replacement model against existing results, then explicitly approved up to $0.06. Exactly two Flare requests completed without retries. No production setting changed and no app credits were used.

Same scene: two friends making pancakes together in a cozy kitchen. The actual Simple and Detailed prompt builders, 1024 square PNG format and one-image request were retained. Prompt hashes match the existing Mini MEDIUM baselines. New model: gpt-image-2.5-flare, explicit quality medium. Both originals and unchanged paper-correction outputs are retained. Both new images passed correction.

| Detail level | Mini provider time | Flare provider time | Mini token-cost estimate | Flare token-cost estimate |
| --- | ---: | ---: | ---: | ---: |
| Simple | 12.803 seconds | 10.505 seconds | $0.009870 | $0.016725 |
| Detailed | 12.410 seconds | 11.478 seconds | $0.009612 | $0.016080 |

New batch estimated total $0.032805. This uses returned text input and image output token counts at the official standard rates: Flare text $5/M and image output $30/M; Mini text $2/M and output $8/M. The previous Mini batch used the published per-image output table as a conservative estimate, approximately $0.012 per MEDIUM output including prompt input. Neither basis is an invoice. On the consistent token basis used in this comparison, Flare costs about 68% more, but the absolute difference is about $0.067 for ten outputs. Its mean provider time was about 1.6 seconds shorter.

Visual inspection covered all four corrected 1024 images and both new untouched originals. Flare Simple has recognizable hair, aprons, a spatula and a compact pancake stack. The action is clear and approachable, but it is more developed than Mini's basic round-head figures. Mini is more faithful to the simplest shorthand. Flare Detailed has finer lines, clearer utensils and richer coherent clothing and kitchen details. Mini Detailed is readable but has rougher lines, more repetitive hatching and a framing rectangle. Flare still adds hatching and dark pan fill, and some peripheral objects meet the image edge. Higher capability does not establish perfect instruction following. The generic scene does not request genders, so two women in Flare Detailed are not a subject mismatch.

Judgment: Flare MEDIUM is a promising replacement candidate, with a substantial visual improvement for Detailed and no longer wait in these two examples. Retain current Mini MEDIUM for the already prepared release until migration is separately authorized and verified. The Simple complexity and untested middle detail profile need attention before accepting equivalent profile behavior. Two samples of one scene do not establish typical latency, broad consistency, failure rate, native Integrity or live credit behavior.

Official calculator checked October 4 at https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency: GPT Image 2.5, medium, 1024 by 1024, 439 output tokens, $0.01317 output estimate. Actual responses reported the same output tokens. Model and token pricing: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare and https://developers.openai.com/api/docs/models/gpt-image-1-mini. Current model removal December 1, 2026: https://developers.openai.com/api/docs/deprecations.
