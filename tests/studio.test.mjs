import './og-image.test.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, stat, mkdtemp, mkdir, cp, rm, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeFiles = [
  'index.html', 'favicon.svg', 'og-image.jpg', 'assets/studio.css', 'assets/studio.js',
  'assets/key-spring.mjs', 'assets/terminal-housing.webp',
  'assets/terminal-housing-mobile.webp', 'assets/terminal-keycaps.webp',
  'assets/terminal-keycaps-mobile.webp', 'assets/terminal-wide.webp',
];
const text = path => readFile(join(root, path), 'utf8');

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-build-test-'));
  for (const path of runtimeFiles) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await cp(join(root, path), join(directory, path));
  }
  return directory;
}

async function walk(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await walk(directory, path));
    else result.push(path);
  }
  return result.sort();
}

test('homepage and manifest describe the current studio', async () => {
  const html = await text('index.html');
  assert.match(html, /<title>Sami Studio \| From idea to everyday<\/title>/);
  assert.match(html, /id="terminal-display"/);
  assert.match(html, /data-view="about"/);
  assert.match(html, /data-view="approach"/);
  assert.match(html, /data-view="contact"/);
  assert.doesNotMatch(html, /Bespoke Presence|Crafting premium landing pages|cdn\.tailwindcss\.com/i);
  const manifest = JSON.parse(await text('site.webmanifest'));
  assert.match(manifest.description, /digital products/);
  assert.doesNotMatch(manifest.description, /premium landing pages|elevate your digital presence/i);
  assert.equal(manifest.theme_color, '#ad9ba2');
});

test('all runtime files exist and image formats are valid', async () => {
  for (const path of runtimeFiles) {
    assert.ok((await stat(join(root, path))).size > 0, `${path} is empty`);
    const bytes = await readFile(join(root, path));
    if (path.endsWith('.webp')) {
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', path);
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', path);
    } else if (path.endsWith('.jpg')) {
      assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], path);
    } else if (path !== 'index.html') {
      assert.doesNotMatch(bytes.toString(), /^\s*<!doctype html/i, path);
    }
  }
});

test('HTML, CSS and JavaScript relative asset references resolve locally', async () => {
  for (const path of ['index.html', 'assets/studio.css', 'assets/studio.js', 'assets/key-spring.mjs']) {
    const source = await text(path);
    const refs = [...source.matchAll(/["']((?:\.\/|\.\.\/)[^"'\s]+\.(?:mjs|js|css|webp|svg|png|woff2?))["']/g)];
    for (const [, ref] of refs) {
      const target = resolve(dirname(join(root, path)), ref);
      assert.ok((await stat(target)).isFile(), `${path}: missing ${ref}`);
      assert.ok(runtimeFiles.includes(target.slice(root.length)), `${ref} excluded from deployment`);
    }
  }
});

test('build contains only current runtime files and preserves their bytes', async () => {
  const { buildStudio } = await import('../scripts/build-studio.mjs');
  const directory = await fixture();
  try {
    await mkdir(join(directory, 'doodle'));
    await writeFile(join(directory, 'doodle/private-source.ts'), 'must not be published');
    await writeFile(join(directory, '.env'), 'must not be published');
    const output = await buildStudio(directory);
    assert.deepEqual(await walk(output), [...runtimeFiles].sort());
    for (const path of runtimeFiles) {
      assert.deepEqual(await readFile(join(output, path)), await readFile(join(directory, path)), path);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing asset fails before removing an existing build', async () => {
  const { buildStudio } = await import('../scripts/build-studio.mjs');
  const directory = await fixture();
  try {
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'dist/previous.txt'), 'previous build');
    await rm(join(directory, 'assets/studio.css'));
    await assert.rejects(buildStudio(directory), /studio\.css/);
    assert.equal(await readFile(join(directory, 'dist/previous.txt'), 'utf8'), 'previous build');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Vercel builds the static site rather than serving the repository', async () => {
  const config = JSON.parse(await text('vercel.json'));
  assert.equal(config.framework, null);
  assert.equal(config.installCommand, '');
  assert.equal(config.buildCommand, 'node --test tests/studio.test.mjs && node scripts/build-studio.mjs');
  assert.equal(config.outputDirectory, 'dist');
});

test('local Vercel links are excluded from Git', async () => {
  assert.match(await text('.gitignore'), /^\.vercel\/$/m);
});
