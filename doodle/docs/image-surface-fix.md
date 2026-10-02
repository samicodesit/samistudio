# Web image surfaces

October 2, 2026. Owner authorized fixing and deploying the web app only.

The viewer painted a solid yellow background behind contained images, exposing mismatched yellow gutters. Removed that background and border. Images retain their complete content and aspect ratio.

The final classic card places square artwork edge to edge above a separate paper caption band. Removed the artificial yellow panel, image inset and detached outer border. The export remains 1200 by 1500. Frame paper, border and layout values live in src/lib/card/frame.ts. Optional borders hug the actual fitted artwork bounds, including non-square sources. This is a small rendering foundation for future frames, without a paid catalogue or entitlement system. Android was not changed.

Verification: 14 focused renderer, composer and viewer checks passed. TypeScript passed. Inspected actual components at CSS sizes 1366 by 768 and 390 by 844, including the preparing state and a longer caption. Inspected the downloaded PNG at export size. No horizontal phone overflow. Temporary QA route removed before deployment. These checks did not exercise generation, sign-in or payments.

Presentation evidence is in C:/Users/Sami/.codex/doodle-live-evidence/image-surfaces: card-desktop.png, card-phone.png, card-long-message-phone.png, card-export.png, viewer-live-desktop.png and viewer-live-phone.png. The existing public/landing/birthday-dog.webp asset was used for local presentation QA. These screenshots are not approved marketing assets.
