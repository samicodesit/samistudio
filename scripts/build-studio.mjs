import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicitly publish the current homepage only, never repository or Doodle sources.
export const studioFiles = [
  'assets/terminal-viewport.mjs', 'assets/motion-preferences.mjs', 'motion-study.mjs', 'motion-study.css', 'entry-paths.mjs',
  'index.html', 'favicon.svg', 'og-image.jpg', 'assets/studio.css', 'assets/studio.js',
  'assets/key-spring.mjs', 'assets/terminal-controls.mjs', 'assets/terminal-housing.webp',
  'assets/secret-terminal.mjs', 'assets/javascript-playground.mjs',
  'assets/terminal-housing-mobile.webp', 'assets/terminal-keycaps.webp',
  'assets/terminal-keycaps-mobile.webp', 'assets/terminal-wide.webp',
  'assets/project-gallery.js', 'assets/project-gallery.css', 'assets/project-data.mjs', 'assets/gallery-geometry.mjs', 'assets/gallery-loading.mjs', 'assets/gallery-navigation.mjs',
  'assets/terminal-art/doodle.png', 'assets/terminal-art/autolister.png', 'assets/terminal-art/cryptik.png',
  'assets/gallery/stage-background.webp',
  'assets/gallery/doodle-atelier-desktop.webp', 'assets/gallery/doodle-atelier-portrait-room.webp', 'assets/gallery/doodle-atelier-landscape.webp', 'assets/gallery/doodle-atelier-panorama.webp',
  'assets/gallery/doodle-landscape.webp', 'assets/gallery/autolister-landscape.webp', 'assets/gallery/cryptik-landscape.webp',
  'assets/gallery/doodle-portrait-room.webp', 'assets/gallery/autolister-portrait-room.webp', 'assets/gallery/cryptik-portrait-room.webp',
  'assets/gallery/doodle-mobile-room.webp', 'assets/gallery/autolister-mobile-room.webp', 'assets/gallery/cryptik-mobile-room.webp',
  'assets/gallery/doodle-stage-reference.webp', 'assets/gallery/doodle-mobile-v2.webp',
  'assets/gallery/doodle-desktop-v2.webp', 'assets/gallery/doodle-room-wide-v2.webp',
  'assets/gallery/autolister-desktop.webp', 'assets/gallery/autolister-mobile.webp',
  'assets/gallery/autolister-desktop-patch-wordmark.webp', 'assets/gallery/autolister-desktop-patch-back.webp', 'assets/gallery/autolister-desktop-patch-caption.webp',
  'assets/gallery/autolister-mobile-patch-wordmark.webp', 'assets/gallery/autolister-mobile-patch-back.webp', 'assets/gallery/autolister-mobile-patch-caption.webp',
  'assets/gallery/cryptik-desktop.webp', 'assets/gallery/cryptik-mobile-intro.webp',
  'assets/gallery/cryptik-desktop-patch-wordmark.webp', 'assets/gallery/cryptik-desktop-patch-back.webp', 'assets/gallery/cryptik-desktop-patch-caption.webp',
  'assets/gallery/autolister-room-wide.webp', 'assets/gallery/cryptik-room-wide.webp',
  'assets/fonts/dm-serif-display-latin.woff2', 'assets/fonts/inter-latin.woff2',
  'assets/fonts/dmserifdisplay-OFL.txt', 'assets/fonts/inter-OFL.txt',
  'assets/icons/caret-right.svg', 'assets/icons/arrow-left.svg', 'assets/icons/LICENSE.txt',
];

export async function buildStudio(root = fileURLToPath(new URL('../', import.meta.url))) {
  root = resolve(root);
  for (const path of studioFiles) {
    const source = join(root, path);
    if (!(await stat(source)).isFile() || (await readFile(source)).length === 0) {
      throw new Error(`Missing or empty studio asset: ${path}`);
    }
  }
  const output = join(root, 'dist');
  await rm(output, { recursive: true, force: true });
  for (const path of studioFiles) {
    const target = join(output, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(root, path), target);
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = await buildStudio();
    console.log(`Built ${studioFiles.length} studio files in ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
