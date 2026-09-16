import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicitly publish the current homepage only, never repository or Doodle sources.
export const studioFiles = [
  'index.html', 'favicon.svg', 'assets/studio.css', 'assets/studio.js',
  'assets/key-spring.mjs', 'assets/terminal-housing.webp',
  'assets/terminal-housing-mobile.webp', 'assets/terminal-keycaps.webp',
  'assets/terminal-keycaps-mobile.webp', 'assets/terminal-wide.webp',
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
