# Native Doodle assets

The image files in this directory are copied byte-for-byte from the existing web assets:

- `doodle-reference-kiss.png` from `public/references/doodle-reference-kiss.png`
- the eight idea WebP files from `public/ideas/`

The native font files are variable TrueType files downloaded from the official Google Fonts repository on 2026-09-09:

- `BricolageGrotesque-Variable.ttf`, source `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf`
- `IBMPlexSans-Variable.ttf`, source `ofl/ibmplexsans/IBMPlexSans[wdth,wght].ttf`
- `Alexandria-Variable.ttf`, source `ofl/alexandria/Alexandria[wght].ttf`

The matching OFL license texts are next to each font. The UI uses Bricolage Grotesque for headings, IBM Plex Sans for body and controls, and Alexandria for Arabic. The TTF files are the native source. The repository WOFF2 files under `marketing-assets/demo/fonts` remain web references and are not native dependencies.

The runtime also has static faces generated from those approved variable files with `fontTools.varLib.instancer`. Bricolage Grotesque uses `opsz=38`, `wdth=100`, and weights 400, 600, and 700 for the native heading scale. IBM Plex Sans uses `wdth=100` and weights 400, 600, and 700. Alexandria uses weights 400, 600, and 700. The static files have no variation axes and have normalized family and subfamily names so Android and iOS can select the requested weight. The platform font configuration should register the aliases `BricolageGrotesque`, `IBMPlexSans`, and `Alexandria` against these files and their declared weights.

The Bricolage and IBM Plex files cover the Latin copy used by the app. Alexandria covers Arabic shaping and glyphs. Japanese and Korean copy require a licensed platform or Noto script fallback when the host does not provide those glyphs. That fallback must only cover unsupported glyphs and must not replace the brand family for its supported scripts.

## App identity assets

- `doodle-icon.png` is the unchanged 512 x 512 `store-assets/play-icon-512.png` file. Its SHA-256 is `c69929d0d3f36ce2d6b2c5c80870a5cdbca211577d30258b170ddb56809da169`. It is an opaque PNG with the approved pale canvas, yellow paper tile, graphite `D`, moss dot, border, and shadow. Use it as the general app icon source.
- `doodle-adaptive-icon-maskable.png` is the 512 x 512 PNG response from the approved live `/pwa/icon/maskable` route. Its SHA-256 is `35cb0546687aed3f15694e4bb987300a8a0cd5b3aeb39bbd7d105e8d5c2548f3`. It is an opaque complete maskable composition with the 80 percent paper tile and pale canvas. It is not a transparent foreground layer. The foundation config should use it as a complete maskable source or use a platform-safe configuration that does not apply the composition twice.
- `doodle-splash.png` is copied byte-for-byte from `android/app/src/main/res/drawable-xxxhdpi/splash.png`, 1200 x 1200, SHA-256 `73df94714c81d98bec5772610bdb00df278d3463119333f6c091dfbe6a86aff1`. It is an opaque full-canvas splash composition with the pale canvas, yellow tile, graphite `D`, moss dot, border, and shadow. Use `contain` with `#eef1ea` when the platform allows a resize mode.

All three identity PNGs have an alpha channel whose pixels are fully opaque. No transparent adaptive foreground asset exists in the approved source set. Keep these filenames when wiring `mobile/app.config.ts`, or coordinate a rename before changing this directory.

The native waiting animation is `pen-draw.json`, extracted from the approved `pen-draw-source.lottie` archive. The source is Pen draw by Kirill Aizenberg, published on [LottieFiles](https://lottiefiles.com/free-animation/pen-draw-ypxT0jiu4Y) under the LottieSimple License, which permits commercial use, modification, and distribution. Attribution is optional. The original archive SHA-256 is `DE4D75473E9F62E112C17B1F70E8ACA3E27D0C0AF891D8E7D184DB6805A60D10`. The extracted JSON preserves the original canvas, frame rate, layer structure, and keyframes. Its solid black artwork is mapped to native graphite `#20231f`, and its gold stroke is mapped to native moss `#195c47` for contrast on the Doodle yellow card. No timing or geometry was changed.
