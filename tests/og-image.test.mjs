import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const imageUrl = 'https://samistudio.nl/og-image.jpg?v=b5d522be';

// Fingerprint of the visually checked, fully decoded 1200x630 JPEG.
// Update this deliberately when replacing the approved artwork.
const imageSha256 = 'b5d522be1d1bd1da0936e83ce6416af05777175ef909ccda901989b756e9a305';

test('social preview matches the verified optimized image bytes', async () => {
  const bytes = await readFile(new URL('og-image.jpg', root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), imageSha256,
    'approved 1200x630 image must not be recompressed or truncated');
  assert.ok(bytes.length < 150_000, 'social preview must stay below 150 KB');
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9]);
});

test('Open Graph and X reference the same full-resolution versioned image', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  const meta = name => {
    const tag = tags.find(tag => tag.includes(`property="${name}"`) || tag.includes(`name="${name}"`));
    assert.ok(tag, `${name} is missing`);
    return tag.match(/\bcontent="([^"]*)"/)?.[1];
  };
  for (const name of ['og:image', 'og:image:secure_url', 'twitter:image']) {
    assert.equal(meta(name), imageUrl, name);
  }
  assert.equal(meta('og:image:type'), 'image/jpeg');
  assert.equal(meta('og:image:width'), '1200');
  assert.equal(meta('og:image:height'), '630');
  assert.equal(meta('twitter:card'), 'summary_large_image');
});
