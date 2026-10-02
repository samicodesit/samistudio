# Web image surfaces

October 2, 2026. Owner authorized fixing and deploying the web app only.

The image viewer painted a solid yellow background behind the contained image, exposing mismatched yellow gutters. The card renderer also painted a yellow panel and inset the image, embedding a yellow frame in the downloaded card. Removed both artificial backgrounds and the card image inset. Original images retain their aspect ratio and complete content; the card retains its paper, outer border, message and 1200 by 1500 export size. No Android build or release was changed.

Verification before deployment: 14 focused card-renderer, card-composer and viewer checks passed, including a new regression for paper-colored gutters and preservation of a non-square source. TypeScript passed. Local previews used the actual app components, fonts and existing landing example at actual CSS sizes 1366 by 768 and 390 by 844. Inspected the settled card, preparing state, complete viewer image and downloaded PNG. No horizontal page overflow at phone size. Temporary presentation route was removed before deployment. These presentation checks did not exercise generation, sign-in or payments.

Minimal evidence is in C:/Users/Sami/.codex/doodle-live-evidence/image-surfaces: viewer-desktop.png, viewer-phone.png, card-desktop.png, card-phone.png and card-export.png. The example is the existing public/landing/birthday-dog.webp asset from the live release, used only for QA. These captures are presentation evidence, not approved marketing assets.
