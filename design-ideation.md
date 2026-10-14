# Project stage review, October 12, 2026

Status: approved for faithful local implementation on October 12, 2026. The owner approved the complete AutoLister and corrected Cryptik desktop and dedicated mobile scenes, explicitly requiring 1:1 copies. Gallery production deployment is not authorized by this implementation approval.

The owner rejected the earlier AutoLister and Cryptik asset-based arrangements. The four references below are now the selected implementation targets. Compare all four built views to their corresponding source at matching dimensions. Preserve the photographed stage; recreate website typography, navigation and links as native HTML.

## Current review set

All source images are in `C:/Users/Sami/.codex/generated_images/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/`.

- AutoLister desktop: `exec-9d884a5b-0482-4fa6-886e-8d3f63cb72e2.png`.
- AutoLister mobile: `exec-8d37bc2d-75f8-4bfb-bef9-1673a83b87b2.png`.
- Cryptik desktop, corrected: `exec-05d93805-d871-4cd5-b57a-665b3740fffe.png`.
- Cryptik mobile: `exec-8ee8a5f0-60ec-4174-8a58-a60b98c3a309.png`.

Review boards are in `C:/Users/Sami/.codex/visualizations/2026/10/12/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/samistudio/`: `autolister-desktop-mobile.png` and `cryptik-desktop-mobile.png`. They place the unedited desktop frame next to the proportionally scaled mobile frame, with presentation labels above the images.

## Grounding

AutoLister uses the real listing-form screenshot and its charcoal garment photos. Its new scene connects the listing panel to a matching garment draped over a limestone styling plinth. Cryptik uses its real blue/red spy artwork and a physical Codenames word-card field. Each product has a separately composed phone scene. Website typography remains DM Serif Display and Inter.

Discarded Cryptik result `exec-e40ae9a1-161e-420f-bbf6-e9591aefef27.png` incorrectly used single-letter Scrabble-style tiles. It is not a valid selection target. The corrected desktop and mobile show a five-column, five-row grid of complete words on individual cards.

## Existing implementation boundary

The typography-only production release is live at `https://samistudio.nl/`. The selected AutoLister and Cryptik galleries are now implemented locally at `http://localhost:8090/`. Owner acceptance and gallery production publication remain pending. Doodle's separate note and continuous panel/floor reconstruction are preserved. See `design-qa.md` for comparison evidence.

## Asset preparation

Built-in ImageGen prepared clean text plates. Shared prompt: remove only the website wordmark, back navigation, headline, description and external link; restore wall/floor underneath; preserve objects, framing, embedded product text, materials and shadows. Each source was edited independently. The implementation uses only website-text regions from these plates, preserving the approved photograph elsewhere.

- AutoLister desktop clean: `exec-66a82936-37af-40ce-8280-ac02cfeb1cb2.png`.
- AutoLister mobile clean: `exec-3d64b6cc-ba45-473f-981a-992e4fa32765.png`.
- Cryptik desktop clean: `exec-10595617-b90c-48b7-a599-cbd39375ed4e.png`.
- Cryptik mobile clean: `exec-12cb34bb-d99a-4f23-852c-90857b26bf3d.png`.

Two continuous widescreen rooms were generated from the clean desktop images. Prompt: extend left/right to 16:9; preserve the products and styling; add no principal objects or portfolio text. AutoLister: `exec-99d05b79-bb0b-43d5-8feb-fb4fb5fdffcf.png`. Cryptik: `exec-53e6862f-4221-4257-858d-00cc4087cb15.png`. Stitching these onto the original was rejected because of seams. The full continuous renders are used on wider screens with native typography. They are responsive adaptations, not pixel-identical copies of the narrower approved photos.

Project-bound assets are in `assets/gallery/`. `scripts/prepare-stage-assets.py` records source/output mappings and verifies lossless encoding. Exact generation prompts are saved in `design-image-prompts.json`. No API or CLI generation fallback was used. Original PNG sources are retained.


## 2026-10-15: Approved Doodle atelier

The final Doodle setting is a sunlit creative atelier with an oak worktable, plaster wall, olive foliage, linen notebook and graphite pencils. Its wide desktop app is the dominant piece; mobile uses the compact app. The panel is supported by the tabletop and leans against the wall. A stationary birthday puppy paper sits behind the panel. The room differs from AutoLister's garment styling area and Cryptik's stone game room while sharing warm light and natural materials.

The owner requires authentic artwork. The final preparation uses the real flower-cat, the four owner-supplied yellow drawings, and actual three flower-detail SVGs. Generative redraws were replaced before release. Native portfolio typography, glass, navigation, responsive footer geometry and existing continuous scroll behavior remain shared. Source mappings, artwork hashes and encoding are recorded in design-image-prompts.json and scripts/prepare-doodle-atelier.py.
