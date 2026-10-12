import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProject } from '../assets/project-data.mjs';
import { stat } from 'node:fs/promises';

test('widescreen opening requests only the visible photographic room', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['autolister', 'cryptik']) {
    const project = getProject(id);
    assert.deepEqual(projectAssets(project, 'wide'), [project.wideImage]);
  }
});

test('portrait and reference views request only their photograph and three small patches', async () => {
  const { projectAssets } = await import('../assets/gallery-loading.mjs');
  for (const id of ['autolister', 'cryptik']) {
    const project = getProject(id);
    for (const mode of ['desktop', 'mobile']) {
      const assets = projectAssets(project, mode);
      assert.equal(assets.length, 4);
      assert.equal(new Set(assets).size, 4);
      assert.equal(assets[0], mode === 'mobile' ? project.mobileImage : project.image);
      assert.ok(assets.slice(1).every(path => path.includes(`-${mode}-patch-`)));
    }
  }
});

test('data saving and slow connections disable speculative project requests', async () => {
  const { allowPrefetch } = await import('../assets/gallery-loading.mjs');
  assert.equal(allowPrefetch({ saveData: true, effectiveType: '4g' }), false);
  for (const effectiveType of ['slow-2g', '2g', '3g']) assert.equal(allowPrefetch({ effectiveType }), false);
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
