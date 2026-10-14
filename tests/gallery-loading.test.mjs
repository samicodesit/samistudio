import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProject } from '../assets/project-data.mjs';
import { stat } from 'node:fs/promises';

test('widescreen opening requests only the visible photographic room', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['doodle', 'autolister', 'cryptik']) {
    const project = getProject(id);
    assert.deepEqual(projectAssets(project, 'wide'), [project.wideImage]);
  }
});

test('portrait and reference views request only their photograph and three small patches', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['autolister']) {
    const project = getProject(id);
    for (const mode of ['desktop', 'mobile']) {
      const assets = projectAssets(project, mode);
      assert.equal(assets.length, mode === 'mobile' ? 5 : 4);
      assert.equal(new Set(assets).size, assets.length);
      assert.equal(assets[0], mode === 'mobile' ? project.mobileImage : project.image);
      assert.ok(assets.slice(mode === 'mobile' ? 2 : 1).every(path => path.includes(`-${mode}-patch-`)));
    }
  }
});

test('the clean Cryptik portrait does not download desktop text plates', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  const project = getProject('cryptik');
  assert.deepEqual(projectAssets(project, 'mobile'), ['./gallery/cryptik-mobile-intro.webp', project.mobileRoom]);
  assert.equal(projectAssets(project, 'desktop').length, 4);
});

test('data saving disables background loading; other connections warm the current scenes', async () => {
  const { allowPrefetch } = await import('../assets/gallery-loading.mjs');
  assert.equal(allowPrefetch({ saveData: true, effectiveType: '4g' }), false);
  for (const effectiveType of ['slow-2g', '2g', '3g']) assert.equal(allowPrefetch({ effectiveType }), true);
  assert.equal(allowPrefetch({ effectiveType: '4g' }), true);
  assert.equal(allowPrefetch(undefined), true);
});

test('native text replacement patches stay within a 256 KiB per-scene budget', async () => {
  for (const id of ['autolister', 'cryptik']) {
    const project = getProject(id);
    for (const patches of [project.patches, project.mobilePatches]) {
      const sizes = await Promise.all(patches.map(path => stat(new URL(`../assets/${path}`, import.meta.url))));
      assert.ok(sizes.reduce((total, file) => total + file.size, 0) < 256 * 1024);
    }
  }
});

test('portrait phones and tablets request one continuous photograph only', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['doodle', 'autolister', 'cryptik']) {
    const project = getProject(id);
    assert.deepEqual(projectAssets(project, 'tablet'), [project.tabletImage]);
    assert.ok((await stat(new URL(`../assets/${project.tabletImage}`, import.meta.url))).size < 768 * 1024);
  }
});

test('landscape phones and tablets request one continuous photograph only', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['doodle', 'autolister', 'cryptik']) {
    const project = getProject(id);
    assert.deepEqual(projectAssets(project, 'landscape'), [project.landscapeImage]);
    assert.ok((await stat(new URL(`../assets/${project.landscapeImage}`, import.meta.url))).size < 768 * 1024);
  }
});

test('Doodle reuses one current-layout atelier plate without obsolete patches or room requests', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  const project = getProject('doodle');
  for (const mode of ['desktop','wide','panorama','tablet','landscape','mobile']) {
    const assets = projectAssets(project,mode);
    assert.equal(assets.length,1);
    assert.ok(assets[0].includes('doodle-atelier-'));
    assert.ok((await stat(new URL(`../assets/${assets[0]}`,import.meta.url))).size < 512 * 1024);
  }
  assert.deepEqual(projectAssets(project,'desktop'),projectAssets(project,'wide'));
});
