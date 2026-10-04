# Six real HIGH-quality comparisons

Columns in [the comparison image](comparison.png): Simple, Medium, Detailed. Top row: a cat holding a small flower. Bottom row: two friends baking pancakes.

All six are actual image-provider outputs. Model: gpt-image-1-mini. Rendering quality: high. Size: 1024 by 1024. One image per request, no retries, automatic grading or regeneration. The original PNGs and prompt versions are recorded in [the manifest](manifest.json).

Both sets show clear increasing complexity and retain recognizable subjects and actions. Medium develops contours and interior features; Detailed adds richer patterns and surroundings. Detailed remains readable but is considerably busier.

Style needs owner review: the cat gains hatched shading, while the cooking images include dark filled hair or cookware. These outputs do not strictly satisfy the no-shading instruction. The sample covers two scenes and cannot establish consistency across arbitrary prompts. No further spending is authorized by this run.

| Scene | Simple | Medium | Detailed |
| --- | --- | --- | --- |
| Cat holding a flower | [Original](1-1-simple.png) | [Original](1-1-medium.png) | [Original](1-1-detailed.png) |
| Friends baking pancakes | [Original](2-1-simple.png) | [Original](2-1-medium.png) | [Original](2-1-detailed.png) |

Owner visual acceptance is pending. Deployment and Android publishing require separate approval.

## Paper-color review, October 4

The owner identified inconsistent paper shades in the cooking comparison. The prompt requests the same base color, `#FFEB8A`, for all levels. Median samples from the outer 16 px of the original PNGs estimate Simple at `#FEEA8D`, Medium at `#F7DC82`, and Detailed at `#F6DB91`. Simple is close; Medium and Detailed drift darker and differ from each other. Subtle permitted texture does not explain the base-color difference. The store composition preserves these source colors.

The earlier visual review missed this difference. Method and measurements are recorded in [paper-color-review.json](paper-color-review.json). No images, prompts, production settings or deployments were changed by this check.

Owner clarification: hatching and filled areas in these examples are liked and should remain. Slight paper-color drift is acceptable. These preferences supersede the strict no-shading and exact-color criteria above. A paper correction is only a proposed optional safeguard, not an implemented or required change. Whole-asset visual approval and publishing approval remain pending.
